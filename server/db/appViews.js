const APP_SCHEMA = "qpms_app";
const MASTER_SCHEMA = "qpms_master";
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 5000;
const OPTION_LIMIT = 100;

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function relationRef(relationName, schemaName = APP_SCHEMA) {
  return `${quoteIdentifier(schemaName)}.${quoteIdentifier(relationName)}`;
}

function compactValues(values) {
  return values.map((value) => String(value || "").trim()).filter((value) => value && value.toLowerCase() !== "all");
}

function getParamValues(searchParams, key) {
  return searchParams
    .getAll(key)
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim());
}

function toPositiveInt(value, fallback, max = MAX_LIMIT) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

function toNonNegativeInt(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

const REPORT_DEFINITIONS = {
  stores: {
    label: "Official Store Master",
    schema: MASTER_SCHEMA,
    view: "stores",
    defaultLimit: 1000,
    filters: {
      state: "state",
      storeId: "store_code",
      server: "server",
      business: "business",
      status: "status",
    },
    searchColumns: ["store_code", "state", "server", "business", "status"],
    orderBy: ["state", "store_code"],
  },
  attendance: {
    label: "Attendance Raw",
    view: "attendance_raw",
    filters: {
      month: "month_key",
      state: "state_group",
      storeId: "store_id",
      class: "class_code",
      employee: "ep_no",
    },
    searchColumns: ["ep_no", "employee_name", "manager_name", "store_id", "store_name", "state_group"],
    orderBy: ["attendance_date", "state_group", "store_id"],
  },
  "attendance-summary": {
    label: "Attendance Summary by State",
    view: "attendance_summary_state",
    defaultLimit: 1000,
    filters: {
      month: "month_key",
      state: "state_group",
      class: "class_code",
    },
    searchColumns: ["month_key", "state_group", "class_code"],
    orderBy: ["month_key", "state_group", "class_code"],
  },
  faults: {
    label: "Fault Report",
    view: "fault_report",
    filters: {
      month: "month_key",
      state: "state_group",
      storeId: "store_id",
      status: "status",
      criticality: "criticality",
      category: "category",
    },
    searchColumns: ["ticket_number", "store_id", "store_name", "city", "issue_title", "manager_name", "afm_name"],
    orderBy: ["state_group", "store_id", "ticket_number"],
  },
  ol: {
    label: "OL Split Server",
    view: "ol_split_server",
    filters: {
      month: "month_key",
      state: "state_group",
      storeId: "store_id",
      server: "server",
      vendor: "vendor_name",
      poNumber: "po_number",
      setoffStatus: "setoff_status",
    },
    searchColumns: ["po_number", "store_id", "site", "vendor_name", "article_description", "remark", "additional_remark"],
    orderBy: ["state_group", "store_id", "po_number", "item_no"],
  },
  cmpm: {
    label: "CMPM Report",
    view: "cmpm_report",
    defaultLimit: 1000,
    filters: {
      state: "state_group",
      storeId: "store_id",
      format: "format_name",
      cmTask: "cm_task",
      pmStatus: "pm_status",
    },
    searchColumns: ["store_id", "store_name", "state_group", "cm_task", "pm_status", "remarks"],
    orderBy: ["state_group", "store_id"],
  },
  thermography: {
    label: "Thermography Report",
    view: "thermography_report",
    defaultLimit: 1000,
    filters: {
      state: "state_group",
      storeId: "store_id",
      status: "inspection_status",
      reportStatus: "report_status",
    },
    searchColumns: ["store_id", "store_name", "state_group", "inspection_status", "report_status"],
    orderBy: ["state_group", "store_id"],
  },
  "deep-cleaning": {
    label: "Deep Cleaning Report",
    view: "deep_cleaning_report",
    defaultLimit: 1000,
    filters: {
      state: "state_group",
      storeId: "store_id",
      status: "cleaning_status",
      frequency: "frequency",
    },
    searchColumns: ["store_id", "store_name", "state_group", "frequency", "cleaning_status", "remark"],
    orderBy: ["state_group", "store_id"],
  },
  manpower: {
    label: "Manpower Vacancy",
    view: "manpower_vacancy",
    defaultLimit: 1000,
    filters: {
      state: "state_group",
      storeId: "store_id",
      position: "position_name",
    },
    searchColumns: ["store_id", "state_group", "position_name", "remark"],
    orderBy: ["state_group", "store_id", "position_name"],
  },
  "data-sync-health": {
    label: "Data Sync Health",
    view: "data_sync_health",
    defaultLimit: 200,
    filters: {
      source: "source_name",
      file: "file_name",
      sheet: "sheet_name",
    },
    searchColumns: ["source_name", "file_name", "sheet_name", "raw_table_name"],
    orderBy: ["imported_at", "sheet_name"],
  },
};

const REPORT_ALIASES = {
  fault: "faults",
  "fault-report": "faults",
  "ol-report": "ol",
  "split-server": "ol",
  "cmpm-report": "cmpm",
  thermo: "thermography",
  "deepcleaning": "deep-cleaning",
  "deep-cleaning-report": "deep-cleaning",
  "manpower-vacancy": "manpower",
  health: "data-sync-health",
};

function normalizeReportKey(reportKey) {
  const normalized = String(reportKey || "").trim().toLowerCase();
  return REPORT_ALIASES[normalized] || normalized;
}

function getReportDefinition(reportKey) {
  const canonicalKey = normalizeReportKey(reportKey);
  const definition = REPORT_DEFINITIONS[canonicalKey];

  if (!definition) {
    const validReports = Object.keys(REPORT_DEFINITIONS);
    const error = new Error(`Unknown report "${reportKey}". Valid reports: ${validReports.join(", ")}`);
    error.statusCode = 404;
    throw error;
  }

  return { key: canonicalKey, ...definition };
}

function buildWhereClause(definition, searchParams) {
  const clauses = [];
  const params = [];
  const appliedFilters = {};

  for (const [paramName, columnName] of Object.entries(definition.filters || {})) {
    const values = compactValues(getParamValues(searchParams, paramName));
    if (!values.length) {
      continue;
    }

    params.push(values);
    clauses.push(`${quoteIdentifier(columnName)}::text = any($${params.length}::text[])`);
    appliedFilters[paramName] = values;
  }

  const searchText = String(searchParams.get("q") || searchParams.get("search") || "").trim();
  if (searchText && definition.searchColumns?.length) {
    params.push(`%${searchText}%`);
    const placeholder = `$${params.length}`;
    const searchSql = definition.searchColumns.map((columnName) => `${quoteIdentifier(columnName)}::text ilike ${placeholder}`).join(" or ");
    clauses.push(`(${searchSql})`);
    appliedFilters.search = searchText;
  }

  return {
    appliedFilters,
    params,
    whereSql: clauses.length ? `where ${clauses.join(" and ")}` : "",
  };
}

function buildOrderBy(definition) {
  if (!definition.orderBy?.length) {
    return "";
  }

  const direction = definition.key === "data-sync-health" ? "desc" : "asc";
  const columns = definition.orderBy.map((columnName) => `${quoteIdentifier(columnName)} ${direction} nulls last`);
  return `order by ${columns.join(", ")}`;
}

export function getReportCatalog() {
  return Object.entries(REPORT_DEFINITIONS).map(([key, definition]) => ({
    key,
    label: definition.label,
    filters: Object.keys(definition.filters || {}),
    searchColumns: definition.searchColumns || [],
  }));
}

export async function fetchReportRows(pool, reportKey, searchParams = new URLSearchParams()) {
  const definition = getReportDefinition(reportKey);
  const limit = toPositiveInt(searchParams.get("limit"), definition.defaultLimit || DEFAULT_LIMIT, definition.maxLimit || MAX_LIMIT);
  const offset = toNonNegativeInt(searchParams.get("offset"));
  const { appliedFilters, params, whereSql } = buildWhereClause(definition, searchParams);
  const orderSql = buildOrderBy(definition);
  const countSql = `select count(*)::int as total_count from ${relationRef(definition.view, definition.schema)} ${whereSql}`;
  const dataSql = `
    select *
    from ${relationRef(definition.view, definition.schema)}
    ${whereSql}
    ${orderSql}
    limit $${params.length + 1}
    offset $${params.length + 2}
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countSql, params),
    pool.query(dataSql, [...params, limit, offset]),
  ]);

  return {
    ok: true,
    reportKey: definition.key,
    reportName: definition.label,
    totalRows: countResult.rows[0]?.total_count || 0,
    limit,
    offset,
    appliedFilters,
    rows: dataResult.rows,
  };
}

export async function fetchReportFilterOptions(pool, reportKey) {
  const definition = getReportDefinition(reportKey);
  const options = {};

  for (const [filterKey, columnName] of Object.entries(definition.filters || {})) {
    const result = await pool.query(
      `
        select ${quoteIdentifier(columnName)}::text as value, count(*)::int as count
        from ${relationRef(definition.view, definition.schema)}
        where nullif(${quoteIdentifier(columnName)}::text, '') is not null
        group by ${quoteIdentifier(columnName)}
        order by count desc, value asc
        limit $1
      `,
      [OPTION_LIMIT],
    );
    options[filterKey] = result.rows;
  }

  return {
    ok: true,
    reportKey: definition.key,
    reportName: definition.label,
    options,
  };
}

export async function fetchDashboardBootstrap(pool) {
  const countQueries = [
    ["stores", "stores", MASTER_SCHEMA],
    ["attendanceRows", "attendance_raw", APP_SCHEMA],
    ["attendanceSummaryRows", "attendance_summary_state", APP_SCHEMA],
    ["faults", "fault_report", APP_SCHEMA],
    ["olItems", "ol_split_server", APP_SCHEMA],
    ["cmpmRows", "cmpm_report", APP_SCHEMA],
    ["thermographyRows", "thermography_report", APP_SCHEMA],
    ["deepCleaningRows", "deep_cleaning_report", APP_SCHEMA],
    ["manpowerRows", "manpower_vacancy", APP_SCHEMA],
  ].map(async ([key, relationName, schemaName]) => {
    const result = await pool.query(`select count(*)::int as count from ${relationRef(relationName, schemaName)}`);
    return [key, result.rows[0]?.count || 0];
  });

  const [countEntries, latestImports] = await Promise.all([
    Promise.all(countQueries),
    pool.query(`
      select source_name, file_name, sheet_name, sheet_row_count, column_count, imported_at
      from ${relationRef("data_sync_health")}
      order by imported_at desc nulls last, sheet_name asc
      limit 25
    `),
  ]);

  return {
    ok: true,
    database: process.env.PGDATABASE || "qpms_dashboard",
    generatedAt: new Date().toISOString(),
    reports: getReportCatalog(),
    counts: Object.fromEntries(countEntries),
    latestImports: latestImports.rows,
  };
}
