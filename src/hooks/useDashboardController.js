import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_MONTHS,
  buildAttendanceSummary,
  buildPivotRows,
  buildTrendSnapshot,
  calculateKpis,
  createUnifiedDataset,
  filterUnifiedData,
  formatMonthLabel,
  getAvailableMonths,
  getDataSourceSummary,
  getFilterOptions,
  getAttendanceAvailableDates,
  isAllMonthsValue,
  viewMeta,
  viewReportTypeMap,
} from "../utils/dashboard";
import { canRoleEditStage, canRoleSeeStage, getRoleConfig, getStageIndex } from "../utils/workflowRoles";
import { WORKFLOW_STAGES } from "../utils/qpmsWorkflow";
import {
  createMasterStore,
  createDemoSession,
  createUploadSession,
  fetchReport,
  fetchDashboardBootstrap,
  updateMasterStoreDetails,
  updateMasterStoreStatus,
} from "../services/dashboardGateway";
import { syncFilesToRawDatabase } from "../services/rawDatabaseSync";
import { updateFaultRemark } from "../services/workflowService";

const FILTERABLE_VIEWS = [
  "dashboard",
  "attendance",
  "faults",
  "ol",
  "thermography",
  "manpower",
  "cleaning",
  "cmpm",
  "stores",
];
const FAULT_DELAY_THRESHOLD_DAYS = 2;
const INITIAL_DB_FETCH_LIMIT = 5000;
const REPORT_MONTH_LOOKBACK = 12;
const MONTH_LOOKUP = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
};

function readStoredValue(key, fallback) {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;

  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function getArray(dataSource, key) {
  return Array.isArray(dataSource?.[key]) ? dataSource[key] : [];
}

function uniqueMonths(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => right.localeCompare(left));
}

function getCurrentMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function getPreferredMonth(months) {
  const currentMonth = getCurrentMonthKey();
  return months.includes(currentMonth) ? currentMonth : months[0] || currentMonth;
}

function getCurrentAndPreviousMonths(date = new Date(), lookback = REPORT_MONTH_LOOKBACK) {
  return Array.from({ length: lookback + 1 }, (_, offset) => {
    const monthDate = new Date(date.getFullYear(), date.getMonth() - offset, 1);
    return getCurrentMonthKey(monthDate);
  });
}

function getReportMonthsForView() {
  return getCurrentAndPreviousMonths();
}

function getAvailableMonthsForView(dataSource, view) {
  if (view === "attendance") {
    const attendanceMonths = uniqueMonths(
      [...getArray(dataSource, "attendanceDaily"), ...getArray(dataSource, "attendance")].map((item) => item.month),
    );
    return attendanceMonths.length ? attendanceMonths : [getPreferredMonth(getAvailableMonths(dataSource))];
  }

  if (view === "dashboard") {
    return [ALL_MONTHS, ...getAvailableMonths(dataSource)];
  }

  if (view === "faults" || view === "ol") {
    return [ALL_MONTHS, ...getReportMonthsForView(dataSource, view)];
  }

  return getAvailableMonths(dataSource);
}

function createInitialFilters(dataSource, view = "dashboard") {
  const months = getAvailableMonthsForView(dataSource, view);
  const preferredMonths = view === "dashboard" ? months.filter((month) => !isAllMonthsValue(month)) : months;

  return {
    month: view === "faults" || view === "ol" ? ALL_MONTHS : getPreferredMonth(preferredMonths.length ? preferredMonths : months),
    region: "All",
    location: "All",
    storeId: "All",
    status: "All",
    reportType: "All Reports",
    search: "",
  };
}

function createInitialViewFilters(dataSource) {
  return Object.fromEntries(FILTERABLE_VIEWS.map((view) => [view, createInitialFilters(dataSource, view)]));
}

function countActiveFilters(filters, activeView) {
  let count = 0;

  if (filters.region !== "All") count += 1;
  if (filters.location !== "All") count += 1;
  if (filters.storeId !== "All") count += 1;
  if (filters.status !== "All") count += 1;
  if (activeView === "dashboard" && filters.reportType !== "All Reports") count += 1;
  if (filters.search.trim()) count += 1;

  return count;
}

function toNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : fallback;
}

function cleanText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function cleanCode(value) {
  return cleanText(value).toUpperCase();
}

