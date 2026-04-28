import { buildAdjustedStoreAopMap } from "./aopOverrides";

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

export const WORKFLOW_STAGES = [
  "Draft PO",
  "WIP",
  "Work Completed",
  "Work Completed Doc Pending",
  "AFM Pending",
  "Certification done- Document shared to Commercial for JMS",
  "JMS In progress",
  "Invoice Processed",
  "Payment Received From client",
  "PO Deleted",
  "Need To Delete",
];

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

function cleanCode(value) {
  return cleanText(value).toUpperCase();
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const text = String(value).replace(/,/g, "").trim();
  const normalized = Number(text);
  if (Number.isFinite(normalized)) {
    return normalized;
  }

  const numericMatch = text.match(/-?\d+(?:\.\d+)?/);
  return numericMatch ? Number(numericMatch[0]) : 0;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseExcelDate(XLSX, value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const parsed = XLSX.SSF.parse_date_code(numeric);
  if (!parsed) {
    return null;
  }

  return new Date(parsed.y, parsed.m - 1, parsed.d);
}

function parseDate(XLSX, value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return formatDate(value);
  }

  const asExcel = parseExcelDate(XLSX, value);
  if (asExcel) {
    return formatDate(asExcel);
  }

  const text = cleanText(value);
  const dmyMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month}-${day}`;
  }

  const monthTextMatch = text.match(/^([A-Za-z]{3,9})[-\s']?(\d{2,4})$/);
  if (monthTextMatch) {
    const monthToken = monthTextMatch[1].slice(0, 3).toUpperCase();
    const monthNumber = MONTH_LOOKUP[monthToken];
    if (monthNumber) {
      const yearText = monthTextMatch[2];
      const year = yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText);
      return `${year}-${String(monthNumber).padStart(2, "0")}-01`;
    }
  }

  const isoLike = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : formatDate(parsed);
}

function parseMonthValue(value) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(text)) {
    return text;
  }

  const isoLike = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    return `${isoLike[1]}-${isoLike[2]}`;
  }

  const monthMatch = text.match(/^([A-Za-z]{3,9})[-\s']?(\d{2,4})$/);
  if (monthMatch) {
    const monthToken = monthMatch[1].slice(0, 3).toUpperCase();
    const monthNumber = MONTH_LOOKUP[monthToken];
    if (!monthNumber) {
      return null;
    }

    const yearText = monthMatch[2];
    const year = yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText);
    return `${year}-${String(monthNumber).padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }

  return null;
}

function normalizeStateGroup(value) {
  const compact = cleanCode(value).replace(/\s+/g, "");

  if (!compact) {
    return "Unknown";
  }

  if (compact.startsWith("AP-1") || compact.startsWith("AP1") || compact.includes("ANDHRAPRADESH-1")) {
    return "AP-1";
  }

  if (compact.startsWith("AP-2") || compact.startsWith("AP2") || compact.includes("ANDHRAPRADESH-2")) {
    return "AP-2";
  }

  if (compact.startsWith("TG") || compact.includes("TELANGANA")) {
    return "TG";
  }

  if (compact.startsWith("KN") || compact.includes("KARNATAKA")) {
    return "KN";
  }

  if (compact.startsWith("KL") || compact.includes("KERALA")) {
    return "KL";
  }

  if (compact.startsWith("TN") || compact === "PY" || compact === "ROTN" || compact.includes("TAMIL")) {
    return "TN";
  }

  return cleanText(value) || "Unknown";
}

function mapAttendanceClass(value) {
  const normalized = cleanCode(value);
  if (normalized === "HOUSE KEEPING") {
    return "HK";
  }

  return normalized || "Unknown";
}

function mapAttendanceValue(value) {
  const numericValue = Number(cleanText(value));
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }

  const normalized = cleanCode(value).replace(/\s+/g, "");

  if (["A", "NO-SHOW", "NOSHOW", "T", "H"].includes(normalized)) {
    return 0;
  }

  if (["H-P", "HP", "P", "W", "WO", "WO-P", "WOP"].includes(normalized)) {
    return 1;
  }

  if (["HD", "H-HD", "HHD"].includes(normalized)) {
    return 0.5;
  }

  return 0;
}

function toMonth(dateValue) {
  return dateValue ? dateValue.slice(0, 7) : null;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

export function getMepcWorkingDays(dayCount) {
  const parsedDays = Math.max(Number(dayCount) || 0, 0);
  return Math.max(parsedDays - Math.floor(parsedDays / 7), 0);
}

function hashCode(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function normalizeSheetName(name) {
  return cleanCode(name).replace(/\s+/g, " ");
}

async function readWorkbook(XLSX, file) {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array", cellDates: true });
}

function findSheetName(workbook, preferredSheetNames = [], fallbackToFirst = true) {
  const normalizedMap = new Map(workbook.SheetNames.map((name) => [normalizeSheetName(name), name]));

  for (const preferredName of preferredSheetNames) {
    const matchedName = normalizedMap.get(normalizeSheetName(preferredName));
    if (matchedName) {
      return matchedName;
    }
  }

  return fallbackToFirst ? workbook.SheetNames[0] || null : null;
}

function readWorkbookRows(XLSX, workbook, preferredSheetNames = [], options = {}) {
  const { headerRowIndex, fallbackToFirst = true } = options;
  const sheetName = findSheetName(workbook, preferredSheetNames, fallbackToFirst);

  if (!sheetName) {
    return { rows: [], sheetName: null };
  }

  const sheet = workbook.Sheets[sheetName];

  if (Number.isInteger(headerRowIndex)) {
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
    const headerRow = matrix[headerRowIndex] || [];
    const headers = headerRow.map((value, index) => cleanText(value) || `column_${index}`);
    const rows = matrix
      .slice(headerRowIndex + 1)
      .filter((row) => row.some((value) => cleanText(value)))
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null])));

    return { rows, sheetName };
  }

  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
  return { rows, sheetName };
}

