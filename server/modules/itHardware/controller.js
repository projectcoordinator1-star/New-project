import { getPublicEmailConfig, notifyTicketClosed, notifyTicketRaised } from "../../services/emailService.js";
import {
  createEmployeeForLogin,
  createHardwareTicket,
  fetchHardwareBootstrap,
  fetchHardwareReports,
  findEmployeeByEmail,
  importEmployees,
  insertEmailNotification,
  updateHardwareTicket,
} from "./model.js";
import {
  assertCanAdministerHardware,
  getRequestUser,
  normalizeEmployeeImportRow,
  validateOfficialEmail,
  validateTicketPayload,
  validateTicketUpdate,
} from "./validators.js";

export async function login(pool, payload) {
  const email = validateOfficialEmail(payload.email);
  const employee = (await findEmployeeByEmail(pool, email)) || (await createEmployeeForLogin(pool, email));

  return {
    ok: true,
    employee,
    config: getPublicEmailConfig(),
  };
}

export async function bootstrap(pool, request, requestUrl) {
  const headerUser = getRequestUser(request);
  const queryEmail = requestUrl.searchParams.get("email");
  const queryWorkflowRole = requestUrl.searchParams.get("workflowRole");
  const user = {
    email: queryEmail ? validateOfficialEmail(queryEmail) : headerUser.email,
    workflowRole: queryWorkflowRole || headerUser.workflowRole,
  };
  const data = await fetchHardwareBootstrap(pool, user);

  return {
    ok: true,
    data: {
      ...data,
      config: getPublicEmailConfig(),
    },
  };
}

export async function createTicket(pool, request, payload) {
  const user = getRequestUser(request);
  const validated = validateTicketPayload(payload);
  const result = await createHardwareTicket(pool, validated, user.email || validated.employeeEmail);
  const emailResult = await notifyTicketRaised(result.ticket);
  const emailEvent = await insertEmailNotification(pool, emailResult);

  return {
    ok: true,
    ticket: result.ticket,
    auditLog: result.auditLog,
    emailEvent,
  };
}

export async function updateTicket(pool, request, ticketNumber, payload) {
  const user = getRequestUser(request);
  const actor = user.email ? await findEmployeeByEmail(pool, user.email) : null;
  const validated = validateTicketUpdate(payload);
  const result = await updateHardwareTicket(pool, ticketNumber, validated, user, actor?.role);
  let emailEvent = null;

  if (result.ticket.status === "Closed" || result.ticket.status === "Rejected") {
    const emailResult = await notifyTicketClosed(result.ticket);
    emailEvent = await insertEmailNotification(pool, emailResult);
  }

  return {
    ok: true,
    ticket: result.ticket,
    auditLog: result.auditLog,
    emailEvent,
  };
}

export async function importEmployeeCsv(pool, request, payload) {
  const user = getRequestUser(request);
  const actor = user.email ? await findEmployeeByEmail(pool, user.email) : null;
  assertCanAdministerHardware(user.workflowRole, actor?.role);

  const employees = Array.isArray(payload.employees) ? payload.employees.map(normalizeEmployeeImportRow) : [];
  if (!employees.length) {
    const error = new Error("No valid employee rows supplied.");
    error.statusCode = 400;
    throw error;
  }

  const result = await importEmployees(pool, employees, user);
  return {
    ok: true,
    employees: result.employees,
    auditLog: result.auditLog,
  };
}

export async function reports(pool, request, requestUrl) {
  const headerUser = getRequestUser(request);
  const user = {
    email: requestUrl.searchParams.get("email") || headerUser.email,
    workflowRole: requestUrl.searchParams.get("workflowRole") || headerUser.workflowRole,
  };

  return {
    ok: true,
    reports: await fetchHardwareReports(pool, user),
  };
}