function hashCode(value) {
  let hash = 0;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function getMonthFromDate(value, fallback = "Unknown") {
  if (!value) return fallback;

  const text = String(value);

  if (/^\d{4}-\d{2}/.test(text)) {
    return text.slice(0, 7);
  }

  const parts = text.split(/[/. -]/).filter(Boolean);

  if (parts.length >= 3) {
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    const month = parts[1].padStart(2, "0");
    return `${year}-${month}`;
  }

  return fallback;
}

function normalizeMonthKey(value, fallback = "") {
  const text = cleanText(value);
  if (!text) return fallback;

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 7);
  }

  const monthMatch = text.match(/^([A-Za-z]{3,9})[-\s']?(\d{2,4})$/);
  if (monthMatch) {
    const monthToken = monthMatch[1].slice(0, 3).toUpperCase();
    const monthNumber = MONTH_LOOKUP[monthToken];
    if (!monthNumber) {
      return fallback;
    }

    const yearText = monthMatch[2];
    const year = yearText.length === 2 ? `20${yearText}` : yearText;
    return `${year}-${String(monthNumber).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }

  return getMonthFromDate(text, fallback);
}

function toIsoDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeDateValue(value, fallback = "") {
  const text = cleanText(value);
  if (!text) return fallback;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const dmyMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  const monthTextMatch = text.match(/^([A-Za-z]{3,9})[-\s']?(\d{2,4})$/);
  if (monthTextMatch) {
    const monthToken = monthTextMatch[1].slice(0, 3).toUpperCase();
    const monthNumber = MONTH_LOOKUP[monthToken];
    if (monthNumber) {
      const yearText = monthTextMatch[2];
      const year = yearText.length === 2 ? `20${yearText}` : yearText;
      return `${year}-${String(monthNumber).padStart(2, "0")}-01`;
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? fallback : toIsoDateString(parsed);
}

function shiftDateByDays(dateValue, dayCount) {
  const normalized = normalizeDateValue(dateValue);
  if (!normalized) return "";

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";

  parsed.setDate(parsed.getDate() + dayCount);
  return toIsoDateString(parsed);
}

function parseNumericField(value) {
  const text = cleanText(value);
  if (!text) {
    return {
      isBlank: true,
      isValid: false,
      value: 0,
    };
  }

  const normalized = Number(text.replace(/,/g, ""));
  if (Number.isFinite(normalized)) {
    return {
      isBlank: false,
      isValid: true,
      value: normalized,
    };
  }

  const numericMatch = text.match(/-?\d+(?:\.\d+)?/);
  if (numericMatch) {
    return {
      isBlank: false,
      isValid: true,
      value: Number(numericMatch[0]),
    };
  }

  return {
    isBlank: false,
    isValid: false,
    value: 0,
  };
}

function getLatestFaultImportMeta(bootstrap = null) {
  const latestFaultImport = (bootstrap?.latestImports || []).find(
    (item) => item.sheet_name === "Fault Report" || item.raw_table_name === "IFMS Dashboard.xlsx - Fault Report",
  );
  const importedAt = normalizeDateValue(latestFaultImport?.imported_at || bootstrap?.generatedAt, "");

  return {
    importedAt,
    importMonth: normalizeMonthKey(importedAt, ""),
  };
}

function fetchStartupReport(reportKey) {
  return fetchReport(reportKey, { limit: INITIAL_DB_FETCH_LIMIT }, { includeCount: false });
}

function buildFaultTicketRow(row, importMeta = {}) {
  const monthFromColumn = normalizeMonthKey(row.month_key || row.month, "");
  const createdAt = normalizeDateValue(row.created_at, "");
  const monthFromCreatedAt = normalizeMonthKey(createdAt, "");
  const reportDate = normalizeDateValue(row.report_date || row.as_of_date || importMeta.importedAt, "");
  const ageingInfo = parseNumericField(row.ageing_days ?? row.ageing_text);
  const ageingDays = ageingInfo.isValid ? ageingInfo.value : 0;
  const inferredCreatedAt = reportDate && ageingInfo.isValid ? shiftDateByDays(reportDate, -Math.round(ageingDays)) : "";
  const monthFromReportDate = normalizeMonthKey(inferredCreatedAt, "");
  const importMonth = normalizeMonthKey(row.imported_at || importMeta.importMonth || importMeta.importedAt, "");
  const month = monthFromColumn || monthFromCreatedAt || monthFromReportDate || importMonth;
  const statusCode = cleanCode(row.status);
  const breached = cleanCode(row.breached_flag) === "BREACHED";
  const critical = breached || cleanCode(row.criticality) === "C";
  const pending = statusCode !== "COMPLETED" && statusCode !== "CLOSED";
  const delayed = breached || ageingDays > FAULT_DELAY_THRESHOLD_DAYS;

  let dashboardExclusionReason = "";
  if (!cleanText(row.store_id)) {
    dashboardExclusionReason = "missing_store_id";
  } else if (!month) {
    if (cleanText(row.created_at) && !createdAt) {
      dashboardExclusionReason = "invalid_created_at";
    } else if (!ageingInfo.isBlank && !ageingInfo.isValid) {
      dashboardExclusionReason = "invalid_ageing";
    } else {
      dashboardExclusionReason = "missing_month_key";
    }
  }

  return {
    ...row,
    storeId: row.store_id || "",
    storeName: row.store_name || row.store_id || "Unknown Store",
    location: row.city || row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month,
    monthSource: monthFromColumn
      ? "month"
      : monthFromCreatedAt
        ? "created_at"
        : monthFromReportDate
          ? "report_date_minus_ageing"
          : importMonth
            ? "import_month"
            : "",
    ticketNumber: row.ticket_number || "",
    createdAt: createdAt || inferredCreatedAt || "",
    reportDate,
    asOfDate: reportDate,
    importMonth,
    status: row.status || "",
    statusNote: cleanText(row.status_note || row.status__2),
    criticality: row.criticality || "",
    ageingDays,
    breachedFlag: row.breached_flag || "",
    isOverdue: delayed,
    issueTitle: row.issue_title || "",
    category: row.category || "",
    subCategory: row.sub_category || "",
    issueType: row.issue_type || "",
    workflowStage: inferFaultWorkflowStage(row),
    pendingFaults: pending ? 1 : 0,
    delayedJobs: delayed ? 1 : 0,
    totalFaults: 1,
    remark: "",
    isDashboardIncluded: !dashboardExclusionReason,
    dashboardExclusionReason,
  };
}

function aggregateFaultTickets(ticketRows = []) {
  const grouped = new Map();

  ticketRows
    .filter((row) => row.isDashboardIncluded)
    .forEach((row) => {
      const key = `${row.storeId}|${row.month}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          storeId: row.storeId,
          storeName: row.storeName,
          location: row.location,
          region: row.region,
          state: row.state,
          month: row.month,
          totalFaults: 0,
          pendingFaults: 0,
          delayedJobs: 0,
          hasCritical: false,
        });
      }

      const current = grouped.get(key);
      current.totalFaults += 1;
      current.pendingFaults += row.pendingFaults;
      current.delayedJobs += row.delayedJobs;
      current.hasCritical = current.hasCritical || cleanCode(row.breachedFlag) === "BREACHED" || cleanCode(row.criticality) === "C";
    });

  return Array.from(grouped.values()).map((item) => ({
    storeId: item.storeId,
    storeName: item.storeName,
    location: item.location,
    region: item.region,
    state: item.state,
    month: item.month,
    totalFaults: item.totalFaults,
    pendingFaults: item.pendingFaults,
    delayedJobs: item.delayedJobs,
    status: item.hasCritical ? "Critical" : item.delayedJobs > 0 ? "Attention" : "Controlled",
  }));
}

function buildFaultValidation(ticketRows = [], groupedRows = [], importMeta = {}) {
  const excludedReasons = {
    missing_store_id: 0,
    missing_month_key: 0,
    invalid_created_at: 0,
    invalid_ageing: 0,
    status_excluded: 0,
  };

  let includedRowCount = 0;
  ticketRows.forEach((row) => {
    if (row.dashboardExclusionReason) {
      excludedReasons[row.dashboardExclusionReason] += 1;
      return;
    }

    includedRowCount += 1;
  });

  return {
    importedDbRowCount: ticketRows.length,
    includedRowCount,
    excludedRowCount: ticketRows.length - includedRowCount,
    groupedRowCount: groupedRows.length,
    groupedTotalFaults: groupedRows.reduce((sum, row) => sum + row.totalFaults, 0),
    excludedReasons,
    importMonth: importMeta.importMonth || "",
    importDate: importMeta.importedAt || "",
  };
}

function getDateDiffInDays(dateValue) {
  if (!dateValue) return 0;

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 0;

  const today = new Date();
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(Math.round((end - start) / 86400000), 0);
}