function readWorkbookMatrix(XLSX, workbook, preferredSheetNames = [], fallbackToFirst = false) {
  const sheetName = findSheetName(workbook, preferredSheetNames, fallbackToFirst);
  if (!sheetName) {
    return { sheetName: null, matrix: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  return { sheetName, matrix };
}

function parseSummarySnapshot(XLSX, workbook) {
  const { sheetName, matrix } = readWorkbookMatrix(XLSX, workbook, ["Summary"], false);
  if (!sheetName || !matrix.length) {
    return null;
  }

  const get = (row, col) => cleanText(matrix[row]?.[col]);
  const num = (row, col) => parseNumber(matrix[row]?.[col]);
  const findRowByLabel = (columnIndex, label) =>
    matrix.findIndex((row) => cleanCode(row?.[columnIndex]) === cleanCode(label));
  const findRowByLabelAfter = (columnIndex, label, startAt) =>
    matrix.findIndex((row, index) => index >= startAt && cleanCode(row?.[columnIndex]) === cleanCode(label));

  const rp5GrandCandidates = matrix
    .map((row, index) => ({ index, label: cleanCode(row?.[0]), value: parseNumber(row?.[5]) }))
    .filter((item) => item.index < 25 && item.label === cleanCode("Grand Total") && item.value > 0)
    .sort((left, right) => right.value - left.value);
  const rp5GrandRow = rp5GrandCandidates[0]?.index ?? -1;
  const cmGrandRow = matrix.findIndex(
    (row) => cleanCode(row?.[10]) === cleanCode("Grand Total") && cleanText(row?.[12]),
  );
  const pmGrandRow = matrix.findIndex(
    (row) => cleanCode(row?.[10]) === cleanCode("Grand Total") && cleanText(row?.[14]),
  );

  const thermoGrandRow = matrix.findIndex(
    (row) =>
      cleanCode(row?.[10]) === cleanCode("Grand Total") &&
      Number.isFinite(parseNumber(row?.[11])) &&
      Number.isFinite(parseNumber(row?.[13])) &&
      parseNumber(row?.[11]) > 0 &&
      parseNumber(row?.[13]) <= 1,
  );

  const cleaningGrandRow = matrix.findIndex(
    (row) =>
      cleanCode(row?.[10]) === cleanCode("Grand Total") &&
      Number.isFinite(parseNumber(row?.[11])) &&
      Number.isFinite(parseNumber(row?.[13])) &&
      parseNumber(row?.[11]) > 0 &&
      parseNumber(row?.[13]) > 0.1,
  );

  const trainingGrandRow = matrix.findIndex(
    (row) =>
      cleanCode(row?.[10]) === cleanCode("Grand Total") &&
      Number.isFinite(parseNumber(row?.[11])) &&
      Number.isFinite(parseNumber(row?.[13])) &&
      parseNumber(row?.[11]) > 0 &&
      parseNumber(row?.[13]) > 1,
  );

  const attendanceGrandRow = findRowByLabelAfter(0, "Grand Total", 57);
  const manpowerGrandRow = matrix.findIndex((row) => cleanCode(row?.[13]) === cleanCode("Grand Total"));

  const snapshot = {
    sheetName,
    rp5Server: {
      monthLabel: get(13, 11) || get(3, 11),
      totalValue: rp5GrandRow >= 0 ? num(rp5GrandRow, 5) : 0,
    },
    cmStatus: {
      monthLabel: get(3, 11),
      completed: cmGrandRow >= 0 ? num(cmGrandRow, 11) : 0,
      total: cmGrandRow >= 0 ? num(cmGrandRow, 12) : 0,
    },
    pmStatus: {
      monthLabel: get(13, 11),
      completed: pmGrandRow >= 0 ? num(pmGrandRow, 11) : 0,
      pending: pmGrandRow >= 0 ? num(pmGrandRow, 12) : 0,
      total: pmGrandRow >= 0 ? num(pmGrandRow, 14) : 0,
    },
    thermography: {
      scheduled: thermoGrandRow >= 0 ? num(thermoGrandRow, 11) : 0,
      completed: thermoGrandRow >= 0 ? num(thermoGrandRow, 12) : 0,
      completionPct: thermoGrandRow >= 0 ? num(thermoGrandRow, 13) : 0,
    },
    deepCleaning: {
      scheduled: cleaningGrandRow >= 0 ? num(cleaningGrandRow, 11) : 0,
      completed: cleaningGrandRow >= 0 ? num(cleaningGrandRow, 12) : 0,
      completionPct: cleaningGrandRow >= 0 ? num(cleaningGrandRow, 13) : 0,
    },
    training: {
      completed: trainingGrandRow >= 0 ? num(trainingGrandRow, 11) : 0,
      pending: trainingGrandRow >= 0 ? num(trainingGrandRow, 12) : 0,
      total: trainingGrandRow >= 0 ? num(trainingGrandRow, 13) : 0,
    },
    attendance: {
      monthLabel: get(57, 1),
      hk: attendanceGrandRow >= 0 ? num(attendanceGrandRow, 1) : 0,
      mepc: attendanceGrandRow >= 0 ? num(attendanceGrandRow, 2) : 0,
      grandTotal: attendanceGrandRow >= 0 ? num(attendanceGrandRow, 3) : 0,
      cumulativePct: attendanceGrandRow >= 0 ? num(attendanceGrandRow, 11) : 0,
    },
    technicalVacancy: {
      vacantTotal: manpowerGrandRow >= 0 ? num(manpowerGrandRow, 16) : 0,
    },
  };

  return snapshot;
}

function getDateDiffInDays(dateValue) {
  if (!dateValue) {
    return 0;
  }

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const today = new Date();
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(Math.round((end - start) / 86400000), 0);
}

function inferWorkflowStage(row) {
  const ageDays = parseNumber(row["Ageing(Days)"] || row.Ageing);
  const criticality = cleanCode(row.Criticality);
  const breached = cleanCode(row["Breached Flag"]) === "BREACHED";
  const status = cleanCode(row.Status);
  const title = cleanCode(row["Issue Title"]);
  const seed = hashCode(`${cleanText(row["Ticket Number"])}|${cleanText(row["Store ID"])}`);

  if (status.includes("DELETE") || title.includes("DELETE")) {
    return WORKFLOW_STAGES[10];
  }

  if (status.includes("CANCEL")) {
    return WORKFLOW_STAGES[9];
  }

  if (ageDays >= 240) {
    return WORKFLOW_STAGES[7 + (seed % 2)];
  }

  if (ageDays >= 180) {
    return WORKFLOW_STAGES[5 + (seed % 3)];
  }

  if (ageDays >= 120) {
    return WORKFLOW_STAGES[3 + (seed % 3)];
  }

  if (ageDays >= 90) {
    return WORKFLOW_STAGES[2 + (seed % 3)];
  }

  if (breached || criticality === "C") {
    return WORKFLOW_STAGES[1 + (seed % 2)];
  }

  return WORKFLOW_STAGES[0];
}

function buildAllocationStoreData(XLSX, rows) {
  const allocationIndex = new Map();
  const storesMap = new Map();

  rows.forEach((row) => {
    const newStoreCode = cleanCode(row["New Store Code"]);
    const oldStoreCode = cleanCode(row["Old Store Code"]);
    const serverCode = cleanCode(row.Server);
    const canonicalStoreId = newStoreCode || oldStoreCode || serverCode;

    if (!canonicalStoreId) {
      return;
    }

    const state = normalizeStateGroup(row["RR STATE"] || row.STATE_2 || row.STATE_1 || row.STATE);
    const store = {
      storeId: canonicalStoreId,
      storeName: cleanText(row["Store Name"]) || canonicalStoreId,
      location: cleanText(row.City) || state,
      region: state,
      state,
      openedDate: parseDate(XLSX, row["Store Launch date"]) || "2020-01-01",
      closedDate: null,
      hkAopCount: parseNumber(row["HK AOP COUNT"]),
      mepcAopCount: parseNumber(row["MEPC AOP COUNT"]),
      city: cleanText(row.City),
      format: cleanText(row["Broad Format"] || row.Format),
      vendor: cleanText(row["IFMS Vendor"]),
    };

    if (!storesMap.has(canonicalStoreId)) {
      storesMap.set(canonicalStoreId, store);
    }

    [newStoreCode, oldStoreCode, serverCode].filter(Boolean).forEach((code) => {
      allocationIndex.set(code, store);
    });
  });

  return {
    stores: Array.from(storesMap.values()),
    allocationIndex,
  };
}

function pickFirstFilledValue(row, fields = []) {
  for (const field of fields) {
    const value = cleanText(row[field]);
    if (value) {
      return value;
    }
  }

  return "";
}

function inferStateHint(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (!text) {
      continue;
    }

    const normalizedState = normalizeStateGroup(text);
    if (normalizedState && normalizedState !== "Unknown") {
      return normalizedState;
    }

    const compact = cleanCode(text).replace(/\s+/g, "");
    const stateMatch = compact.match(/(?:^|[-_/])(AP-?1|AP-?2|TG|TN|KL|KN)(?:[-_/]|$)/);
    if (stateMatch) {
      return normalizeStateGroup(stateMatch[1]);
    }

    if (compact.includes("TELANGANA")) {
      return "TG";
    }

    if (compact.includes("KERALA")) {
      return "KL";
    }

    if (compact.includes("KARNATAKA")) {
      return "KN";
    }

    if (compact.includes("TAMIL")) {
      return "TN";
    }
  }

  return "Unknown";
}

function ensureStoreRecord(storesMap, allocationIndex, candidate) {
  const aliases = candidate.aliases?.map(cleanCode).filter(Boolean) || [];
  const primaryStoreId = cleanCode(candidate.storeId || aliases[0]);

  if (!primaryStoreId) {
    return null;
  }

  const target =
    storesMap.get(primaryStoreId) || {
      storeId: primaryStoreId,
      storeName: primaryStoreId,
      location: "Unknown",
      region: "Unknown",
      state: "Unknown",
      openedDate: "2020-01-01",
      closedDate: null,
      hkAopCount: 0,
      mepcAopCount: 0,
      city: "",
      format: "",
      vendor: "",
    };

  const state = inferStateHint(candidate.state, candidate.region, candidate.stateHint);
  const storeName = cleanText(candidate.storeName) || target.storeName || primaryStoreId;
  const location = cleanText(candidate.location || candidate.city) || (state !== "Unknown" ? state : target.location);
  const hkAopCount = parseNumber(candidate.hkAopCount);
  const mepcAopCount = parseNumber(candidate.mepcAopCount);

  target.storeId = primaryStoreId;
  target.storeName =
    target.storeName && target.storeName !== target.storeId && target.storeName !== "Unknown" ? target.storeName : storeName;
  target.location = target.location && target.location !== "Unknown" ? target.location : location || "Unknown";
  target.region = target.region && target.region !== "Unknown" ? target.region : state || "Unknown";
  target.state = target.state && target.state !== "Unknown" ? target.state : state || "Unknown";
  target.city = target.city || cleanText(candidate.city);
  target.format = target.format || cleanText(candidate.format);
  target.vendor = target.vendor || cleanText(candidate.vendor);
  target.openedDate = target.openedDate || "2020-01-01";
  target.hkAopCount = target.hkAopCount || hkAopCount;
  target.mepcAopCount = target.mepcAopCount || mepcAopCount;

  storesMap.set(primaryStoreId, target);
  [primaryStoreId, ...aliases].forEach((code) => {
    allocationIndex.set(code, target);
  });

  return target;
}

function collectStoresFromRows(storesMap, allocationIndex, rows, mapping) {
  rows.forEach((row) => {
    const storeId = pickFirstFilledValue(row, mapping.storeIdFields);
    if (!storeId) {
      return;
    }

    ensureStoreRecord(storesMap, allocationIndex, {
      storeId,
      storeName: pickFirstFilledValue(row, mapping.storeNameFields),
      state: pickFirstFilledValue(row, mapping.stateFields),
      region: pickFirstFilledValue(row, mapping.regionFields),
      location: pickFirstFilledValue(row, mapping.locationFields),
      city: pickFirstFilledValue(row, mapping.cityFields),
      format: pickFirstFilledValue(row, mapping.formatFields),
      vendor: pickFirstFilledValue(row, mapping.vendorFields),
      aliases: [
        ...mapping.storeIdFields.map((field) => row[field]),
        ...(mapping.aliasFields || []).map((field) => row[field]),
      ],
    });
  });
}

function buildFallbackStoreData(XLSX, { dashboardWorkbook, pendingWorkbook }) {
  const storesMap = new Map();
  const allocationIndex = new Map();

  const registerWorkbookSheet = (workbook, preferredSheetNames, mapping, options = {}) => {
    if (!workbook) {
      return;
    }

    const sheetName = findSheetName(workbook, preferredSheetNames, false);
    if (!sheetName) {
      return;
    }

    const { rows } = readWorkbookRows(XLSX, workbook, preferredSheetNames, { ...options, fallbackToFirst: false });
    collectStoresFromRows(storesMap, allocationIndex, rows, mapping);
  };

  registerWorkbookSheet(
    dashboardWorkbook,
    ["Thermography"],
    {
      storeIdFields: ["Store code"],
      storeNameFields: ["Store Name"],
      stateFields: ["State"],
      locationFields: ["Store Name", "State"],
    },
    { headerRowIndex: 1 },
  );

  registerWorkbookSheet(
    dashboardWorkbook,
    ["Deep cleaning Activity"],
    {
      storeIdFields: ["Store code"],
      storeNameFields: ["Store Name"],
      stateFields: ["State"],
      locationFields: ["Store Name", "State"],
    },
    { headerRowIndex: 1 },
  );

  registerWorkbookSheet(
    dashboardWorkbook,
    ["Manpower Vacancy"],
    {
      storeIdFields: ["Store code"],
      storeNameFields: ["Store Name", "Store code"],
      stateFields: ["State"],
      locationFields: ["Store Name", "State"],
    },
    { headerRowIndex: 1 },
  );

  registerWorkbookSheet(
    dashboardWorkbook,
    ["CMPM"],
    {
      storeIdFields: ["Store code"],
      storeNameFields: ["Store Name"],
      stateFields: ["State"],
      locationFields: ["Store Name", "State"],
      formatFields: ["Format"],
    },
    { headerRowIndex: 1 },
  );

  registerWorkbookSheet(dashboardWorkbook, ["Fault Report"], {
    storeIdFields: ["Store ID", "Store code", "Site"],
    storeNameFields: ["Store Name", "Site Name"],
    stateFields: ["State", "STATE"],
    locationFields: ["Store Name", "State"],
  });

  registerWorkbookSheet(dashboardWorkbook, ["Split Server"], {
    storeIdFields: ["Site", "Store code"],
    storeNameFields: ["Store Name", "Site Name", "Site"],
    stateFields: ["State", "WBS Element"],
    locationFields: ["Store Name", "State", "Site"],
    aliasFields: ["Server"],
  });

  registerWorkbookSheet(dashboardWorkbook, ["M-here BASE"], {
    storeIdFields: ["Site Code"],
    storeNameFields: ["Site Name"],
    stateFields: ["STATE", "State"],
    locationFields: ["Site Name", "STATE"],
  });

  registerWorkbookSheet(pendingWorkbook, ["Pending Tickets"], {
    storeIdFields: ["Store ID", "Store code", "Site"],
    storeNameFields: ["Store Name", "Site Name"],
    stateFields: ["State", "STATE"],
    locationFields: ["Store Name", "State"],
  });

  return {
    stores: Array.from(storesMap.values()),
    allocationIndex,
  };
}

function buildStoreContext(store, fallbackState = "", fallbackName = "") {
  return {
    storeId: store.storeId,
    storeName: store.storeName || fallbackName || store.storeId,
    location: store.location || normalizeStateGroup(fallbackState),
    region: store.region || normalizeStateGroup(fallbackState),
    state: store.state || normalizeStateGroup(fallbackState),
  };
}

function resolveStore(allocationIndex, code) {
  return allocationIndex.get(cleanCode(code));
}

function buildAttendanceRows(XLSX, rows, allocationIndex, config) {
  let excluded = 0;

  const parsedRows = rows.reduce((acc, row) => {
    const storeMatch = resolveStore(allocationIndex, row[config.siteCodeField]);
    if (!storeMatch) {
      excluded += 1;
      return acc;
    }

    const attDate = parseDate(XLSX, row[config.dateField]);
    const month = toMonth(attDate);
    if (!attDate || !month) {
      return acc;
    }

    acc.push({
      ...buildStoreContext(storeMatch, row[config.stateField], row["Store Name"] || row["Site Name"]),
      siteCode: cleanCode(row[config.siteCodeField]),
      epNo: cleanText(row[config.employeeIdField]),
      employeeName: cleanText(row[config.employeeNameField]),
      class: mapAttendanceClass(row[config.classField]),
      rawStatus: cleanText(row[config.statusField]),
      attValue: mapAttendanceValue(row[config.statusField]),
      attDate,
      month,
    });

    return acc;
  }, []);

  return { rows: parsedRows, excluded };
}

function aggregateAttendance(attendanceDailyRows, storesById, stores) {
  const grouped = new Map();
  const monthlyAopCache = new Map();

  const getAdjustedCounts = (storeId, month) => {
    if (!monthlyAopCache.has(month)) {
      monthlyAopCache.set(month, buildAdjustedStoreAopMap(stores, month));
    }

    const store = storesById.get(storeId);
    return (
      monthlyAopCache.get(month).get(storeId) || {
        hkAopCount: parseNumber(store?.hkAopCount),
        mepcAopCount: parseNumber(store?.mepcAopCount),
      }
    );
  };

  attendanceDailyRows.forEach((row) => {
    const key = `${row.storeId}|${row.month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        storeId: row.storeId,
        month: row.month,
        hkMandays: 0,
        mepcMandays: 0,
        uniqueDates: new Set(),
      });
    }

    const current = grouped.get(key);
    current.uniqueDates.add(row.attDate);

    if (row.class === "HK") {
      current.hkMandays += row.attValue;
    } else if (row.class === "MEPC") {
      current.mepcMandays += row.attValue;
    }
  });

  return Array.from(grouped.values()).map((entry) => {
    const store = storesById.get(entry.storeId);
    const adjustedCounts = getAdjustedCounts(entry.storeId, entry.month);
    const daysCount = entry.uniqueDates.size || 1;
    const hkDenominator = (adjustedCounts.hkAopCount || 0) * daysCount;
    const mepcDenominator = (adjustedCounts.mepcAopCount || 0) * getMepcWorkingDays(daysCount);
    const hkPct = hkDenominator ? (entry.hkMandays / hkDenominator) * 100 : null;
    const mepcPct = mepcDenominator ? (entry.mepcMandays / mepcDenominator) * 100 : null;
    const cumulativePct = average([hkPct, mepcPct]);

    return {
      storeId: entry.storeId,
      month: entry.month,
      presentPct: Number(cumulativePct.toFixed(1)),
      absentPct: Number((100 - cumulativePct).toFixed(1)),
      manpowerOnRoll: Number((adjustedCounts.hkAopCount + adjustedCounts.mepcAopCount).toFixed(2)),
      hkMandays: Number(entry.hkMandays.toFixed(1)),
      mepcMandays: Number(entry.mepcMandays.toFixed(1)),
      hkPct: hkPct ? Number(hkPct.toFixed(1)) : 0,
      mepcPct: mepcPct ? Number(mepcPct.toFixed(1)) : 0,
      daysCount,
    };
  });
}

function aggregatePending(ticketRows) {
  const grouped = new Map();

  ticketRows.forEach((row) => {
    const key = `${row.storeId}|${row.month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        storeId: row.storeId,
        month: row.month,
        openJobs: 0,
        overdueJobs: 0,
        criticalCount: 0,
        lastRaisedDate: row.createdAt,
      });
    }

    const current = grouped.get(key);
    current.openJobs += 1;
    current.overdueJobs += row.isOverdue ? 1 : 0;
    current.criticalCount += row.criticality === "C" ? 1 : 0;

    if (row.createdAt && (!current.lastRaisedDate || row.createdAt > current.lastRaisedDate)) {
      current.lastRaisedDate = row.createdAt;
    }
  });

  const ol = [];
  const faults = [];

  grouped.forEach((value) => {
    ol.push({
      storeId: value.storeId,
      month: value.month,
      openJobs: value.openJobs,
      overdueJobs: value.overdueJobs,
      lastRaisedDate: value.lastRaisedDate,
    });

    faults.push({
      storeId: value.storeId,
      month: value.month,
      totalFaults: value.openJobs,
      pendingFaults: value.openJobs,
      delayedJobs: value.overdueJobs,
      status: value.criticalCount > 0 ? "Critical" : value.overdueJobs > 0 ? "Attention" : "Controlled",
    });
  });

  return { ol, faults };
}

