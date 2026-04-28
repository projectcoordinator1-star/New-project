import { defaultDataSource } from "../data/defaultData";
import { importQpmsWorkflow } from "../utils/qpmsWorkflow";

const DATA_SOURCE_ARRAY_FIELDS = [
  "stores",
  "attendance",
  "faults",
  "ol",
  "thermography",
  "manpower",
  "cleaning",
  "attendanceDaily",
  "pendingTickets",
  "faultTickets",
  "olTickets",
  "cmpm",
];

function cloneItems(items = []) {
  return items.map((item) => ({ ...item }));
}

function normalizeDataSource(input = {}) {
  return Object.fromEntries(
    DATA_SOURCE_ARRAY_FIELDS.map((field) => [field, cloneItems(input[field] || defaultDataSource[field] || [])]),
  );
}

export function createDemoSession() {
  return {
    dataSource: normalizeDataSource(defaultDataSource),
    info: {
      mode: "demo",
      fileName: "Built-in demo dataset",
      loadedSheets: [],
      missingSheets: [],
      error: "",
    },
  };
}

export async function createUploadSession(files) {
  return importQpmsWorkflow({
    allocationFile: files.allocation,
    attendanceFile: files.attendance,
    pendingFile: files.pending,
    dashboardFile: files.dashboard,
  });
}

export function createDatabaseSession(snapshot, metadata = {}) {
  const normalizedSource = normalizeDataSource(snapshot);

  return {
    dataSource: normalizedSource,
    info: {
      mode: "database",
      fileName: metadata.connectionLabel || "QPMS pilot database",
      loadedSheets: [],
      missingSheets: [],
      error: "",
      connection: {
        database: metadata.database || "qpms_pilot",
        host: metadata.host || "localhost",
        port: metadata.port || 5432,
        status: metadata.status || "pending",
      },
      stats: {
        stores: normalizedSource.stores.length,
        attendanceImported: normalizedSource.attendanceDaily.length,
        faultTickets: normalizedSource.faultTickets.length,
        olTickets: normalizedSource.olTickets.length,
        thermography: normalizedSource.thermography.length,
        manpower: normalizedSource.manpower.length,
        cleaning: normalizedSource.cleaning.length,
        cmpm: normalizedSource.cmpm.length,
        ...(metadata.stats || {}),
      },
    },
  };
}

const BASE_URL = "http://localhost:8787";
const DB_PAGE_SIZE = 5000;

function buildParams(filters = {}) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => params.append(key, item));
    } else {
      params.append(key, value);
    }
  });

  return params;
}

async function fetchReportPage(reportKey, filters = {}) {
  const params = buildParams(filters);
  const res = await fetch(`${BASE_URL}/api/reports/${reportKey}?${params}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${reportKey}`);
  }

  const data = await res.json();

  return {
    rows: data.rows || [],
    totalRows: data.totalRows ?? data.rows?.length ?? 0,
    limit: data.limit,
    offset: data.offset,
    reportName: data.reportName,
  };
}

export async function fetchReport(reportKey, filters = {}, options = {}) {
  if (!options.all) {
    const page = await fetchReportPage(reportKey, filters);
    return page.rows;
  }

  const pageSize = options.pageSize || DB_PAGE_SIZE;
  const rows = [];
  let offset = 0;
  let totalRows = null;

  do {
    const page = await fetchReportPage(reportKey, {
      ...filters,
      limit: pageSize,
      offset,
    });

    rows.push(...page.rows);
    totalRows = page.totalRows;
    offset += page.rows.length;

    if (!page.rows.length) {
      break;
    }
  } while (totalRows === null || rows.length < totalRows);

  return rows;
}

export async function fetchReportOptions(reportKey) {
  const res = await fetch(`${BASE_URL}/api/reports/${reportKey}/options`);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${reportKey} options`);
  }

  return res.json();
}

export async function fetchDashboardBootstrap() {
  const res = await fetch(`${BASE_URL}/api/dashboard/bootstrap`);

  if (!res.ok) {
    throw new Error("Failed to fetch dashboard bootstrap");
  }

  return res.json();
}

export async function getAttendanceReport(filters = {}) {
  return fetchReport("attendance", filters);
}

async function parseJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }

  return payload;
}

export async function createMasterStore(store) {
  const response = await fetch(`${BASE_URL}/api/master/stores`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(store),
  });

  return parseJsonResponse(response, "Failed to create store");
}

export async function updateMasterStoreStatus(storeCode, status) {
  const response = await fetch(`${BASE_URL}/api/master/stores/${encodeURIComponent(storeCode)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  return parseJsonResponse(response, "Failed to update store status");
}