function getLatestMonthFromRows(...collections) {
  const months = collections
    .flat()
    .map(
      (item) =>
        item?.month_key ||
        item?.month ||
        getMonthFromDate(item?.po_date || item?.created_at || item?.report_date || item?.as_of_date, ""),
    )
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left));

  return months[0] || "2026-04";
}

function inferFaultWorkflowStage(row) {
  const ageingDays = toNumber(row.ageing_days);
  const criticality = cleanCode(row.criticality);
  const breached = cleanCode(row.breached_flag) === "BREACHED";
  const status = cleanCode(row.status);
  const title = cleanCode(row.issue_title);
  const seed = hashCode(`${row.ticket_number}|${row.store_id}`);

  if (status.includes("DELETE") || title.includes("DELETE")) return WORKFLOW_STAGES[10];
  if (status.includes("CANCEL")) return WORKFLOW_STAGES[9];
  if (ageingDays >= 240) return WORKFLOW_STAGES[7 + (seed % 2)];
  if (ageingDays >= 180) return WORKFLOW_STAGES[5 + (seed % 3)];
  if (ageingDays >= 120) return WORKFLOW_STAGES[3 + (seed % 3)];
  if (ageingDays >= 90) return WORKFLOW_STAGES[2 + (seed % 3)];
  if (breached || criticality === "C") return WORKFLOW_STAGES[1 + (seed % 2)];

  return WORKFLOW_STAGES[0];
}

function inferOlWorkflowStage(row) {
  const stageText = [row.remark, row.additional_remark, row.setoff_status]
    .map(cleanCode)
    .filter(Boolean)
    .join(" | ");

  if (stageText.includes("NEED TO DELETE") || stageText.includes("PO TO BE DELETE")) return WORKFLOW_STAGES[10];
  if (stageText.includes("PO DELETED")) return WORKFLOW_STAGES[9];
  if (stageText.includes("PAYMENT RECEIVED")) return WORKFLOW_STAGES[8];
  if (stageText.includes("INVOICE PROCESSED") || stageText.includes("INVOICE UPLOADED") || stageText.includes("SETOFF")) {
    return WORKFLOW_STAGES[7];
  }
  if (stageText.includes("JMS IN PROGRESS") || stageText.includes("JMS DONE")) return WORKFLOW_STAGES[6];
  if (stageText.includes("CERTIFICATION DONE") || stageText.includes("PENDING FOR JMS CREATION")) return WORKFLOW_STAGES[5];
  if (stageText.includes("AFM") || stageText.includes("CERTIFICATION PENDING")) return WORKFLOW_STAGES[4];
  if (stageText.includes("DOCUMENT PENDING") || stageText.includes("WCC PENDING") || stageText.includes("OOS - DOCUMENT")) {
    return WORKFLOW_STAGES[3];
  }
  if (stageText.includes("WORK COMPLETED")) return WORKFLOW_STAGES[2];
  if (stageText.includes("WIP") || stageText.includes("WORK IN PROGRESS") || stageText.includes("WORK YET TO START")) {
    return WORKFLOW_STAGES[1];
  }
  if (
    stageText.includes("DRAFT PO") ||
    stageText.includes("FUND REQUEST PENDING") ||
    stageText.includes("FUND PENDING") ||
    cleanCode(row.release_indicator) === "D"
  ) {
    return WORKFLOW_STAGES[0];
  }
  if (toNumber(row.invoice_value) > 0) return WORKFLOW_STAGES[7];
  if (cleanCode(row.delivery_complete_indicator) === "X" || toNumber(row.grn_value) > 0) return WORKFLOW_STAGES[2];

  return WORKFLOW_STAGES[0];
}

function mapStoreMasterRow(row = {}) {
  return {
    storeId: row.store_code || row.store_id,
    storeName: row.business || row.store_name || row.store_code || row.store_id,
    location: row.state || row.location || row.city || row.state_group || "Unknown",
    region: row.state || row.state_group || "Unknown",
    state: row.state || row.state_group || "Unknown",
    openedDate: null,
    closedDate: null,
    server: row.server || "",
    business: row.business || "",
    status: row.status || "Active",
    format: row.business || row.format_name,
    hkAopCount: 0,
    mepcAopCount: 0,
  };
}

function mapAttendanceSummaryRows(rows = []) {
  return rows.map((row) => {
    const total = toNumber(row.total_rows || row.employee_rows || row.total);
    const present = toNumber(row.present_rows || row.present);
    const absent = Math.max(total - present, 0);

    return {
      storeId: row.store_id || row.storeId || "Unknown",
      storeName: row.store_name || row.storeName || "Unknown Store",
      month: row.month_key || row.month || "Unknown",
      presentPct: total ? Math.round((present / total) * 100) : 0,
      absentPct: total ? Math.round((absent / total) * 100) : 0,
      manpowerOnRoll: toNumber(row.employee_count || row.manpower_on_roll),
      mandays: Number(toNumber(row.mandays).toFixed(2)),
    };
  });
}

function mapAttendanceDailyRows(rows = []) {
  return rows.map((row) => ({
    storeId: row.store_id,
    storeName: row.store_name,
    location: row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month: row.month_key || row.attendance_date?.slice(0, 7),
    attDate: row.attendance_date,
    epNo: row.ep_no,
    employeeName: row.employee_name,
    managerName: row.manager_name,
    managerCode: row.manager_code,
    class: row.class_code || "Unknown",
    rawStatus: row.raw_status,
    attValue: toNumber(row.attendance_value),
    present: toNumber(row.attendance_value) > 0,
    inTime: row.in_time,
    outTime: row.out_time,
    manHours: row.man_hours,
  }));
}

function buildOlTicketRow(row = {}) {
  const workflowStage = inferOlWorkflowStage(row);
  const stageIndex = WORKFLOW_STAGES.indexOf(workflowStage);
  const isActiveStage = stageIndex >= 0 && stageIndex < 8;
  const ageingDays = getDateDiffInDays(row.po_date);

  return {
    storeId: row.store_id,
    storeName: row.site || row.store_name || row.store_id,
    location: row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month: row.month_key || getMonthFromDate(row.po_date),
    ticketNumber: row.ol_item_key || `${row.po_number}-${row.item_no}`.replace(/-$/, ""),
    poNumber: row.po_number,
    createdAt: row.po_date,
    status: row.release_indicator || row.delivery_complete_indicator || "",
    criticality: row.doc_type || "NA",
    ageingDays,
    breachedFlag: isActiveStage && ageingDays > 30 ? "Breached" : "Within SLA",
    isOverdue: isActiveStage && ageingDays > 30,
    issueTitle: row.article_description || row.remark || row.po_number,
    category: row.doc_type || "OL",
    subCategory: row.wbs_element,
    workflowStage,
    isActiveStage,
    olStatusNote: [row.remark, row.additional_remark, row.setoff_status].filter(Boolean).join(" | "),
    openJobs: isActiveStage ? 1 : 0,
    overdueJobs: isActiveStage && ageingDays > 30 ? 1 : 0,
    lastRaisedDate: row.po_date,
    server: row.server,
    grossAmount: toNumber(row.gross_amount),
    grnValue: toNumber(row.grn_value),
    invoiceValue: toNumber(row.invoice_value),
    remark: row.remark,
  };
}