function buildPendingTicketsFromSheet(XLSX, rows, allocationIndex) {
  let excluded = 0;

  const ticketRows = rows.reduce((acc, row) => {
    const storeMatch = resolveStore(allocationIndex, row["Store ID"] || row["Store code"] || row.Site);
    if (!storeMatch) {
      excluded += 1;
      return acc;
    }

    const createdAt = parseDate(XLSX, row["Created At "] || row["Created At"]);
    const month = parseMonthValue(row.Month) || toMonth(createdAt);
    const ageingDays = parseNumber(row["Ageing(Days)"] || row.Ageing);
    if (!createdAt || !month) {
      return acc;
    }

    acc.push({
      ...buildStoreContext(storeMatch, row.State || row.State_1, row["Store Name"]),
      ticketNumber: cleanText(row["Ticket Number"]),
      createdAt,
      month,
      status: cleanText(row.Status),
      criticality: cleanCode(row.Criticality),
      ageingDays,
      breachedFlag: cleanText(row["Breached Flag"]),
      isOverdue: cleanCode(row["Breached Flag"]) === "BREACHED" || ageingDays > 2,
      issueTitle: cleanText(row["Issue Title"]),
      category: cleanText(row.Category),
      subCategory: cleanText(row["Sub Category"]),
      workflowStage: inferWorkflowStage(row),
    });

    return acc;
  }, []);

  return { rows: ticketRows, excluded };
}

