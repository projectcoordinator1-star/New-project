import { getDefaultMonth } from "../utils/dashboard";
import { roundNumber } from "../utils/formatters";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();
  return text || fallback;
}

function scopedByMonth(rows = [], month) {
  if (!month) {
    return rows;
  }

  return rows.filter((row) => row.month === month || row.monthKey === month);
}

function pct(numerator, denominator) {
  return denominator ? roundNumber((numerator / denominator) * 100) : 0;
}

function buildAttendanceRows(dataSource, month) {
  return scopedByMonth(dataSource.attendanceDaily || [], month).map((row) => ({
    reportSource: "Attendance Raw",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName || row.siteCode, row.storeId),
    siteCode: cleanText(row.siteCode),
    epNo: cleanText(row.epNo),
    employeeName: cleanText(row.employeeName),
    class: cleanText(row.class, "Unknown"),
    rawStatus: cleanText(row.rawStatus, "Blank"),
    attendanceValue: roundNumber(row.attValue),
    attendanceDate: cleanText(row.attDate),
    month: cleanText(row.month),
  }));
}

function buildFaultRows(dataSource, month) {
  const sourceRows =
    dataSource.faultTickets?.length
      ? dataSource.faultTickets
      : dataSource.overallPendingTickets?.length
        ? dataSource.overallPendingTickets
        : dataSource.pendingTickets || [];

  return scopedByMonth(sourceRows, month).map((row) => ({
    reportSource: "Overall Pending",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName, row.storeId),
    ticketNumber: cleanText(row.ticketNumber),
    createdAt: cleanText(row.createdAt),
    month: cleanText(row.month),
    status: cleanText(row.status, "Blank"),
    criticality: cleanText(row.criticality, "NA"),
    breachedFlag: cleanText(row.breachedFlag, "Within SLA"),
    isOverdue: row.isOverdue ? "Yes" : "No",
    ageingDays: roundNumber(row.ageingDays),
    issueTitle: cleanText(row.issueTitle),
    category: cleanText(row.category, "Unmapped"),
    subCategory: cleanText(row.subCategory, "Unmapped"),
    workflowStage: cleanText(row.workflowStage, "Draft PO"),
    ticketCount: 1,
  }));
}

function buildOlRows(dataSource, month) {
  return scopedByMonth(dataSource.olTickets || [], month).map((row) => ({
    reportSource: "IFMS Dashboard - Split Server",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName, row.storeId),
    ticketNumber: cleanText(row.ticketNumber),
    poDate: cleanText(row.createdAt),
    month: cleanText(row.month),
    status: cleanText(row.status, "Blank"),
    docType: cleanText(row.criticality, "NA"),
    breachedFlag: cleanText(row.breachedFlag, "Within SLA"),
    isOverdue: row.isOverdue ? "Yes" : "No",
    ageingDays: roundNumber(row.ageingDays),
    articleDescription: cleanText(row.issueTitle),
    category: cleanText(row.category, "Unmapped"),
    wbsElement: cleanText(row.subCategory),
    workflowStage: cleanText(row.workflowStage, "Draft PO"),
    statusNote: cleanText(row.olStatusNote),
    activeStageCount: row.isActiveStage ? 1 : 0,
    jobCount: 1,
  }));
}

function buildDeepCleaningRows(dataSource, month) {
  return scopedByMonth(dataSource.cleaning || [], month).map((row) => ({
    reportSource: "IFMS Dashboard - Deep cleaning Activity",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName, row.storeId),
    month: cleanText(row.month),
    completed: roundNumber(row.completed),
    pending: roundNumber(row.pending),
    lastCompletedDate: cleanText(row.lastCompletedDate),
  }));
}

function buildThermographyRows(dataSource, month) {
  return scopedByMonth(dataSource.thermography || [], month).map((row) => ({
    reportSource: "IFMS Dashboard - Thermography",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName, row.storeId),
    month: cleanText(row.month),
    status: cleanText(row.status, "Blank"),
    lastInspectionDate: cleanText(row.lastInspectionDate),
    daysPending: roundNumber(row.daysPending),
    notInspectedCount: row.status === "Not Inspected" ? 1 : 0,
    inspectedCount: row.status === "Inspected" ? 1 : 0,
  }));
}

