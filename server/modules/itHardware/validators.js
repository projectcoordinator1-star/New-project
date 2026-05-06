const ALLOWED_TICKET_TYPES = new Set([
  "New Hardware Request",
  "Hardware Issued",
  "Hardware Return",
  "Repair Request",
  "Replacement Request",
  "Lost/Damaged Hardware",
  "Warranty Service",
]);

const ALLOWED_TICKET_STATUSES = new Set([
  "Requested",
  "Approved",
  "Issued",
  "In Use",
  "Repair Pending",
  "Returned",
  "Closed",
  "Rejected",
]);

const ALLOWED_PRIORITIES = new Set(["Low", "Medium", "High", "Urgent"]);
const MANAGEMENT_ROLES = new Set(["admin", "management"]);
const IT_ROLES = new Set(["it"]);

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function getRequestUser(request) {
  return {
    email: normalizeEmail(request.headers["x-user-email"]),
    workflowRole: String(request.headers["x-workflow-role"] || "").trim().toLowerCase(),
  };
}

export function validateOfficialEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const allowedDomain = normalizeEmail(process.env.ALLOWED_EMAIL_DOMAIN || "demo.qpms.local");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error("Enter a valid official office email.");
    error.statusCode = 400;
    throw error;
  }

  if (allowedDomain && normalizedEmail.split("@")[1] !== allowedDomain) {
    const error = new Error(`Use an email from ${allowedDomain}.`);
    error.statusCode = 403;
    throw error;
  }

  return normalizedEmail;
}

export function canManageHardware(workflowRole, employeeRole = "") {
  const role = String(workflowRole || "").toLowerCase();
  const employeeRoleCode = String(employeeRole || "").toUpperCase();
  return MANAGEMENT_ROLES.has(role) || IT_ROLES.has(role) || employeeRoleCode === "ADMIN" || employeeRoleCode === "IT";
}

export function canAdministerHardware(workflowRole, employeeRole = "") {
  const role = String(workflowRole || "").toLowerCase();
  const employeeRoleCode = String(employeeRole || "").toUpperCase();
  return MANAGEMENT_ROLES.has(role) || employeeRoleCode === "ADMIN";
}

export function assertCanManageHardware(workflowRole, employeeRole = "") {
  if (!canManageHardware(workflowRole, employeeRole)) {
    const error = new Error("Only IT Team and Admin roles can manage hardware tickets.");
    error.statusCode = 403;
    throw error;
  }
}

export function assertCanAdministerHardware(workflowRole, employeeRole = "") {
  if (!canAdministerHardware(workflowRole, employeeRole)) {
    const error = new Error("Only Admin role can perform this action.");
    error.statusCode = 403;
    throw error;
  }
}

export function validateTicketPayload(payload = {}) {
  const ticketType = payload.ticketType || payload.ticket_type;
  const status = payload.status || "Requested";
  const priority = payload.priority || "Medium";
  const subject = cleanText(payload.subject);
  const description = cleanText(payload.description);
  const employeeEmail = validateOfficialEmail(payload.employeeEmail || payload.employee_email);

  if (!ALLOWED_TICKET_TYPES.has(ticketType)) {
    const error = new Error("Invalid hardware ticket type.");
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_TICKET_STATUSES.has(status)) {
    const error = new Error("Invalid hardware ticket status.");
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_PRIORITIES.has(priority)) {
    const error = new Error("Invalid hardware ticket priority.");
    error.statusCode = 400;
    throw error;
  }

  if (!subject || !description) {
    const error = new Error("Ticket subject and description are required.");
    error.statusCode = 400;
    throw error;
  }

  return {
    ticketType,
    status,
    priority,
    employeeEmail,
    employeeId: cleanText(payload.employeeId || payload.employee_id),
    employeeName: cleanText(payload.employeeName || payload.employee_name),
    department: cleanText(payload.department),
    designation: cleanText(payload.designation),
    hardwareCategory: cleanText(payload.hardwareCategory || payload.hardware_category) || "Other",
    assetId: cleanText(payload.assetId || payload.asset_id),
    subject,
    description,
    businessJustification: cleanText(payload.businessJustification || payload.business_justification),
    neededBy: cleanText(payload.neededBy || payload.needed_by),
    assignedToEmail: normalizeEmail(payload.assignedToEmail || payload.assigned_to_email),
  };
}

export function validateTicketUpdate(payload = {}) {
  const update = {};

  if (payload.status !== undefined) {
    if (!ALLOWED_TICKET_STATUSES.has(payload.status)) {
      const error = new Error("Invalid hardware ticket status.");
      error.statusCode = 400;
      throw error;
    }
    update.status = payload.status;
  }

  if (payload.assetId !== undefined || payload.asset_id !== undefined) {
    update.assetId = cleanText(payload.assetId || payload.asset_id);
  }

  if (payload.priority !== undefined) {
    if (!ALLOWED_PRIORITIES.has(payload.priority)) {
      const error = new Error("Invalid hardware ticket priority.");
      error.statusCode = 400;
      throw error;
    }
    update.priority = payload.priority;
  }

  if (payload.assignedToEmail !== undefined || payload.assigned_to_email !== undefined) {
    update.assignedToEmail = normalizeEmail(payload.assignedToEmail || payload.assigned_to_email);
  }

  if (payload.resolutionNote !== undefined || payload.resolution_note !== undefined) {
    update.resolutionNote = cleanText(payload.resolutionNote || payload.resolution_note);
  }

  if (payload.resolutionStatus !== undefined || payload.resolution_status !== undefined) {
    update.resolutionStatus = cleanText(payload.resolutionStatus || payload.resolution_status);
  }

  if (payload.resolvedAt !== undefined || payload.resolved_at !== undefined) {
    update.resolvedAt = cleanText(payload.resolvedAt || payload.resolved_at);
  }

  if (payload.closedAt !== undefined || payload.closed_at !== undefined) {
    update.closedAt = cleanText(payload.closedAt || payload.closed_at);
  }

  return update;
}

export function normalizeEmployeeImportRow(row = {}) {
  const email = validateOfficialEmail(row.email || row.office_email || row.official_email);

  return {
    employeeId: cleanText(row.employeeId || row.employee_id || row.emp_id) || `EMP-${Date.now()}`,
    fullName: cleanText(row.fullName || row.full_name || row.name) || "Imported Employee",
    email,
    department: cleanText(row.department) || "Unassigned",
    designation: cleanText(row.designation || row.title),
    officeLocation: cleanText(row.officeLocation || row.office_location || row.location),
    role: cleanText(row.role).toUpperCase() || "EMPLOYEE",
    managerEmail: normalizeEmail(row.managerEmail || row.manager_email),
    isActive: row.isActive === undefined ? true : Boolean(row.isActive),
  };
}

function cleanText(value) {
  return String(value || "").trim();
}