function aggregateFaultRows(ticketRows) {
  const grouped = new Map();

  ticketRows.forEach((row) => {
    const key = `${row.storeId}|${row.month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        storeId: row.storeId,
        month: row.month,
        totalFaults: 0,
        pendingFaults: 0,
        delayedJobs: 0,
        criticalCount: 0,
      });
    }

    const current = grouped.get(key);
    current.totalFaults += 1;
    current.pendingFaults += 1;
    current.delayedJobs += row.isOverdue ? 1 : 0;
    current.criticalCount += row.criticality === "C" ? 1 : 0;
  });

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    status: item.criticalCount > 0 ? "Critical" : item.delayedJobs > 0 ? "Attention" : "Controlled",
  }));
}

function aggregateOlRows(ticketRows) {
  const grouped = new Map();

  ticketRows.forEach((row) => {
    const key = `${row.storeId}|${row.month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        storeId: row.storeId,
        month: row.month,
        openJobs: 0,
        overdueJobs: 0,
        lastRaisedDate: row.createdAt,
      });
    }

    const current = grouped.get(key);
    current.openJobs += row.isActiveStage ? 1 : 0;
    current.overdueJobs += row.isActiveStage && row.isOverdue ? 1 : 0;

    if (row.createdAt && (!current.lastRaisedDate || row.createdAt > current.lastRaisedDate)) {
      current.lastRaisedDate = row.createdAt;
    }
  });

  return Array.from(grouped.values());
}

