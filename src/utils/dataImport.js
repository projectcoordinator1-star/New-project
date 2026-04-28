const sheetAliases = {
  stores: ["stores", "storemaster", "masterdata", "master", "store master"],
  attendance: ["attendance", "attendance report", "attendance reports"],
  faults: ["faultreport", "fault report", "faults", "fault"],
  ol: ["olreport", "ol report", "overallpending", "overall pending", "openjobs", "ol"],
  thermography: ["thermography", "thermo", "thermo report"],
  manpower: ["manpower", "manpower report"],
  cleaning: ["deepcleaning", "deep cleaning", "cleaning", "deep cleaning report"],
};

const fieldAliases = {
  stores: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    storename: "storeName",
    sitename: "storeName",
    store: "storeName",
    location: "location",
    city: "location",
    region: "region",
    zone: "region",
    openeddate: "openedDate",
    opendate: "openedDate",
    startdate: "openedDate",
    closeddate: "closedDate",
    closuredate: "closedDate",
    shutdate: "closedDate",
  },
  attendance: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    month: "month",
    reportmonth: "month",
    period: "month",
    date: "month",
    presentpct: "presentPct",
    attendancepct: "presentPct",
    attendancepercentage: "presentPct",
    presentpercentage: "presentPct",
    absentpct: "absentPct",
    absencepct: "absentPct",
    absentpercentage: "absentPct",
    manpoweronroll: "manpowerOnRoll",
    headcount: "manpowerOnRoll",
    onroll: "manpowerOnRoll",
  },
  faults: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    month: "month",
    reportmonth: "month",
    period: "month",
    totalfaults: "totalFaults",
    faults: "totalFaults",
    pendingfaults: "pendingFaults",
    openfaults: "pendingFaults",
    delayedjobs: "delayedJobs",
    delayedfaults: "delayedJobs",
    status: "status",
  },
  ol: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    month: "month",
    reportmonth: "month",
    period: "month",
    openjobs: "openJobs",
    totalopenjobs: "openJobs",
    overduejobs: "overdueJobs",
    pendingjobs: "overdueJobs",
    lastraiseddate: "lastRaisedDate",
    raiseddate: "lastRaisedDate",
    lastoldate: "lastRaisedDate",
  },
  thermography: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    month: "month",
    reportmonth: "month",
    period: "month",
    status: "status",
    thermographystatus: "status",
    lastinspectiondate: "lastInspectionDate",
    inspectiondate: "lastInspectionDate",
    dayspending: "daysPending",
    pendingdays: "daysPending",
  },
  manpower: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    month: "month",
    reportmonth: "month",
    period: "month",
    deployed: "deployed",
    manpowerdeployed: "deployed",
    actualdeployed: "deployed",
    required: "required",
    manpowerrequired: "required",
    totalrequired: "required",
    variance: "variance",
    gap: "variance",
  },
  cleaning: {
    storeid: "storeId",
    storecode: "storeId",
    siteid: "storeId",
    month: "month",
    reportmonth: "month",
    period: "month",
    completed: "completed",
    completedjobs: "completed",
    pending: "pending",
    pendingjobs: "pending",
    lastcompleteddate: "lastCompletedDate",
    completeddate: "lastCompletedDate",
    lastcleaningdate: "lastCompletedDate",
  },
};

const dateFields = new Set(["openedDate", "closedDate", "lastRaisedDate", "lastInspectionDate", "lastCompletedDate"]);
const numericFields = new Set([
  "presentPct",
  "absentPct",
  "manpowerOnRoll",
  "totalFaults",
  "pendingFaults",
  "delayedJobs",
  "openJobs",
  "overdueJobs",
  "daysPending",
  "deployed",
  "required",
  "variance",
  "completed",
  "pending",
]);

function normalizeLabel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/%/g, "pct")
    .replace(/[^a-z0-9]+/g, "");
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toExcelDate(XLSX, value) {
  const parsed = XLSX.SSF.parse_date_code(value);
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

  if (typeof value === "number") {
    const excelDate = toExcelDate(XLSX, value);
    return excelDate ? formatDate(excelDate) : null;
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? String(value).trim() : formatDate(parsed);
}

function parseMonth(XLSX, value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const parsedDate = parseDate(XLSX, value);
  if (!parsedDate) {
    return null;
  }

  return parsedDate.slice(0, 7);
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveSheetName(sheetNames, key) {
  const aliases = sheetAliases[key];
  return sheetNames.find((sheetName) => {
    const normalized = normalizeLabel(sheetName);
    return aliases.some((alias) => normalized === normalizeLabel(alias) || normalized.includes(normalizeLabel(alias)));
  });
}

function normalizeSheetRows(XLSX, rows, type) {
  const aliases = fieldAliases[type];

  return rows
    .map((row) => {
      const normalized = {};

      Object.entries(row).forEach(([header, value]) => {
        const mappedKey = aliases[normalizeLabel(header)];
        if (!mappedKey) {
          return;
        }

        if (mappedKey === "month") {
          normalized[mappedKey] = parseMonth(XLSX, value);
        } else if (dateFields.has(mappedKey)) {
          normalized[mappedKey] = parseDate(XLSX, value);
        } else if (numericFields.has(mappedKey)) {
          normalized[mappedKey] = parseNumber(value);
        } else {
          normalized[mappedKey] = value === null || value === undefined ? null : String(value).trim();
        }
      });

      if (!normalized.month) {
        const fallbackMonth =
          normalized.lastInspectionDate ||
          normalized.lastRaisedDate ||
          normalized.lastCompletedDate ||
          normalized.openedDate ||
          null;
        normalized.month = parseMonth(XLSX, fallbackMonth);
      }

      if (type === "manpower" && normalized.variance === null) {
        const deployed = parseNumber(normalized.deployed);
        const required = parseNumber(normalized.required);
        if (required !== null && deployed !== null) {
          normalized.variance = deployed - required;
        }
      }

      if (!normalized.storeId) {
        return null;
      }

      if (type !== "stores" && !normalized.month) {
        return null;
      }

      return normalized;
    })
    .filter(Boolean);
}

export async function importWorkbook(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const loadedSheets = [];
  const missingSheets = [];
  const dataSource = {
    stores: [],
    attendance: [],
    faults: [],
    ol: [],
    thermography: [],
    manpower: [],
    cleaning: [],
  };

  Object.keys(dataSource).forEach((key) => {
    const sheetName = resolveSheetName(workbook.SheetNames, key);
    if (!sheetName) {
      missingSheets.push(key);
      return;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
    dataSource[key] = normalizeSheetRows(XLSX, rows, key);
    loadedSheets.push({ key, sheetName, rows: dataSource[key].length });
  });

  if (!dataSource.stores.length) {
    throw new Error(
      "The uploaded Excel file needs a Stores sheet with at least a storeId column. Supported sheet names: Stores, Master Data, or Store Master.",
    );
  }

  return {
    dataSource,
    loadedSheets,
    missingSheets,
  };
}
