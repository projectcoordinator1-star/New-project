import { ensureItHardwareSchema } from "./schema.js";
import { canManageHardware, normalizeEmail } from "./validators.js";

const SCHEMA = "qpms";

export async function findEmployeeByEmail(pool, email) {
  await ensureItHardwareSchema(pool);
  const result = await pool.query(`select * from ${SCHEMA}.it_employee where lower(email::text) = lower($1)`, [email]);
  return result.rows[0] ? mapEmployee(result.rows[0]) : null;
}

export async function createEmployeeForLogin(pool, email) {
  await ensureItHardwareSchema(pool);
  const normalizedEmail = normalizeEmail(email);
  const name = normalizedEmail
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  const employee = {
    employeeId: `EMP-${Date.now()}`,
    fullName: name || "Office Employee",
    email: normalizedEmail,
    department: "Unassigned",
    designation: "Employee",
    officeLocation: "Office",
    role: "EMPLOYEE",
    managerEmail: "",
    isActive: true,
  };

  const result = await upsertEmployee(pool, employee);
  return result;
}

export async function fetchHardwareBootstrap(pool, user) {
  await ensureItHardwareSchema(pool);
  const employee = user.email ? await findEmployeeByEmail(pool, user.email) : null;
  const canViewAll = canManageHardware(user.workflowRole, employee?.role);
  const ticketValues = [];
  const ticketWhere = canViewAll
    ? ""
    : employee
      ? `where lower(employee_email::text) = lower($${ticketValues.push(employee.email)})`
      : "where false";

  const [employeesResult, assetsResult, ticketsResult, auditResult, emailResult] = await Promise.all([
    pool.query(`select * from ${SCHEMA}.it_employee order by is_active desc, department, full_name`),
    pool.query(`select * from ${SCHEMA}.it_asset order by asset_status, category, asset_tag`),
    pool.query(`select * from ${SCHEMA}.it_hardware_ticket ${ticketWhere} order by updated_at desc`, ticketValues),
    pool.query(`select * from ${SCHEMA}.it_ticket_audit_log order by created_at desc limit 250`),
    pool.query(`select * from ${SCHEMA}.it_email_notification order by created_at desc limit 250`),
  ]);

  return {
    employees: employeesResult.rows.map(mapEmployee),
    assets: assetsResult.rows.map(mapAsset),
    tickets: ticketsResult.rows.map(mapTicket),
    auditLogs: auditResult.rows.map(mapAuditLog),
    emailEvents: emailResult.rows.map(mapEmailEvent),
    currentEmployee: employee,
  };
}

export async function createHardwareTicket(pool, payload, actorEmail) {
  await ensureItHardwareSchema(pool);
  const ticketNumber = await buildTicketNumber(pool);
  const employee = await upsertEmployee(pool, {
    employeeId: payload.employeeId || `EMP-${Date.now()}`,
    fullName: payload.employeeName,
    email: payload.employeeEmail,
    department: payload.department,
    designation: payload.designation,
    officeLocation: "",
    role: "EMPLOYEE",
    managerEmail: "",
    isActive: true,
  });

  const result = await pool.query(
    `
    insert into ${SCHEMA}.it_hardware_ticket (
      ticket_number,
      ticket_type,
      ticket_status,
      resolution_status,
      priority,
      employee_id,
      employee_name,
      employee_email,
      department,
      designation,
      hardware_category,
      asset_id,
      subject,
      description,
      business_justification,
      needed_by,
      assigned_to_email,
      created_by_email
    )
    values ($1, $2, $3, 'Open', $4, $5, $6, $7, $8, $9, $10, nullif($11, ''), $12, $13, $14, nullif($15, '')::date, nullif($16, ''), $17)
    returning *
    `,
    [
      ticketNumber,
      payload.ticketType,
      "Requested",
      payload.priority,
      employee.employeeId,
      employee.fullName,
      employee.email,
      employee.department,
      employee.designation,
      payload.hardwareCategory,
      payload.assetId,
      payload.subject,
      payload.description,
      payload.businessJustification,
      payload.neededBy,
      payload.assignedToEmail,
      actorEmail || employee.email,
    ],
  );

  const ticket = mapTicket(result.rows[0]);
  const auditLog = await insertAuditLog(pool, {
    ticketNumber: ticket.ticketNumber,
    action: "Ticket Raised",
    actorEmail: actorEmail || employee.email,
    details: "Ticket submitted and notification queued to IT_TEAM_EMAIL with HR_MANAGER_EMAIL in CC.",
  });

  return { ticket, auditLog };
}

