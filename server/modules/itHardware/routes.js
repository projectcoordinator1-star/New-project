import { bootstrap, createTicket, importEmployeeCsv, login, reports, updateTicket } from "./controller.js";

export async function routeItHardwareRequest(request, response, context) {
  const { pathname, requestUrl, pool, readJsonBody, sendJson } = context;

  if (!pathname.startsWith("/api/it-hardware")) {
    return false;
  }

  if (request.method === "GET" && pathname === "/api/it-hardware/bootstrap") {
    sendJson(response, 200, await bootstrap(pool, request, requestUrl));
    return true;
  }

  if (request.method === "GET" && pathname === "/api/it-hardware/reports") {
    sendJson(response, 200, await reports(pool, request, requestUrl));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/it-hardware/auth/login") {
    sendJson(response, 200, await login(pool, await readJsonBody(request)));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/it-hardware/tickets") {
    sendJson(response, 201, await createTicket(pool, request, await readJsonBody(request)));
    return true;
  }

  if (request.method === "PATCH" && pathname.startsWith("/api/it-hardware/tickets/")) {
    const ticketNumber = decodeURIComponent(pathname.replace("/api/it-hardware/tickets/", ""));
    sendJson(response, 200, await updateTicket(pool, request, ticketNumber, await readJsonBody(request)));
    return true;
  }

  if (request.method === "POST" && pathname === "/api/it-hardware/employees/import") {
    sendJson(response, 200, await importEmployeeCsv(pool, request, await readJsonBody(request)));
    return true;
  }

  sendJson(response, 404, { ok: false, error: "IT hardware route not found" });
  return true;
}