function buildManpowerRows(dataSource, month) {
  return scopedByMonth(dataSource.manpower || [], month).map((row) => ({
    reportSource: "IFMS Dashboard - Manpower Vacancy",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName, row.storeId),
    month: cleanText(row.month),
    required: roundNumber(row.required),
    deployed: roundNumber(row.deployed),
    variance: roundNumber(row.variance),
    vacancyCount: roundNumber(Math.abs(Math.min(row.variance || 0, 0))),
  }));
}

function buildCmpmRows(dataSource, month) {
  return scopedByMonth(dataSource.cmpm || [], month).map((row) => ({
    reportSource: "IFMS Dashboard - CMPM",
    state: cleanText(row.state || row.region, "Unknown"),
    region: cleanText(row.region || row.state, "Unknown"),
    location: cleanText(row.location, "Unknown"),
    storeId: cleanText(row.storeId),
    storeName: cleanText(row.storeName, row.storeId),
    storeCode: cleanText(row.storeCode || row.storeId),
    month: cleanText(row.month),
    format: cleanText(row.format, "Blank"),
    cmTask: cleanText(row.cmTask, "Blank"),
    pmStatus: cleanText(row.pmStatus, "Blank"),
    remarks: cleanText(row.remarks),
    cmCompleted: roundNumber(row.cmCompleted),
    pmCompleted: roundNumber(row.pmCompleted),
    cmPending: roundNumber(row.cmPending),
    pmPending: roundNumber(row.pmPending),
    recordCount: roundNumber(row.recordCount || 1),
  }));
}

function createSummary(rows, measureKey, measureLabel) {
  const total = rows.reduce((sum, row) => sum + Number(row[measureKey] || 0), 0);
  return {
    records: rows.length,
    total,
    measureLabel,
  };
}

function createReport({ id, name, description, sourceLabel, rows, tableColumns, exportOptions = ["excel", "pdf"] }) {
  const summary = createSummary(rows, tableColumns.find((column) => column.measure)?.key || tableColumns[0]?.key, "Preview");

  return {
    id,
    name,
    description,
    sourceLabel,
    rows,
    tableColumns,
    exportOptions,
    filters: [],
    summary,
  };
}

