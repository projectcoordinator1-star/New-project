const BASE_URL = "http://localhost:8787";

function buildHeaders(context = {}) {
  return {
    "content-type": "application/json",
    "x-user-email": context.email || "",
    "x-workflow-role": context.workflowRole || "",
  };
}

async function parseJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload;
}

export async function loginItHardwareEmployee(email) {
  const response = await fetch(`${BASE_URL}/api/it-hardware/auth/login`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ email }),
  });

  return parseJsonResponse(response, "Unable to login with this office email");
}

export async function fetchItHardwareBootstrap(context = {}) {
  const params = new URLSearchParams();
  if (context.email) params.set("email", context.email);
  if (context.workflowRole) params.set("workflowRole", context.workflowRole);

  const response = await fetch(`${BASE_URL}/api/it-hardware/bootstrap?${params}`);
  return parseJsonResponse(response, "Unable to load IT hardware ticketing data");
}

export async function createItHardwareTicket(payload, context = {}) {
  const response = await fetch(`${BASE_URL}/api/it-hardware/tickets`, {
    method: "POST",
    headers: buildHeaders(context),
    body: JSON.stringify(payload),
  });

  return parseJsonResponse(response, "Unable to raise hardware ticket");
}

export async function updateItHardwareTicket(ticketNumber, updates, context = {}) {
  const response = await fetch(`${BASE_URL}/api/it-hardware/tickets/${encodeURIComponent(ticketNumber)}`, {
    method: "PATCH",
    headers: buildHeaders(context),
    body: JSON.stringify(updates),
  });

  return parseJsonResponse(response, "Unable to update hardware ticket");
}

export async function importItHardwareEmployees(rows, context = {}) {
  const response = await fetch(`${BASE_URL}/api/it-hardware/employees/import`, {
    method: "POST",
    headers: buildHeaders(context),
    body: JSON.stringify({ employees: rows }),
  });

  return parseJsonResponse(response, "Unable to import employees");
}