function inferOlWorkflowStage(row) {
  const stageText = [
    row.Remark,
    row["Aditional Remark"],
    row["Setoff Status"],
    row.Remark_1,
    row["Aditional Remark_1"],
    row["Setoff Status_1"],
  ]
    .map(cleanCode)
    .filter(Boolean)
    .join(" | ");

  if (stageText.includes("NEED TO DELETE") || stageText.includes("PO TO BE DELETE")) {
    return WORKFLOW_STAGES[10];
  }

  if (stageText.includes("PO DELETED")) {
    return WORKFLOW_STAGES[9];
  }

  if (stageText.includes("PAYMENT RECEIVED")) {
    return WORKFLOW_STAGES[8];
  }

  if (stageText.includes("INVOICE PROCESSED") || stageText.includes("SETOFF")) {
    return WORKFLOW_STAGES[7];
  }

  if (stageText.includes("JMS IN PROGRESS") || stageText.includes("JMS DONE")) {
    return WORKFLOW_STAGES[6];
  }

  if (stageText.includes("CERTIFICATION DONE") || stageText.includes("PENDING FOR JMS CREATION")) {
    return WORKFLOW_STAGES[5];
  }

  if (stageText.includes("AFM") || stageText.includes("CERTIFICATION PENDING")) {
    return WORKFLOW_STAGES[4];
  }

  if (stageText.includes("DOCUMENT PENDING") || stageText.includes("WCC PENDING")) {
    return WORKFLOW_STAGES[3];
  }

  if (stageText.includes("WORK COMPLETED")) {
    return WORKFLOW_STAGES[2];
  }

  if (stageText.includes("WIP") || stageText.includes("WORK IN PROGRESS")) {
    return WORKFLOW_STAGES[1];
  }

  if (
    stageText.includes("DRAFT PO") ||
    stageText.includes("PM- PO") ||
    stageText.includes("REVISED PO REQUIRED") ||
    stageText.includes("FUND REQUEST PENDING") ||
    stageText.includes("FUND PENDING") ||
    cleanCode(row.Status) === "D"
  ) {
    return WORKFLOW_STAGES[0];
  }

  if (parseNumber(row["IV Value"]) > 0) {
    return WORKFLOW_STAGES[7];
  }

  if (cleanCode(row["DLV.CMPL.IND"]) === "X" || parseNumber(row["GRN Value"]) > 0) {
    return WORKFLOW_STAGES[2];
  }

  return WORKFLOW_STAGES[0];
}