export async function updateHardwareTicket(pool, ticketNumber, updates, user, employeeRole) {
  await ensureItHardwareSchema(pool);

  if (!canManageHardware(user.workflowRole, employeeRole)) {
    const error = new Error("Only IT Team and Admin roles can update hardware tickets.");
    error.statusCode = 403;
    throw error;
  }

  const existingResult = await pool.query(`select * from ${SCHEMA}.it_hardware_ticket where ticket_number = $1`, [ticketNumber]);
  if (!existingResult.rows.length) {
    const error = new Error("Hardware ticket not found.");
    error.statusCode = 404;
    throw error;
  }

  const assignments = [];
  const values = [];
  const closesTicket = updates.status === "Closed";
  const rejectsTicket = updates.status === "Rejected";
  addAssignment(assignments, values, "ticket_status", updates.status);
  addAssignment(assignments, values, "priority", updates.priority);
  addAssignment(assignments, values, "asset_id", updates.assetId || null, updates.assetId !== undefined);
  addAssignment(assignments, values, "assigned_to_email", updates.assignedToEmail || user.email || null, updates.assignedToEmail !== undefined || Boolean(user.email));
  addAssignment(assignments, values, "resolution_note", updates.resolutionNote, updates.resolutionNote !== undefined);
  addAssignment(assignments, values, "resolution_status", updates.resolutionStatus, updates.resolutionStatus !== undefined && !closesTicket && !rejectsTicket);
  addAssignment(assignments, values, "resolved_at", updates.resolvedAt || null, updates.resolvedAt !== undefined && !closesTicket);
  addAssignment(assignments, values, "closed_at", updates.closedAt || null, updates.closedAt !== undefined && !closesTicket && !rejectsTicket);

  if (closesTicket) {
    addAssignment(assignments, values, "resolution_status", "Resolved");
    addAssignment(assignments, values, "resolved_at", new Date().toISOString());
    addAssignment(assignments, values, "closed_at", new Date().toISOString());
  }

  if (rejectsTicket) {
    addAssignment(assignments, values, "resolution_status", "Rejected");
    addAssignment(assignments, values, "closed_at", new Date().toISOString());
  }

  if (!assignments.length) {
    return { ticket: mapTicket(existingResult.rows[0]), auditLog: null };
  }

  values.push(ticketNumber);
  const result = await pool.query(
    `
    update ${SCHEMA}.it_hardware_ticket
    set ${assignments.join(", ")},
        updated_at = now()
    where ticket_number = $${values.length}
    returning *
    `,
    values,
  );

  const ticket = mapTicket(result.rows[0]);
  await updateAssetFromTicket(pool, ticket);

  const auditLog = await insertAuditLog(pool, {
    ticketNumber,
    action: ticket.status === "Closed" ? "Ticket Closed" : ticket.status === "Rejected" ? "Ticket Rejected" : "Ticket Updated",
    actorEmail: user.email,
    details: `Updated fields: ${Object.keys(updates).join(", ")}.`,
  });

  return { ticket, auditLog };
}

export async function importEmployees(pool, employees, user) {
  await ensureItHardwareSchema(pool);
  const imported = [];

  for (const employee of employees) {
    imported.push(await upsertEmployee(pool, employee));
  }

  await pool.query(
    `
    insert into ${SCHEMA}.it_employee_import_batch (imported_by_email, imported_count, rejected_count)
    values ($1, $2, 0)
    `,
    [user.email || null, imported.length],
  );

  const auditLog = await insertAuditLog(pool, {
    ticketNumber: "Employee Import",
    action: "CSV Import",
    actorEmail: user.email,
    details: `${imported.length} employee rows imported.`,
  });

  return { employees: imported, auditLog };
}

export async function insertEmailNotification(pool, emailResult) {
  await ensureItHardwareSchema(pool);
  const result = await pool.query(
    `
    insert into ${SCHEMA}.it_email_notification (
      ticket_number,
      event_type,
      to_label,
      cc_label,
      email_status,
      provider_response
    )
    values ($1, $2, $3, $4, $5, $6::jsonb)
    returning *
    `,
    [
      emailResult.ticketNumber,
      emailResult.eventType,
      emailResult.toLabel,
      emailResult.ccLabel,
      emailResult.status,
      JSON.stringify(emailResult),
    ],
  );

  return mapEmailEvent(result.rows[0]);
}

export async function fetchHardwareReports(pool, user) {
  const bootstrap = await fetchHardwareBootstrap(pool, user);
  const tickets = bootstrap.tickets;

  return {
    status: groupBy(tickets, "status"),
    ticketType: groupBy(tickets, "ticketType"),
    department: groupBy(tickets, "department"),
  };
}

async function upsertEmployee(pool, employee) {
  const result = await pool.query(
    `
    insert into ${SCHEMA}.it_employee (
      employee_id,
      full_name,
      email,
      department,
      designation,
      office_location,
      role_code,
      manager_email,
      is_active
    )
    values ($1, $2, $3, $4, $5, $6, $7, nullif($8, ''), $9)
    on conflict (email)
    do update set
      full_name = excluded.full_name,
      department = excluded.department,
      designation = excluded.designation,
      office_location = excluded.office_location,
      role_code = excluded.role_code,
      manager_email = excluded.manager_email,
      is_active = excluded.is_active,
      updated_at = now()
    returning *
    `,
    [
      employee.employeeId,
      employee.fullName,
      employee.email,
      employee.department || "Unassigned",
      employee.designation || "",
      employee.officeLocation || "",
      employee.role || "EMPLOYEE",
      employee.managerEmail || "",
      employee.isActive !== false,
    ],
  );

  return mapEmployee(result.rows[0]);
}