function aggregateOlTickets(ticketRows = []) {
  const olByStoreMonth = new Map();

  ticketRows.forEach((row) => {
    const key = `${row.storeId}|${row.month}`;
    if (!olByStoreMonth.has(key)) {
      olByStoreMonth.set(key, {
        storeId: row.storeId,
        storeName: row.storeName,
        location: row.location,
        region: row.region,
        state: row.state,
        month: row.month,
        openJobs: 0,
        overdueJobs: 0,
        lastRaisedDate: row.createdAt,
      });
    }

    const current = olByStoreMonth.get(key);
    current.openJobs += row.openJobs;
    current.overdueJobs += row.overdueJobs;

    if (row.createdAt && (!current.lastRaisedDate || row.createdAt > current.lastRaisedDate)) {
      current.lastRaisedDate = row.createdAt;
    }
  });

  return Array.from(olByStoreMonth.values());
}

function mapOlSummaryRows(rows = []) {
  return rows.map((row) => ({
    storeId: row.store_id,
    storeName: row.store_name || row.site || row.store_id,
    location: row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month: row.month_key || getMonthFromDate(row.last_raised_date),
    openJobs: toNumber(row.open_jobs),
    overdueJobs: toNumber(row.overdue_jobs),
    lastRaisedDate: row.last_raised_date || row.lastRaisedDate || "",
  }));
}

function mapApiRowsToDataSource(apiData = {}, options = {}) {
  const faultImportMeta = getLatestFaultImportMeta(options.bootstrap);
  const attendanceSummaryRows = apiData["attendance-store-month"] || [];
  const olSummaryRows = apiData["ol-store-month"] || [];
  const rawAttendanceRows = apiData.attendance || [];
  const rawOlRows = apiData.ol || [];
  const latestMonth = getLatestMonthFromRows(
    rawAttendanceRows,
    attendanceSummaryRows,
    apiData.faults || [],
    rawOlRows.length ? rawOlRows : olSummaryRows,
    apiData.thermography || [],
    apiData["deep-cleaning"] || [],
  );
  const attendance =
    attendanceSummaryRows.length > 0
      ? mapAttendanceSummaryRows(attendanceSummaryRows)
      : mapAttendanceSummaryRows(
          Object.values(
            rawAttendanceRows.reduce((grouped, row) => {
              const storeId = row.store_id || "Unknown";
              const month = row.month_key || row.attendance_date?.slice(0, 7) || "Unknown";
              const key = `${storeId}_${month}`;

              if (!grouped[key]) {
                grouped[key] = {
                  store_id: storeId,
                  store_name: row.store_name || "Unknown Store",
                  month_key: month,
                  total_rows: 0,
                  present_rows: 0,
                  mandays: 0,
                  employee_count: new Set(),
                };
              }

              grouped[key].total_rows += 1;
              grouped[key].mandays += toNumber(row.attendance_value);

              if (toNumber(row.attendance_value) > 0) {
                grouped[key].present_rows += 1;
              }

              if (row.ep_no) {
                grouped[key].employee_count.add(row.ep_no);
              }

              return grouped;
            }, {}),
          ).map((item) => ({
            ...item,
            employee_count: item.employee_count.size,
          })),
        );

  const attendanceDaily = mapAttendanceDailyRows(rawAttendanceRows);

  const stores = (apiData.stores || []).map(mapStoreMasterRow);

  const faultTickets = (apiData.faults || []).map((row) => buildFaultTicketRow(row, faultImportMeta));
  const faults = aggregateFaultTickets(faultTickets);
  const faultValidation = buildFaultValidation(faultTickets, faults, faultImportMeta);

  const olTickets = rawOlRows.map((row) => buildOlTicketRow(row));
  const ol = olSummaryRows.length > 0 ? mapOlSummaryRows(olSummaryRows) : aggregateOlTickets(olTickets);

  const thermography = (apiData.thermography || []).map((row) => ({
    storeId: row.store_id,
    storeName: row.store_name,
    location: row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month: getMonthFromDate(row.completion_date || row.report_shared_date || row.schedule_date, latestMonth),
    status: row.inspection_status || row.report_status,
    lastInspectionDate: row.completion_date || null,
    daysPending: row.inspection_status === "Not Inspected" ? 1 : 0,
    reportStatus: row.report_status,
    scheduleDate: row.schedule_date,
  }));

  const manpower = (apiData.manpower || []).map((row) => ({
    storeId: row.store_id,
    storeName: row.store_id,
    location: row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month: latestMonth,
    deployed: 0,
    required: toNumber(row.vacant_count),
    variance: -toNumber(row.vacant_count),
    positionName: row.position_name,
    vacantCount: toNumber(row.vacant_count),
    vacantFrom: row.vacant_from,
    remark: row.remark,
  }));

  const cleaning = (apiData["deep-cleaning"] || []).map((row) => ({
    storeId: row.store_id,
    storeName: row.store_name,
    location: row.state_group || "Unknown",
    region: row.state_group || "Unknown",
    state: row.state_group || "Unknown",
    month: getMonthFromDate(row.completion_date || row.schedule_date, latestMonth),
    completed: row.cleaning_status === "Completed" ? 1 : 0,
    pending: row.cleaning_status === "Completed" ? 0 : 1,
    lastCompletedDate: row.completion_date || null,
    status: row.cleaning_status,
    frequency: row.frequency,
    remark: row.remark,
  }));

  return {
    stores,
    attendance,
    faults,
    ol,
    thermography,
    manpower,
    cleaning,
    attendanceDaily,
    pendingTickets: [],
    overallPendingTickets: [],
    faultTickets,
    olTickets,
    faultValidation,
    faultDebug: {
      rawFaultTicketCount: faultTickets.length,
      groupedTotalFaults: faultValidation.groupedTotalFaults,
    },
    cmpm: (apiData.cmpm || []).map((row) => ({
      storeId: row.store_id,
      storeName: row.store_name,
      location: row.state_group || "Unknown",
      region: row.state_group || "Unknown",
      state: row.state_group || "Unknown",
      month: latestMonth,
      serialNo: row.serial_no,
      storeCode: row.store_id,
      format: row.format_name,
      cmTask: row.cm_task || "Blank",
      pmStatus: row.pm_status || "Blank",
      remarks: row.remarks,
      cmCompleted: toNumber(row.cm_completed),
      pmCompleted: toNumber(row.pm_completed),
      cmPending: toNumber(row.cm_pending),
      pmPending: toNumber(row.pm_pending),
      recordCount: toNumber(row.record_count, 1),
    })),
  };
}