function buildOlTicketsFromSheet(XLSX, rows, allocationIndex) {
  let excluded = 0;

  const parsedRows = rows.reduce((acc, row) => {
    const storeMatch = resolveStore(allocationIndex, row["Store code"] || row.Site);
    if (!storeMatch) {
      excluded += 1;
      return acc;
    }

    const createdAt = parseDate(XLSX, row["PO Date"]) || parseDate(XLSX, row["Delivery Date"]);
    const month = toMonth(createdAt);
    if (!createdAt || !month) {
      return acc;
    }

    const workflowStage = inferOlWorkflowStage(row);
    const stageIndex = WORKFLOW_STAGES.indexOf(workflowStage) + 1;
    const ageingDays = getDateDiffInDays(createdAt);
    const isActiveStage = stageIndex > 0 && stageIndex < 9;

    acc.push({
      ...buildStoreContext(storeMatch, row.State),
      ticketNumber: `${cleanText(row["PO Number"])}-${cleanText(row.Item)}`.replace(/-$/, ""),
      createdAt,
      month,
      status: cleanText(row.Status || row["Release Indicator"]),
      criticality: cleanText(row["Doc Type"] || row["Release Indicator"] || "NA"),
      ageingDays,
      breachedFlag: isActiveStage && ageingDays > 30 ? "Breached" : "Within SLA",
      isOverdue: isActiveStage && ageingDays > 30,
      issueTitle: cleanText(row["Article Description"]),
      category: cleanText(row["Doc Type"] || row["Purchasing Group"] || row.Company),
      subCategory: cleanText(row["WBS Element"]),
      workflowStage,
      isActiveStage,
      olStatusNote: [row.Remark, row.Remark_1, row["Aditional Remark_1"], row["Setoff Status_1"]]
        .map(cleanText)
        .filter(Boolean)
        .join(" | "),
    });

    return acc;
  }, []);

  return { rows: parsedRows, excluded };
}

function buildThermographyRows(XLSX, rows, allocationIndex) {
  const grouped = new Map();
  let excluded = 0;

  rows.forEach((row) => {
    const storeMatch = resolveStore(allocationIndex, row["Store code"]);
    if (!storeMatch) {
      excluded += 1;
      return;
    }

    const scheduleDate = parseDate(XLSX, row["Schedule date"]);
    const completionDate = parseDate(XLSX, row["Completion date"]);
    const sharedDate = parseDate(XLSX, row["Report Shared Date"]);
    const month = toMonth(scheduleDate || completionDate || sharedDate);
    if (!month) {
      return;
    }

    const key = `${storeMatch.storeId}|${month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...buildStoreContext(storeMatch, row.State, row["Store Name"]),
        month,
        status: "Inspected",
        lastInspectionDate: null,
        daysPending: 0,
      });
    }

    const current = grouped.get(key);
    const isPending = !(completionDate || sharedDate);
    if (isPending) {
      current.status = "Not Inspected";
      current.daysPending = Math.max(current.daysPending, getDateDiffInDays(scheduleDate));
    }

    const lastInspectionDate = completionDate || sharedDate;
    if (lastInspectionDate && (!current.lastInspectionDate || lastInspectionDate > current.lastInspectionDate)) {
      current.lastInspectionDate = lastInspectionDate;
    }
  });

  return { rows: Array.from(grouped.values()), excluded };
}

function buildCleaningRows(XLSX, rows, allocationIndex) {
  const grouped = new Map();
  let excluded = 0;

  rows.forEach((row) => {
    const storeMatch = resolveStore(allocationIndex, row["Store code"]);
    if (!storeMatch) {
      excluded += 1;
      return;
    }

    const scheduleDate = parseDate(XLSX, row["Schedule date"]);
    const completionDate = parseDate(XLSX, row["Completion date"]);
    const month = toMonth(scheduleDate || completionDate);
    if (!month) {
      return;
    }

    const key = `${storeMatch.storeId}|${month}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...buildStoreContext(storeMatch, row.State, row["Store Name"]),
        month,
        completed: 0,
        pending: 0,
        lastCompletedDate: null,
      });
    }

    const current = grouped.get(key);
    if (completionDate) {
      current.completed += 1;
      if (!current.lastCompletedDate || completionDate > current.lastCompletedDate) {
        current.lastCompletedDate = completionDate;
      }
    } else {
      current.pending += 1;
    }
  });

  return { rows: Array.from(grouped.values()), excluded };
}

