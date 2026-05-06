import { IT_TICKET_STATUSES } from "../data/itHardwareDemoData";

const MANAGER_ROLE_IDS = new Set(["admin", "management"]);
const IT_ROLE_IDS = new Set(["it"]);
const EMPLOYEE_ROLE_IDS = new Set(["employee", "ground", "mis", "ops_finance"]);

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function getEmailDomain(email) {
  return normalizeEmail(email).split("@")[1] || "";
}

export function isOfficialEmail(email, allowedDomain) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedDomain = normalizeEmail(allowedDomain);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return false;
  }

  return !normalizedDomain || getEmailDomain(normalizedEmail) === normalizedDomain;
}

export function getItAccessLevel(workflowRole, employeeRole = "EMPLOYEE") {
  const normalizedWorkflowRole = String(workflowRole || "").toLowerCase();
  const normalizedEmployeeRole = String(employeeRole || "").toUpperCase();

  if (MANAGER_ROLE_IDS.has(normalizedWorkflowRole) || normalizedEmployeeRole === "ADMIN") {
    return "admin";
  }

  if (IT_ROLE_IDS.has(normalizedWorkflowRole) || normalizedEmployeeRole === "IT") {
    return "it";
  }

  if (EMPLOYEE_ROLE_IDS.has(normalizedWorkflowRole)) {
    return "employee";
  }

  return "employee";
}

export function canManageItTickets(workflowRole, employeeRole) {
  return ["admin", "it"].includes(getItAccessLevel(workflowRole, employeeRole));
}

export function canAdministerItModule(workflowRole, employeeRole) {
  return getItAccessLevel(workflowRole, employeeRole) === "admin";
}

export function getScopedItTickets(tickets, currentEmployee, workflowRole) {
  if (!currentEmployee) {
    return [];
  }

  if (canManageItTickets(workflowRole, currentEmployee.role)) {
    return tickets;
  }

  const employeeEmail = normalizeEmail(currentEmployee.email);
  return tickets.filter((ticket) => normalizeEmail(ticket.employeeEmail || ticket.employee_email) === employeeEmail);
}

export function getTicketDisplayStatus(ticket) {
  if (ticket.status === "Closed" && ticket.resolutionStatus === "Resolved") {
    return "Resolved";
  }

  return ticket.status || "Requested";
}

export function getTicketStatusTone(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized.includes("resolved") || normalized.includes("closed") || normalized.includes("returned")) {
    return "green";
  }

  if (normalized.includes("rejected") || normalized.includes("lost")) {
    return "red";
  }

  if (normalized.includes("repair") || normalized.includes("pending")) {
    return "amber";
  }

  if (normalized.includes("issued") || normalized.includes("use") || normalized.includes("approved")) {
    return "blue";
  }

  return "purple";
}

export function buildNextTicketNumber(tickets = []) {
  const year = new Date().getFullYear();
  const maxSequence = tickets.reduce((max, ticket) => {
    const match = String(ticket.ticketNumber || ticket.ticket_number || "").match(/^HW-\d{4}-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `HW-${year}-${String(maxSequence + 1).padStart(4, "0")}`;
}

export function buildAuditLog(ticketNumber, action, actorEmail, details) {
  return {
    auditId: `AUD-${Date.now()}`,
    ticketNumber,
    action,
    actorEmail,
    details,
    createdAt: new Date().toISOString(),
  };
}

export function buildEmailEvent(ticketNumber, eventType, toLabel, ccLabel) {
  return {
    emailId: `MAIL-${Date.now()}`,
    ticketNumber,
    eventType,
    toLabel,
    ccLabel,
    status: "Queued",
    createdAt: new Date().toISOString(),
  };
}

export function summarizeTickets(tickets = []) {
  const openTickets = tickets.filter((ticket) => !["Closed", "Rejected"].includes(ticket.status)).length;
  const resolvedTickets = tickets.filter((ticket) => getTicketDisplayStatus(ticket) === "Resolved").length;
  const repairPending = tickets.filter((ticket) => ticket.status === "Repair Pending").length;
  const issuedOrInUse = tickets.filter((ticket) => ticket.status === "Issued" || ticket.status === "In Use").length;

  return [
    { title: "Tickets Visible", value: tickets.length, note: "Role-scoped hardware tickets", tone: "blue" },
    { title: "Open Tickets", value: openTickets, note: "Awaiting IT action or closure", tone: "amber" },
    { title: "Resolved", value: resolvedTickets, note: "Closed with resolution", tone: "green" },
    { title: "Repair Pending", value: repairPending, note: "Vendor or bench action needed", tone: "red" },
    { title: "Issued / In Use", value: issuedOrInUse, note: "Assets currently with employees", tone: "purple" },
  ];
}

export function summarizeInventory(assets = []) {
  return assets.reduce(
    (summary, asset) => {
      summary.total += 1;
      if (asset.status === "Available") summary.available += 1;
      if (asset.status === "In Use" || asset.status === "Issued") summary.assigned += 1;
      if (asset.status === "Repair" || asset.status === "Warranty") summary.service += 1;
      return summary;
    },
    { total: 0, available: 0, assigned: 0, service: 0 },
  );
}

export function groupTicketsByField(tickets = [], field) {
  const groups = new Map();

  tickets.forEach((ticket) => {
    const value = ticket[field] || "Unassigned";
    groups.set(value, (groups.get(value) || 0) + 1);
  });

  return [...groups.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

export function parseEmployeeCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const row = Object.fromEntries(headers.map((header, valueIndex) => [header, values[valueIndex] || ""]));
    const email = normalizeEmail(row.email || row.office_email || row.official_email);

    return {
      employeeId: row.employeeid || row.employee_id || row.emp_id || `CSV-${index + 1}`,
      fullName: row.fullname || row.full_name || row.name || "Imported Employee",
      email,
      department: row.department || "Unassigned",
      designation: row.designation || row.title || "",
      officeLocation: row.officelocation || row.office_location || row.location || "",
      role: String(row.role || "EMPLOYEE").toUpperCase(),
      managerEmail: normalizeEmail(row.manageremail || row.manager_email),
      isActive: !["false", "inactive", "0"].includes(String(row.isactive || row.is_active || "true").toLowerCase()),
    };
  });
}

function splitCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

export function getNextStatuses(currentStatus) {
  if (!currentStatus || currentStatus === "Requested") {
    return IT_TICKET_STATUSES;
  }

  const currentIndex = IT_TICKET_STATUSES.indexOf(currentStatus);
  if (currentIndex < 0) {
    return IT_TICKET_STATUSES;
  }

  return IT_TICKET_STATUSES.filter((status, index) => index >= currentIndex || status === "Rejected");
}