export function useDashboardController() {
  const demoSession = useMemo(() => createDemoSession(), []);

  const [dataSource, setDataSource] = useState(demoSession.dataSource);
  const [dataInfo, setDataInfo] = useState(demoSession.info);
  const [viewFilters, setViewFilters] = useState(() => createInitialViewFilters(demoSession.dataSource));
  const [groupBy, setGroupBy] = useState("location");
  const [activeView, setActiveView] = useState("dashboard");
  const [isUploading, setIsUploading] = useState(false);
  const [isSyncingDatabase, setIsSyncingDatabase] = useState(false);
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(false);

  const [databaseSyncInfo, setDatabaseSyncInfo] = useState({
    status: "idle",
    message: "",
    results: [],
  });

  const [selectedAttendanceDate, setSelectedAttendanceDate] = useState("");
  const [currentRole, setCurrentRole] = useState(() => readStoredValue("qpms-current-role", "management"));
  const [workflowUpdates, setWorkflowUpdates] = useState(() => readStoredJson("qpms-workflow-updates", {}));
  const [faultRemarks, setFaultRemarks] = useState(() => readStoredJson("qpms-fault-remarks", {}));
  const [attendanceAopOverrides, setAttendanceAopOverrides] = useState(() => readStoredJson("qpms-attendance-aop-overrides", {}));
  const lastAutoAttendanceDateRef = useRef("");
  const attendanceDetailStatusRef = useRef("idle");
  const olDetailStatusRef = useRef("idle");

  const [workflowFiles, setWorkflowFiles] = useState({
    allocation: null,
    attendance: null,
    pending: null,
    dashboard: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadDatabaseDashboard() {
      setIsLoadingDatabase(true);

      try {
        const bootstrapPromise = fetchDashboardBootstrap().catch(() => null);
        const [
          storesRows,
          attendanceSummaryRows,
          faultsRows,
          olSummaryRows,
          cmpmRows,
          thermographyRows,
          cleaningRows,
          manpowerRows,
        ] = await Promise.all([
          fetchStartupReport("stores").catch(() => []),
          fetchStartupReport("attendance-store-month").catch(() => []),
          fetchStartupReport("faults").catch(() => []),
          fetchStartupReport("ol-store-month").catch(() => []),
          fetchStartupReport("cmpm").catch(() => []),
          fetchStartupReport("thermography").catch(() => []),
          fetchStartupReport("deep-cleaning").catch(() => []),
          fetchStartupReport("manpower").catch(() => []),
        ]);

        if (cancelled) return;

        const apiDataSource = mapApiRowsToDataSource({
          stores: storesRows,
          "attendance-store-month": attendanceSummaryRows,
          faults: faultsRows,
          "ol-store-month": olSummaryRows,
          cmpm: cmpmRows,
          thermography: thermographyRows,
          "deep-cleaning": cleaningRows,
          manpower: manpowerRows,
        });

        setDataSource(apiDataSource);
        setDataInfo({
          mode: "database",
          fileName: "QPMS PostgreSQL dashboard",
          loadedSheets: [],
          missingSheets: [],
          error: "",
          bootstrap: null,
          connection: {
            database: "qpms_dashboard",
            host: "localhost",
            port: 8787,
            status: "connected",
          },
          stats: {
            stores: storesRows.length,
            attendanceImported: 0,
            faultTickets: faultsRows.length,
            olTickets: 0,
            thermography: thermographyRows.length,
            manpower: manpowerRows.length,
            cleaning: cleaningRows.length,
            cmpm: cmpmRows.length,
          },
        });

        setViewFilters(createInitialViewFilters(apiDataSource));

        bootstrapPromise.then((bootstrap) => {
          if (cancelled || !bootstrap) return;

          setDataInfo((current) => ({
            ...current,
            bootstrap,
          }));
        });
      } catch (error) {
        if (cancelled) return;

        setDataInfo((current) => ({
          ...current,
          error: `Database API not loaded. Using demo data. ${error.message || ""}`,
        }));
      } finally {
        if (!cancelled) {
          setIsLoadingDatabase(false);
        }
      }
    }

    loadDatabaseDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (dataInfo.mode !== "database") {
      attendanceDetailStatusRef.current = "idle";
      olDetailStatusRef.current = "idle";
    }
  }, [dataInfo.mode]);

  useEffect(() => {
    if (dataSource.attendanceDaily.length) {
      attendanceDetailStatusRef.current = "loaded";
    }
  }, [dataSource.attendanceDaily.length]);

  useEffect(() => {
    if (dataSource.olTickets.length) {
      olDetailStatusRef.current = "loaded";
    }
  }, [dataSource.olTickets.length]);

  useEffect(() => {
    if (dataInfo.mode !== "database" || activeView !== "attendance") {
      return;
    }

    if (dataSource.attendanceDaily.length || attendanceDetailStatusRef.current === "loading" || attendanceDetailStatusRef.current === "loaded") {
      return;
    }

    let cancelled = false;
    attendanceDetailStatusRef.current = "loading";

    fetchReport("attendance", {}, { all: true })
      .then((attendanceRows) => {
        if (cancelled) return;

        const attendanceDailyRows = mapAttendanceDailyRows(attendanceRows);
        startTransition(() => {
          setDataSource((current) => ({
            ...current,
            attendanceDaily: attendanceDailyRows,
          }));
          setDataInfo((current) => ({
            ...current,
            stats: {
              ...(current.stats || {}),
              attendanceImported: attendanceDailyRows.length,
            },
          }));
        });
        attendanceDetailStatusRef.current = "loaded";
      })
      .catch((error) => {
        if (cancelled) return;

        attendanceDetailStatusRef.current = "idle";
        setDataInfo((current) => ({
          ...current,
          error: `Attendance detail load failed. ${error.message || ""}`.trim(),
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, dataInfo.mode, dataSource.attendanceDaily.length]);

  useEffect(() => {
    if (dataInfo.mode !== "database" || activeView !== "ol") {
      return;
    }

    if (dataSource.olTickets.length || olDetailStatusRef.current === "loading" || olDetailStatusRef.current === "loaded") {
      return;
    }

    let cancelled = false;
    olDetailStatusRef.current = "loading";

    fetchReport("ol", {}, { all: true })
      .then((olRows) => {
        if (cancelled) return;

        const olTicketRows = olRows.map((row) => buildOlTicketRow(row));
        startTransition(() => {
          setDataSource((current) => ({
            ...current,
            ol: aggregateOlTickets(olTicketRows),
            olTickets: olTicketRows,
          }));
          setDataInfo((current) => ({
            ...current,
            stats: {
              ...(current.stats || {}),
              olTickets: olTicketRows.length,
            },
          }));
        });
        olDetailStatusRef.current = "loaded";
      })
      .catch((error) => {
        if (cancelled) return;

        olDetailStatusRef.current = "idle";
        setDataInfo((current) => ({
          ...current,
          error: `OL detail load failed. ${error.message || ""}`.trim(),
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeView, dataInfo.mode, dataSource.olTickets.length]);

  const viewMonthOptions = useMemo(
    () => Object.fromEntries(FILTERABLE_VIEWS.map((view) => [view, getAvailableMonthsForView(dataSource, view)])),
    [dataSource],
  );
  const availableMonths = viewMonthOptions[activeView] || getAvailableMonths(dataSource);
  const availableMonthKey = useMemo(
    () => FILTERABLE_VIEWS.map((view) => `${view}:${(viewMonthOptions[view] || []).join(",")}`).join("|"),
    [viewMonthOptions],
  );
  const activeFilters = viewFilters[activeView] || viewFilters.dashboard || createInitialFilters(dataSource, activeView);

  const attendanceDates = useMemo(
    () => getAttendanceAvailableDates(dataSource, activeFilters.month),
    [activeFilters.month, dataSource],
  );

  const effectiveReportType =
    activeView === "dashboard" ? activeFilters.reportType : viewReportTypeMap[activeView] || "All Reports";

  useEffect(() => {
    if (!availableMonths.length) return;

    setViewFilters((current) => {
      let changed = false;
      const nextFilters = { ...current };

      FILTERABLE_VIEWS.forEach((view) => {
        const viewMonths = viewMonthOptions[view] || getAvailableMonthsForView(dataSource, view);
        const existingFilters = current[view] || createInitialFilters(dataSource, view);
        const preferredMonths = view === "dashboard" ? viewMonths.filter((month) => !isAllMonthsValue(month)) : viewMonths;
        const nextMonth = viewMonths.includes(existingFilters.month)
          ? existingFilters.month
          : view === "faults" || view === "ol"
            ? ALL_MONTHS
            : getPreferredMonth(preferredMonths.length ? preferredMonths : viewMonths);

        if (!current[view] || nextMonth !== existingFilters.month) {
          changed = true;
          nextFilters[view] = {
            ...existingFilters,
            month: nextMonth,
          };
        }
      });

      return changed ? nextFilters : current;
    });
  }, [availableMonthKey, dataSource, viewMonthOptions]);

  useEffect(() => {
    const nextDate = attendanceDates[attendanceDates.length - 1] || "";

    if (!attendanceDates.length && selectedAttendanceDate) {
      lastAutoAttendanceDateRef.current = "";
      setSelectedAttendanceDate("");
    } else if (
      attendanceDates.length &&
      (!selectedAttendanceDate ||
        !attendanceDates.includes(selectedAttendanceDate) ||
        selectedAttendanceDate === lastAutoAttendanceDateRef.current)
    ) {
      lastAutoAttendanceDateRef.current = nextDate;
      setSelectedAttendanceDate(nextDate);
    }
  }, [attendanceDates, selectedAttendanceDate]);

  useEffect(() => {
    window.localStorage.setItem("qpms-current-role", currentRole);
  }, [currentRole]);

  useEffect(() => {
    window.localStorage.setItem("qpms-workflow-updates", JSON.stringify(workflowUpdates));
  }, [workflowUpdates]);

  useEffect(() => {
    window.localStorage.setItem("qpms-fault-remarks", JSON.stringify(faultRemarks));
  }, [faultRemarks]);

  useEffect(() => {
    window.localStorage.setItem("qpms-attendance-aop-overrides", JSON.stringify(attendanceAopOverrides));
  }, [attendanceAopOverrides]);

  const activeReportMonths = useMemo(
    () =>
      activeView === "faults" || activeView === "ol"
        ? (viewMonthOptions[activeView] || []).filter((month) => !isAllMonthsValue(month))
        : null,
    [activeView, viewMonthOptions],
  );
  const activeReportMonthSet = useMemo(() => (activeReportMonths ? new Set(activeReportMonths) : null), [activeReportMonths]);

  const unifiedData = useMemo(
    () => createUnifiedDataset(dataSource, activeFilters.month, { reportMonths: activeReportMonths }),
    [dataSource, activeFilters.month, activeReportMonths],
  );

  const filterOptions = useMemo(
    () => ({
      ...getFilterOptions(unifiedData, dataSource.stores),
      months: availableMonths,
    }),
    [unifiedData, dataSource.stores, availableMonths],
  );

  const filteredRows = useMemo(
    () => filterUnifiedData(unifiedData, { ...activeFilters, reportType: effectiveReportType }),
    [unifiedData, activeFilters, effectiveReportType],
  );

  const kpis = useMemo(
    () => calculateKpis(filteredRows, effectiveReportType, { month: activeFilters.month }),
    [filteredRows, effectiveReportType, activeFilters.month],
  );
  const pivotRows = useMemo(() => buildPivotRows(filteredRows, groupBy), [filteredRows, groupBy]);
  const trendItems = useMemo(() => buildTrendSnapshot(dataSource), [dataSource]);
  const summary = useMemo(() => getDataSourceSummary(dataSource), [dataSource]);
  const roleConfig = useMemo(() => getRoleConfig(currentRole), [currentRole]);
  const activeFilterCount = useMemo(() => countActiveFilters(activeFilters, activeView), [activeFilters, activeView]);

  const workflowSourceRows = useMemo(() => {
    if (activeView === "ol") {
      return dataSource.olTickets?.length ? dataSource.olTickets : dataSource.pendingTickets || [];
    }

    if (activeView === "faults") {
      return dataSource.faultTickets?.length ? dataSource.faultTickets : dataSource.pendingTickets || [];
    }

    return [];
  }, [activeView, dataSource]);

  const filteredWorkflowRows = useMemo(() => {
    const visibleStoreIds = new Set(filteredRows.map((row) => row.storeId));

    return workflowSourceRows
      .filter((row) => {
        const matchesMonth = isAllMonthsValue(activeFilters.month)
          ? !activeReportMonthSet || activeReportMonthSet.has(row.month)
          : row.month === activeFilters.month;

        return matchesMonth && visibleStoreIds.has(row.storeId);
      })
      .filter((row) => {
        if (!activeFilters.search) return true;

        return `${row.ticketNumber} ${row.storeName} ${row.issueTitle} ${row.category} ${row.status} ${row.statusNote || ""} ${row.remark || ""}`
          .toLowerCase()
          .includes(activeFilters.search.toLowerCase());
      })
      .map((row) => ({
        ...row,
        workflowStage: workflowUpdates[row.ticketNumber]?.stage || row.workflowStage,
        remark: faultRemarks[row.ticketNumber] ?? row.statusNote ?? "",
      }));
  }, [activeReportMonthSet, faultRemarks, filteredRows, activeFilters.month, activeFilters.search, workflowSourceRows, workflowUpdates]);

  const scopedWorkflowRows = useMemo(
    () =>
      activeView === "faults"
        ? filteredWorkflowRows
        : filteredWorkflowRows.filter((row) => canRoleSeeStage(currentRole, getStageIndex(row.workflowStage))),
    [activeView, currentRole, filteredWorkflowRows],
  );

  const scopedWorkflowStoreIds = useMemo(() => new Set(scopedWorkflowRows.map((row) => row.storeId)), [scopedWorkflowRows]);

  const scopedReportRows = useMemo(() => {
    if (activeView === "ol") {
      return filteredRows.filter((row) => scopedWorkflowStoreIds.has(row.storeId));
    }

    return filteredRows;
  }, [activeView, filteredRows, scopedWorkflowStoreIds]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const rawFaultTicketCount = dataSource.faultValidation?.importedDbRowCount || 0;
    const groupedTotalFaults = dataSource.faultValidation?.groupedTotalFaults || 0;
    const displayedDashboardTotal =
      effectiveReportType === "Fault Report"
        ? filteredRows.reduce((sum, row) => sum + (row.faults?.totalFaults || 0), 0)
        : 0;

    console.debug("[QPMS fault reconciliation]", {
      scopeMonth: activeFilters.month,
      rawFaultTicketCount,
      groupedTotalFaults,
      displayedDashboardTotal,
    });
  }, [dataSource.faultValidation, effectiveReportType, filteredRows, activeFilters.month]);

  const attendanceSummary = useMemo(
    () => buildAttendanceSummary(dataSource, activeFilters.month, selectedAttendanceDate, attendanceAopOverrides[activeFilters.month] || {}),
    [dataSource, activeFilters.month, selectedAttendanceDate, attendanceAopOverrides],
  );

  const handleAttendanceAopSave = (state, counts) => {
    const hkAopCount = toNumber(counts.hkAopCount);
    const mepcAopCount = toNumber(counts.mepcAopCount);

    setAttendanceAopOverrides((current) => ({
      ...current,
      [activeFilters.month]: {
        ...(current[activeFilters.month] || {}),
        [state]: {
          hkAopCount,
          mepcAopCount,
        },
      },
    }));
  };

  const handleAttendanceAopReset = (state) => {
    setAttendanceAopOverrides((current) => {
      const monthOverrides = { ...(current[activeFilters.month] || {}) };
      delete monthOverrides[state];

      const next = { ...current };
      if (Object.keys(monthOverrides).length) {
        next[activeFilters.month] = monthOverrides;
      } else {
        delete next[activeFilters.month];
      }

      return next;
    });
  };

  const handleFilterChange = (field, value) => {
    if (!FILTERABLE_VIEWS.includes(activeView)) return;

    setViewFilters((current) => ({
      ...current,
      [activeView]: {
        ...(current[activeView] || createInitialFilters(dataSource, activeView)),
        [field]: value,
      },
    }));
  };

  const handleFilterReset = () => {
    if (!FILTERABLE_VIEWS.includes(activeView)) return;

    setViewFilters((current) => ({
      ...current,
      [activeView]: createInitialFilters(dataSource, activeView),
    }));

    if (activeView === "dashboard") {
      setGroupBy("location");
    }
  };

  const handleWorkflowFileChange = (type, file) => {
    setWorkflowFiles((current) => ({ ...current, [type]: file }));
  };

  const handleStageChange = (ticketNumber, stage) => {
    const currentRow = filteredWorkflowRows.find((row) => row.ticketNumber === ticketNumber);
    const currentStageIndex = getStageIndex(currentRow?.workflowStage);
    const targetStageIndex = getStageIndex(stage);

    if (
      !currentRow ||
      !canRoleSeeStage(currentRole, currentStageIndex) ||
      !canRoleEditStage(currentRole, currentStageIndex) ||
      !canRoleEditStage(currentRole, targetStageIndex)
    ) {
      return;
    }

    setWorkflowUpdates((current) => ({
      ...current,
      [ticketNumber]: {
        ...current[ticketNumber],
        stage,
      },
    }));
  };

  const handleRemarkChange = async (ticketNumber, remark) => {
    // Update local state for immediate feedback
    setFaultRemarks((current) => ({
      ...current,
      [ticketNumber]: remark,
    }));

    // If we are in database mode, persist to DB
    if (dataInfo.mode === "database") {
      try {
        await updateFaultRemark(ticketNumber, remark);
      } catch (error) {
        console.error("Failed to persist fault remark:", error);
        // Optionally revert local state or show error
        setDataInfo((current) => ({
          ...current,
          error: `Failed to save status update to database: ${error.message}`,
        }));
      }
    }
  };

  const handleProcessWorkflow = async (nextView = "dashboard") => {
    const hasReportSource = Boolean(workflowFiles.pending || workflowFiles.dashboard);
    const needsAllocation = nextView === "stores" || nextView === "attendance";

    if (needsAllocation && !workflowFiles.allocation) {
      setDataInfo((current) => ({
        ...current,
        error: "Upload the store allocation workbook first. It is required to build the store master and attendance data.",
      }));
      return;
    }

    if (!workflowFiles.allocation && !hasReportSource) {
      setDataInfo((current) => ({
        ...current,
        error: "Upload a dashboard workbook or overall pending file in Other Report Uploads, or add Store Allocation first.",
      }));
      return;
    }

    setIsUploading(true);

    try {
      const result = await createUploadSession(workflowFiles);

      setDataSource(result.dataSource);
      setDataInfo(result.info);
      setViewFilters(createInitialViewFilters(result.dataSource));
      setActiveView(nextView);
      setGroupBy("location");
    } catch (error) {
      setDataInfo((current) => ({
        ...current,
        error: error.message || "Unable to process the QPMS workflow files.",
      }));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncRawDatabase = async () => {
    if (!Object.values(workflowFiles).some(Boolean)) {
      setDatabaseSyncInfo({
        status: "error",
        message: "Upload at least one source file before syncing to PostgreSQL.",
        results: [],
      });
      return;
    }

    setIsSyncingDatabase(true);
    setDatabaseSyncInfo({
      status: "syncing",
      message: "Syncing selected Excel sources to PostgreSQL raw tables...",
      results: [],
    });

    try {
      const results = await syncFilesToRawDatabase(workflowFiles);
      const totalRows = results.reduce((sum, result) => sum + result.totalRows, 0);

      setDatabaseSyncInfo({
        status: "success",
        message: `Synced ${totalRows} rows into PostgreSQL raw tables.`,
        results,
      });
    } catch (error) {
      setDatabaseSyncInfo({
        status: "error",
        message: error.message || "Unable to sync files to PostgreSQL.",
        results: [],
      });
    } finally {
      setIsSyncingDatabase(false);
    }
  };

  const handleUseDemoData = () => {
    const nextSession = createDemoSession();

    setDataSource(nextSession.dataSource);
    setDataInfo(nextSession.info);
    setWorkflowFiles({
      allocation: null,
      attendance: null,
      pending: null,
      dashboard: null,
    });
    setWorkflowUpdates({});
    setFaultRemarks({});
    setDatabaseSyncInfo({
      status: "idle",
      message: "",
      results: [],
    });
    setViewFilters(createInitialViewFilters(nextSession.dataSource));
    setActiveView("dashboard");
    setGroupBy("location");
  };

  const upsertStoreMasterRow = (storeRow) => {
    const mappedStore = mapStoreMasterRow(storeRow);

    setDataSource((current) => {
      const existingStores = Array.isArray(current.stores) ? current.stores : [];
      const withoutStore = existingStores.filter((store) => store.storeId !== mappedStore.storeId);
      const nextStores = [...withoutStore, mappedStore].sort((left, right) =>
        `${left.region}-${left.storeId}`.localeCompare(`${right.region}-${right.storeId}`),
      );

      return {
        ...current,
        stores: nextStores,
      };
    });

    return mappedStore;
  };

  const handleAddStore = async (store) => {
    const result = await createMasterStore(store);
    return upsertStoreMasterRow(result.store);
  };

  const handleStoreUpdate = async (storeCode, updates) => {
    const result = await updateMasterStoreDetails(storeCode, updates);
    return upsertStoreMasterRow(result.store);
  };

  const handleStoreStatusChange = async (storeCode, status) => {
    const result = await updateMasterStoreStatus(storeCode, status);
    return upsertStoreMasterRow(result.store);
  };

  const handleNavigate = (nextView) => {
    setActiveView(nextView);

    if (nextView !== "attendance") {
      return;
    }

    setViewFilters((current) => {
      const attendanceMonths = getAvailableMonthsForView(dataSource, "attendance");
      const preferredMonth = getPreferredMonth(attendanceMonths);
      const existingFilters = current.attendance || createInitialFilters(dataSource, "attendance");

      if (existingFilters.month === preferredMonth) {
        return current;
      }

      return {
        ...current,
        attendance: {
          ...existingFilters,
          month: preferredMonth,
        },
      };
    });
  };

  const hero = viewMeta[activeView] || viewMeta.dashboard;
  const showFilterPanel = activeView !== "data-sync" && activeView !== "reports" && activeView !== "po-lab" && activeView !== "stores";
  const showKpis = activeView !== "data-sync" && activeView !== "reports" && activeView !== "po-lab" && activeView !== "stores";
  const visibleStoreCount =
    activeView === "faults"
      ? scopedWorkflowRows.length
      : activeView === "ol"
        ? scopedWorkflowRows.length
        : filteredRows.length;

  const heroStats =
    activeView === "data-sync"
      ? [
          { label: "Imported Sheets", value: dataInfo.loadedSheets?.length || 0 },
          { label: "Stores in Scope", value: summary.stores },
          { label: "Workflow Tickets", value: summary.faultTickets + summary.olTickets },
        ]
      : activeView === "reports"
        ? [
            { label: "Report Types", value: 7 },
            { label: "Pivot Shelves", value: 4 },
            { label: "Export Actions", value: 3 },
          ]
        : activeView === "po-lab"
          ? [
              { label: "Workbook Upload", value: "Excel" },
              { label: "Suggestion Flow", value: "Search-first" },
              { label: "PO Drafting", value: "Pilot ready" },
            ]
          : [
              { label: "Working Month", value: formatMonthLabel(activeFilters.month) },
              {
                label: activeView === "faults" || activeView === "ol" ? "Visible Jobs" : "Visible Stores",
                value: visibleStoreCount,
              },
              { label: "Active Filters", value: activeFilterCount },
            ];

  return {
    activeFilters,
    activeView,
    attendanceAopOverrides,
    attendanceSummary,
    currentRole,
    dataInfo,
    dataSource,
    databaseSyncInfo,
    effectiveReportType,
    faultRemarks,
    filterOptions,
    filteredRows,
    groupBy,
    hero,
    heroStats,
    isUploading,
    isSyncingDatabase,
    isLoadingDatabase,
    kpis,
    pivotRows,
    roleConfig,
    scopedReportRows,
    scopedWorkflowRows,
    selectedAttendanceDate,
    showFilterPanel,
    showKpis,
    summary,
    trendItems,
    visibleStoreCount,
    workflowFiles,
    canProcessWorkflow: Boolean(
      workflowFiles.dashboard ||
        workflowFiles.pending ||
        (workflowFiles.allocation && workflowFiles.attendance) ||
        (workflowFiles.allocation && (workflowFiles.pending || workflowFiles.dashboard)),
    ),
    handleAttendanceAopReset,
    handleAttendanceAopSave,
    handleAttendanceDateChange: setSelectedAttendanceDate,
    handleAddStore,
    handleFilterChange,
    handleFilterReset,
    handleProcessWorkflow,
    handleRemarkChange,
    handleSyncRawDatabase,
    handleStageChange,
    handleStoreUpdate,
    handleStoreStatusChange,
    handleUseDemoData,
    handleWorkflowFileChange,
    onNavigate: handleNavigate,
    onRoleChange: setCurrentRole,
    onGroupChange: setGroupBy,
  };
}
