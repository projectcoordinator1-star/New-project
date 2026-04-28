import http from "node:http";
import { loadLocalEnv } from "./env.js";
import { createPool, importWorkbookToRawDb } from "./db/rawImport.js";
import { fetchDashboardBootstrap, fetchReportFilterOptions, fetchReportRows, getReportCatalog } from "./db/appViews.js";
import { createMasterStore, updateMasterStoreStatus } from "./db/masterStores.js";

loadLocalEnv();

const PORT = Number(process.env.QPMS_DB_API_PORT || 8787);
const pool = createPool();

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "http://localhost:5173",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const pathname = requestUrl.pathname;

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      await pool.query("select 1");
      sendJson(response, 200, {
        ok: true,
        database: process.env.PGDATABASE || "qpms_dashboard",
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/dashboard/bootstrap") {
      const result = await fetchDashboardBootstrap(pool);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && pathname === "/api/reports") {
      sendJson(response, 200, {
        ok: true,
        reports: getReportCatalog(),
      });
      return;
    }

    if (request.method === "GET" && pathname.startsWith("/api/reports/")) {
      const [, reportKey, action] = pathname.match(/^\/api\/reports\/([^/]+)(?:\/([^/]+))?$/) || [];

      if (reportKey && action === "options") {
        const result = await fetchReportFilterOptions(pool, reportKey);
        sendJson(response, 200, result);
        return;
      }

      if (reportKey && !action) {
        const result = await fetchReportRows(pool, reportKey, requestUrl.searchParams);
        sendJson(response, 200, result);
        return;
      }
    }

    if (request.method === "POST" && pathname === "/api/master/stores") {
      const payload = await readJsonBody(request);
      const result = await createMasterStore(pool, payload);
      sendJson(response, 201, result);
      return;
    }

    if (request.method === "PATCH" && pathname.startsWith("/api/master/stores/")) {
      const storeCode = decodeURIComponent(pathname.replace("/api/master/stores/", ""));
      const payload = await readJsonBody(request);
      const result = await updateMasterStoreStatus(pool, storeCode, payload);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "POST" && pathname === "/api/raw-import") {
      const payload = await readJsonBody(request);
      const result = await importWorkbookToRawDb(pool, payload);
      sendJson(response, 200, result);
      return;
    }

    sendJson(response, 404, {
      ok: false,
      error: "Route not found",
    });
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      ok: false,
      error: error.message || "Unexpected server error",
    });
  }
});

server.listen(PORT, () => {
  console.log(`QPMS DB API running on http://localhost:${PORT}`);
});