export function buildReportCatalog(dataSource, activeMonth) {
  const month = activeMonth || getDefaultMonth(dataSource);
  const attendanceRows = buildAttendanceRows(dataSource, month);
  const faultRows = buildFaultRows(dataSource, month);
  const olRows = buildOlRows(dataSource, month);
  const deepCleaningRows = buildDeepCleaningRows(dataSource, month);
  const thermographyRows = buildThermographyRows(dataSource, month);
  const manpowerRows = buildManpowerRows(dataSource, month);
  const cmpmRows = buildCmpmRows(dataSource, month);

  return [
    createReport({
      id: "attendance-raw",
      name: "Attendance Raw Report",
      description: "Pivot directly from the Attendance Raw upload in Data Sync.",
      sourceLabel: "Attendance Raw",
      rows: attendanceRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "siteCode", label: "Site Code" },
        { key: "class", label: "Class" },
        { key: "rawStatus", label: "Att. Status" },
        { key: "attendanceDate", label: "Att. Date" },
        { key: "attendanceValue", label: "Att Value", measure: true },
        { key: "epNo", label: "EP No" },
        { key: "employeeName", label: "Employee" },
      ],
    }),
    createReport({
      id: "fault-report",
      name: "Fault Report",
      description: "Pivot from the Overall Pending upload only.",
      sourceLabel: "Overall Pending",
      rows: faultRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "ticketNumber", label: "Ticket Number" },
        { key: "status", label: "Status" },
        { key: "criticality", label: "Criticality" },
        { key: "workflowStage", label: "Stage" },
        { key: "ageingDays", label: "Ageing Days", measure: true },
        { key: "ticketCount", label: "Ticket Count", type: "number" },
        { key: "category", label: "Category" },
        { key: "issueTitle", label: "Issue Title" },
      ],
    }),
    createReport({
      id: "ol-split-server",
      name: "OL Report - Split Server",
      description: "Pivot from IFMS Dashboard, Split Server sheet.",
      sourceLabel: "IFMS Dashboard / Split Server",
      rows: olRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "ticketNumber", label: "PO / Item" },
        { key: "workflowStage", label: "Stage" },
        { key: "status", label: "Status" },
        { key: "docType", label: "Doc Type" },
        { key: "ageingDays", label: "Ageing Days", measure: true },
        { key: "activeStageCount", label: "Active Stage Count", type: "number" },
        { key: "articleDescription", label: "Article Description" },
        { key: "statusNote", label: "Status Note" },
      ],
    }),
    createReport({
      id: "deep-cleaning",
      name: "Deep Cleaning Report",
      description: "Pivot from IFMS Dashboard, Deep cleaning Activity sheet.",
      sourceLabel: "IFMS Dashboard / Deep cleaning Activity",
      rows: deepCleaningRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "month", label: "Month" },
        { key: "completed", label: "Completed", measure: true },
        { key: "pending", label: "Pending", type: "number" },
        { key: "lastCompletedDate", label: "Last Completed Date" },
      ],
    }),
    createReport({
      id: "thermography",
      name: "Thermography Report",
      description: "Pivot from IFMS Dashboard, Thermography sheet.",
      sourceLabel: "IFMS Dashboard / Thermography",
      rows: thermographyRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "status", label: "Status" },
        { key: "daysPending", label: "Days Pending", measure: true },
        { key: "notInspectedCount", label: "Not Inspected Count", type: "number" },
        { key: "inspectedCount", label: "Inspected Count", type: "number" },
        { key: "lastInspectionDate", label: "Last Inspection Date" },
      ],
    }),
    createReport({
      id: "cmpm",
      name: "CMPM Report",
      description: "Pivot from IFMS Dashboard, CMPM sheet.",
      sourceLabel: "IFMS Dashboard / CMPM",
      rows: cmpmRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "storeCode", label: "Store Code" },
        { key: "format", label: "Format" },
        { key: "cmTask", label: "CM Task" },
        { key: "pmStatus", label: "PM Status" },
        { key: "cmCompleted", label: "CM Completed", measure: true },
        { key: "pmCompleted", label: "PM Completed", type: "number" },
        { key: "cmPending", label: "CM Pending", type: "number" },
        { key: "pmPending", label: "PM Pending", type: "number" },
        { key: "recordCount", label: "Record Count", type: "number" },
        { key: "remarks", label: "Remarks" },
      ],
    }),
    createReport({
      id: "manpower",
      name: "Manpower Report",
      description: "Pivot from IFMS Dashboard, Manpower Vacancy sheet.",
      sourceLabel: "IFMS Dashboard / Manpower Vacancy",
      rows: manpowerRows,
      tableColumns: [
        { key: "state", label: "State" },
        { key: "storeName", label: "Store" },
        { key: "required", label: "Required", measure: true },
        { key: "deployed", label: "Deployed", type: "number" },
        { key: "variance", label: "Variance", type: "number" },
        { key: "vacancyCount", label: "Vacancy Count", type: "number" },
      ],
    }),
  ];
}

export function createInitialReportFilters(reportConfig) {
  return Object.fromEntries((reportConfig.filters || []).map((filter) => [filter.id, filter.defaultValue ?? ""]));
}

export function countReportFilters(filterValues, filterDefinitions = []) {
  return filterDefinitions.reduce((count, filter) => {
    const value = filterValues?.[filter.id];
    return value && value !== filter.defaultValue ? count + 1 : count;
  }, 0);
}

export function runConfiguredReport(reportConfig) {
  const rows = reportConfig.rows || [];
  return {
    title: reportConfig.name,
    subtitle: reportConfig.description,
    filterSummary: [],
    summaryCards: [
      { label: "Records", value: rows.length, note: reportConfig.sourceLabel, tone: "blue" },
      {
        label: "Stores",
        value: new Set(rows.map((row) => row.storeId).filter(Boolean)).size,
        note: "Unique stores in source",
        tone: "green",
      },
      {
        label: "Source",
        value: reportConfig.sourceLabel,
        note: "Data Sync mapping",
        tone: "amber",
      },
      {
        label: "Month",
        value: rows[0]?.month || "No rows",
        note: "Selected working month",
        tone: "purple",
      },
    ],
    chart: null,
    table: {
      columns: reportConfig.tableColumns,
      rows,
    },
    beforeAfter: null,
    exportOptions: reportConfig.exportOptions,
  };
}