function buildManpowerRows(rows, allocationIndex, snapshotMonth) {
  const grouped = new Map();
  let excluded = 0;

  rows.forEach((row) => {
    const storeMatch = resolveStore(allocationIndex, row["Store code"]);
    if (!storeMatch) {
      excluded += 1;
      return;
    }

    const key = `${storeMatch.storeId}|${snapshotMonth}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        ...buildStoreContext(storeMatch, row.State, row["Store Name"]),
        month: snapshotMonth,
        hkAopCount: storeMatch.hkAopCount,
        mepcAopCount: storeMatch.mepcAopCount,
        vacancyCount: 0,
      });
    }

    grouped.get(key).vacancyCount += parseNumber(row["Vacant Count"]);
  });

  const mappedRows = Array.from(grouped.values()).map((row) => {
    const requiredBase = parseNumber(row.hkAopCount) + parseNumber(row.mepcAopCount);
    const required = requiredBase || row.vacancyCount;
    const deployed = Math.max(required - row.vacancyCount, 0);

    return {
      storeId: row.storeId,
      storeName: row.storeName,
      location: row.location,
      region: row.region,
      state: row.state,
      month: row.month,
      required,
      deployed,
      variance: deployed - required,
    };
  });

  return { rows: mappedRows, excluded };
}

function buildCmpmRows(rows, allocationIndex, snapshotMonth) {
  let excluded = 0;

  const parsedRows = rows.reduce((acc, row) => {
    const storeMatch = resolveStore(allocationIndex, row["Store code"]);
    if (!storeMatch) {
      excluded += 1;
      return acc;
    }

    const cmTask = cleanText(row["CM Task"]);
    const pmStatus = cleanText(row["PM Status"]);
    const cmCompleted = cleanCode(cmTask).includes("COMPLETED") ? 1 : 0;
    const pmCompleted = cleanCode(pmStatus).includes("COMPLETED") ? 1 : 0;
    const cmPending = cmTask && !cmCompleted ? 1 : 0;
    const pmPending = pmStatus && !pmCompleted ? 1 : 0;

    acc.push({
      ...buildStoreContext(storeMatch, row.State, row["Store Name"]),
      month: snapshotMonth,
      serialNo: cleanText(row["S.No"]),
      storeCode: cleanCode(row["Store code"]),
      format: cleanText(row.Format || storeMatch.format),
      cmTask: cmTask || "Blank",
      pmStatus: pmStatus || "Blank",
      remarks: cleanText(row.Remarks),
      cmCompleted,
      pmCompleted,
      cmPending,
      pmPending,
      recordCount: 1,
    });

    return acc;
  }, []);

  return { rows: parsedRows, excluded };
}

function getLatestMonth(...collections) {
  const months = collections
    .flat()
    .map((item) => item?.month)
    .filter(Boolean)
    .sort((left, right) => right.localeCompare(left));

  return months[0] || formatDate(new Date()).slice(0, 7);
}

export async function importQpmsWorkflow({ allocationFile, attendanceFile, pendingFile, dashboardFile }) {
  const XLSX = await import("xlsx");
  const attendanceWorkbook = attendanceFile ? await readWorkbook(XLSX, attendanceFile) : null;
  const pendingWorkbook = pendingFile ? await readWorkbook(XLSX, pendingFile) : null;
  const dashboardWorkbook = dashboardFile ? await readWorkbook(XLSX, dashboardFile) : null;

  if (!allocationFile && !pendingWorkbook && !dashboardWorkbook) {
    throw new Error("Upload a Store Allocation workbook or add a dashboard/pending workbook to build report data.");
  }

  let stores = [];
  let allocationIndex = new Map();
  const loadedSheets = [];

  if (allocationFile) {
    const allocationWorkbook = await readWorkbook(XLSX, allocationFile);
    const { rows: allocationRows, sheetName: allocationSheet } = readWorkbookRows(XLSX, allocationWorkbook, ["Sheet1"]);
    const allocationData = buildAllocationStoreData(XLSX, allocationRows);
    stores = allocationData.stores;
    allocationIndex = allocationData.allocationIndex;
    loadedSheets.push({ key: "allocation", sheetName: allocationSheet, rows: allocationRows.length });
  } else {
    const fallbackStoreData = buildFallbackStoreData(XLSX, {
      dashboardWorkbook,
      pendingWorkbook,
    });
    stores = fallbackStoreData.stores;
    allocationIndex = fallbackStoreData.allocationIndex;
  }

  if (!stores.length) {
    throw new Error("Could not derive any store records from the uploaded files. Please add the dashboard workbook or store allocation.");
  }

  const storesById = new Map(stores.map((store) => [store.storeId, store]));

  let attendanceDaily = [];
  let attendance = [];
  let pendingTickets = [];
  let faultTickets = [];
  let olTickets = [];
  let ol = [];
  let faults = [];
  let thermography = [];
  let manpower = [];
  let cleaning = [];
  let cmpm = [];
  let summarySnapshot = null;
  let attendanceImported = 0;
  let attendanceExcluded = 0;
  let pendingImported = 0;
  let pendingExcluded = 0;

  if (attendanceWorkbook) {
    const { rows, sheetName } = readWorkbookRows(XLSX, attendanceWorkbook, ["Attend Status Temp Report"]);
    const attendanceResult = buildAttendanceRows(XLSX, rows, allocationIndex, {
      siteCodeField: "Site Code",
      dateField: "Att. Date",
      classField: "Class",
      statusField: "Att. Status",
      stateField: "STATE",
      employeeIdField: "EP No",
      employeeNameField: "EP Name",
    });

    attendanceDaily = attendanceResult.rows;
    attendanceExcluded = attendanceResult.excluded;
    attendanceImported = attendanceDaily.length;
    attendance = aggregateAttendance(attendanceDaily, storesById, stores);
    loadedSheets.push({ key: "attendance", sheetName, rows: attendanceImported });
  }

  if (pendingWorkbook) {
    const { rows, sheetName } = readWorkbookRows(XLSX, pendingWorkbook, ["Pending Tickets"]);
    const pendingResult = buildPendingTicketsFromSheet(XLSX, rows, allocationIndex);

    pendingTickets = pendingResult.rows;
    pendingExcluded = pendingResult.excluded;
    pendingImported = pendingTickets.length;
    faultTickets = pendingTickets;
    faults = aggregateFaultRows(faultTickets);
    loadedSheets.push({ key: "pending", sheetName, rows: pendingImported });
  }

  if (dashboardWorkbook) {
    summarySnapshot = parseSummarySnapshot(XLSX, dashboardWorkbook);

    if (!attendanceDaily.length) {
      const attendanceSheetName = findSheetName(dashboardWorkbook, ["M-here BASE"], false);
      if (attendanceSheetName) {
        const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["M-here BASE"], { fallbackToFirst: false });
        const attendanceResult = buildAttendanceRows(XLSX, rows, allocationIndex, {
          siteCodeField: "Site Code",
          dateField: "Att. Date",
          classField: "Class",
          statusField: "Att. Status",
          stateField: "STATE",
          employeeIdField: "EP No",
          employeeNameField: "EP Name",
        });

        attendanceDaily = attendanceResult.rows;
        attendanceExcluded += attendanceResult.excluded;
        attendanceImported = attendanceDaily.length;
        attendance = aggregateAttendance(attendanceDaily, storesById, stores);
        loadedSheets.push({ key: "dashboard-attendance", sheetName: attendanceSheetName, rows: attendanceImported });
      }
    }

    const faultSheetName = findSheetName(dashboardWorkbook, ["Fault Report"], false);
    if (faultSheetName) {
      const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["Fault Report"], { fallbackToFirst: false });
      const faultResult = buildPendingTicketsFromSheet(XLSX, rows, allocationIndex);
      if (!faultTickets.length) {
        faultTickets = faultResult.rows;
        faults = aggregateFaultRows(faultTickets);
      }
      loadedSheets.push({ key: "dashboard-faults", sheetName: faultSheetName, rows: faultResult.rows.length });
    }

    const olSheetName = findSheetName(dashboardWorkbook, ["Split Server"], false);
    if (olSheetName) {
      const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["Split Server"], { fallbackToFirst: false });
      const olResult = buildOlTicketsFromSheet(XLSX, rows, allocationIndex);
      olTickets = olResult.rows;
      ol = aggregateOlRows(olTickets);
      loadedSheets.push({ key: "dashboard-ol", sheetName: olSheetName, rows: olTickets.length });
    }

    const thermographySheetName = findSheetName(dashboardWorkbook, ["Thermography"], false);
    if (thermographySheetName) {
      const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["Thermography"], {
        headerRowIndex: 1,
        fallbackToFirst: false,
      });
      const thermographyResult = buildThermographyRows(XLSX, rows, allocationIndex);
      thermography = thermographyResult.rows;
      loadedSheets.push({ key: "dashboard-thermography", sheetName: thermographySheetName, rows: thermography.length });
    }

    const cleaningSheetName = findSheetName(dashboardWorkbook, ["Deep cleaning Activity"], false);
    if (cleaningSheetName) {
      const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["Deep cleaning Activity"], {
        headerRowIndex: 1,
        fallbackToFirst: false,
      });
      const cleaningResult = buildCleaningRows(XLSX, rows, allocationIndex);
      cleaning = cleaningResult.rows;
      loadedSheets.push({ key: "dashboard-cleaning", sheetName: cleaningSheetName, rows: cleaning.length });
    }

    const snapshotMonth = getLatestMonth(attendance, faults, ol, thermography, cleaning);
    const manpowerSheetName = findSheetName(dashboardWorkbook, ["Manpower Vacancy"], false);
    if (manpowerSheetName) {
      const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["Manpower Vacancy"], {
        headerRowIndex: 1,
        fallbackToFirst: false,
      });
      const manpowerResult = buildManpowerRows(rows, allocationIndex, snapshotMonth);
      manpower = manpowerResult.rows;
      loadedSheets.push({ key: "dashboard-manpower", sheetName: manpowerSheetName, rows: manpower.length });
    }

    const cmpmSheetName = findSheetName(dashboardWorkbook, ["CMPM"], false);
    if (cmpmSheetName) {
      const { rows } = readWorkbookRows(XLSX, dashboardWorkbook, ["CMPM"], {
        headerRowIndex: 1,
        fallbackToFirst: false,
      });
      const cmpmResult = buildCmpmRows(rows, allocationIndex, snapshotMonth);
      cmpm = cmpmResult.rows;
      loadedSheets.push({ key: "dashboard-cmpm", sheetName: cmpmSheetName, rows: cmpm.length });
    }
  }

  if (!faultTickets.length && pendingTickets.length) {
    faultTickets = pendingTickets;
    faults = aggregatePending(pendingTickets).faults;
  }

  const missingSheets = [];
  if (!attendanceDaily.length) {
    missingSheets.push("attendance raw / M-here BASE");
  }
  if (!faultTickets.length) {
    missingSheets.push("fault report");
  }
  if (!olTickets.length) {
    missingSheets.push("split server / OL tracker");
  }
  if (!thermography.length) {
    missingSheets.push("thermography");
  }
  if (!manpower.length) {
    missingSheets.push("manpower vacancy");
  }
  if (!cleaning.length) {
    missingSheets.push("deep cleaning activity");
  }
  if (!cmpm.length) {
    missingSheets.push("cmpm");
  }

  return {
    dataSource: {
      stores,
      attendance,
      faults,
      ol,
      thermography,
      manpower,
      cleaning,
      cmpm,
      attendanceDaily,
      pendingTickets,
      overallPendingTickets: pendingTickets,
      faultTickets,
      olTickets,
    },
    info: {
      mode: "qpms",
      fileName: dashboardFile ? dashboardFile.name : "QPMS workflow files",
      loadedSheets,
      missingSheets,
      error: "",
      sources: {
        allocationFile: allocationFile?.name || null,
        attendanceFile: attendanceFile?.name || null,
        pendingFile: pendingFile?.name || null,
        dashboardFile: dashboardFile?.name || null,
      },
      stats: {
        stores: stores.length,
        attendanceImported,
        attendanceExcluded,
        pendingImported,
        pendingExcluded,
        faultTickets: faultTickets.length,
        olTickets: olTickets.length,
        thermography: thermography.length,
        manpower: manpower.length,
        cleaning: cleaning.length,
        cmpm: cmpm.length,
      },
      summarySnapshot,
    },
  };
}