async function buildTicketNumber(pool) {
  const year = new Date().getFullYear();
  const result = await pool.query(
    `
    select coalesce(max(substring(ticket_number from 'HW-[0-9]{4}-([0-9]+)')::integer), 0) + 1 as next_sequence
    from ${SCHEMA}.it_hardware_ticket
    where ticket_number like $1
    `,
    [`HW-${year}-%`],
  );

  return `HW-${year}-${String(result.rows[0].next_sequence || 1).padStart(4, "0")}`;
}

async function insertAuditLog(pool, payload) {
  const result = await pool.query(
    `
    insert into ${SCHEMA}.it_ticket_audit_log (ticket_number, action_name, actor_email, details)
    values ($1, $2, $3, $4)
    returning *
    `,
    [payload.ticketNumber, payload.action, payload.actorEmail || null, payload.details],
  );

  return mapAuditLog(result.rows[0]);
}

function addAssignment(assignments, values, column, value, shouldAdd = value !== undefined) {
  if (!shouldAdd) {
    return;
  }

  values.push(value);
  assignments.push(`${column} = $${values.length}`);
}

async function updateAssetFromTicket(pool, ticket) {
  if (!ticket.assetId) {
    return;
  }

  if (ticket.status === "Issued" || ticket.status === "In Use") {
    await pool.query(
      `
      update ${SCHEMA}.it_asset
      set asset_status = $1,
          assigned_to_email = $2,
          updated_at = now()
      where asset_id = $3
      `,
      [ticket.status, ticket.employeeEmail, ticket.assetId],
    );
    return;
  }

  if (ticket.status === "Returned" || ticket.status === "Closed") {
    await pool.query(
      `
      update ${SCHEMA}.it_asset
      set asset_status = 'Available',
          assigned_to_email = null,
          updated_at = now()
      where asset_id = $1
      `,
      [ticket.assetId],
    );
    return;
  }

  if (ticket.status === "Repair Pending") {
    await pool.query(
      `
      update ${SCHEMA}.it_asset
      set asset_status = 'Repair',
          updated_at = now()
      where asset_id = $1
      `,
      [ticket.assetId],
    );
  }
}

function groupBy(rows, field) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row[field] || "Unassigned";
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  return [...grouped.entries()].map(([label, count]) => ({ label, count }));
}

function mapEmployee(row) {
  return {
    employeeId: row.employee_id,
    fullName: row.full_name,
    email: row.email,
    department: row.department,
    designation: row.designation || "",
    officeLocation: row.office_location || "",
    role: row.role_code,
    managerEmail: row.manager_email || "",
    isActive: row.is_active,
  };
}

function mapAsset(row) {
  return {
    assetId: row.asset_id,
    assetTag: row.asset_tag,
    category: row.category,
    brand: row.brand || "",
    model: row.model || "",
    serialNumber: row.serial_number || "",
    status: row.asset_status,
    assignedToEmail: row.assigned_to_email || "",
    warrantyEnd: row.warranty_end || "",
    purchaseDate: row.purchase_date || "",
    location: row.asset_location || "",
  };
}

function mapTicket(row) {
  return {
    ticketId: row.ticket_number,
    ticketNumber: row.ticket_number,
    ticketType: row.ticket_type,
    status: row.ticket_status,
    resolutionStatus: row.resolution_status,
    priority: row.priority,
    employeeId: row.employee_id || "",
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    department: row.department || "",
    designation: row.designation || "",
    hardwareCategory: row.hardware_category,
    assetId: row.asset_id || "",
    subject: row.subject,
    description: row.description,
    businessJustification: row.business_justification || "",
    neededBy: row.needed_by || "",
    assignedToEmail: row.assigned_to_email || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at || "",
    closedAt: row.closed_at || "",
    resolutionNote: row.resolution_note || "",
  };
}

function mapAuditLog(row) {
  return {
    auditId: String(row.audit_id),
    ticketNumber: row.ticket_number,
    action: row.action_name,
    actorEmail: row.actor_email || "",
    details: row.details || "",
    createdAt: row.created_at,
  };
}

function mapEmailEvent(row) {
  return {
    emailId: String(row.email_id),
    ticketNumber: row.ticket_number,
    eventType: row.event_type,
    toLabel: row.to_label,
    ccLabel: row.cc_label || "",
    status: row.email_status,
    createdAt: row.created_at,
  };
}
