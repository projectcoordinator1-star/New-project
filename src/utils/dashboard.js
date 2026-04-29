import { getMepcWorkingDays } from "./qpmsWorkflow";
import { buildAdjustedStoreAopMap, buildStateAopMap } from "./aopOverrides";
import { roundNumber } from "./formatters";
import { OPERATIONAL_STATE_ORDER, normalizeOperationalState, sortOperationalStates } from "./stateGroups";

const safeNumber = (value) => (Number.isFinite(value) ? value : 0);

export const viewReportTypeMap = {
  dashboard: "All Reports",
  reports: "All Reports",
  "po-lab": "PO Lab",
  attendance: "Attendance",
  faults: "Fault Report",
  ol: "OL Report",
  thermography: "Thermography",
  manpower: "Manpower",
  cleaning: "Deep Cleaning",
  cmpm: "CMPM",
  stores: "Stores",
  "data-sync": "All Reports",
};

export const viewMeta = {
  dashboard: {
    eyebrow: "Prototype Demonstration",
    title: "QPMS Operations Dashboard",
    description:
      "Real-time operational visibility across attendance, fault reports, thermography, manpower, and cleaning.",
    badge: "Replace Excel-driven reporting with one unified operational view.",
  },
  reports: {
    eyebrow: "Pivot Workspace",
    title: "Reports Pivot Builder",
    description:
      "Choose a report type, drag fields into Filters, Columns, Rows, and Values, and preview the pivot output before exporting.",
    badge: "Built to feel closer to an Excel pivot builder than a fixed report page.",
  },
  "po-lab": {
    eyebrow: "PO Prototype",
    title: "Service Master Suggestion Lab",
    description:
      "Upload the service master workbook, search generic fault keywords, and test how service-code suggestions can feed a PO request flow.",
    badge: "This page is designed as the first building block for supervisor-led PO creation without OCR.",
  },
  attendance: {
    eyebrow: "Operations Report",
    title: "Attendance Report",
    description: "Track present percentage, absenteeism, and manpower-on-roll by store for the selected month.",
    badge: "Designed to replace manual attendance consolidation from Excel.",
  },
  faults: {
    eyebrow: "Operations Report",
    title: "Fault Report",
    description: "Review open faults, pending actions, and delayed closures across all active stores.",
    badge: "Critical and delayed stores are highlighted for faster follow-up.",
  },
  ol: {
    eyebrow: "Operations Report",
    title: "OL Report",
    description: "Monitor open jobs, overdue items, and recent OL activity in a dedicated report screen.",
    badge: "Built for daily operational review and escalation tracking.",
  },
  thermography: {
    eyebrow: "Operations Report",
    title: "Thermography Report",
    description: "Filter inspected and not-inspected sites with store lifecycle awareness and export options.",
    badge: "This view is ideal for your management demo around compliance visibility.",
  },
  manpower: {
    eyebrow: "Operations Report",
    title: "Manpower Report",
    description: "Compare deployed vs required manpower and identify shortage pockets across locations.",
    badge: "Use this tab to explain staffing gaps and resource planning.",
  },
  cleaning: {
    eyebrow: "Operations Report",
    title: "Deep Cleaning Report",
    description: "Track cleaning completion, pending actions, and last completed dates from one place.",
    badge: "Useful for SLA and hygiene compliance reporting.",
  },
  cmpm: {
    eyebrow: "Operations Report",
    title: "CMPM Report",
    description: "Track CM task completion and PM status by store from the IFMS Dashboard CMPM sheet.",
    badge: "Useful for store-wise preventive and corrective maintenance follow-up.",
  },
  stores: {
    eyebrow: "Master Data",
    title: "Store Master",
    description: "Review active and closed stores with open and close dates applied to report visibility.",
    badge: "This master dataset powers every transactional report using storeId.",
  },
  "data-sync": {
    eyebrow: "Admin Workflow",
    title: "Data Sync Center",
    description: "Load QPMS source files here, process them once, and keep the operational demo screens clean.",
    badge: "This admin page keeps Excel out of the management demo flow.",
  },
};

const fallbackMonth = "2025-01";

const getArray = (dataSource, key) => (Array.isArray(dataSource?.[key]) ? dataSource[key] : []);

function formatDate(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getReportRecord(records, storeId, month) {
  const exactMatch = records.find((item) => item.storeId === storeId && item.month === month);
  if (exactMatch) {
    return exactMatch;
  }

  const storeRecords = records
    .filter((item) => item.storeId === storeId && String(item.month || "") <= String(month || ""))
    .sort((left, right) => String(right.month || "").localeCompare(String(left.month || "")));

  return storeRecords[0] || null;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

export function formatMonthLabel(monthValue) {
  if (!monthValue) {
    return "Select Month";
  }

  const [year, month] = String(monthValue).split("-");
  if (!year || !month) {
    return monthValue;
  }

  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function getAvailableMonths(dataSource) {
  const values = ["attendance", "faults", "ol", "thermography", "manpower", "cleaning", "cmpm"]
    .flatMap((key) => getArray(dataSource, key))
    .map((item) => item.month)
    .filter(Boolean);

  const uniqueMonths = [...new Set(values)].sort((left, right) => right.localeCompare(left));
  return uniqueMonths.length ? uniqueMonths : [fallbackMonth];
}

export function getDefaultMonth(dataSource) {
  return getAvailableMonths(dataSource)[0];
}

export function isStoreActiveInMonth(store, month) {
  const selected = new Date(`${month}-01`);
  const startOfMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const endOfMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0);
  const openedDate = store.openedDate ? new Date(store.openedDate) : new Date("2000-01-01");
  const closedDate = store.closedDate ? new Date(store.closedDate) : null;

  return openedDate <= endOfMonth && (!closedDate || closedDate >= startOfMonth);
}

export function createUnifiedDataset(dataSource, month) {
  const stores = getArray(dataSource, "stores");
  const scopedStores = stores.filter((store) => isStoreActiveInMonth(store, month));

  return scopedStores.map((store) => {
    const attendance = getReportRecord(getArray(dataSource, "attendance"), store.storeId, month);
    const faults = getReportRecord(getArray(dataSource, "faults"), store.storeId, month);
    const ol = getReportRecord(getArray(dataSource, "ol"), store.storeId, month);
    const thermography = getReportRecord(getArray(dataSource, "thermography"), store.storeId, month);
    const manpower = getReportRecord(getArray(dataSource, "manpower"), store.storeId, month);
    const cleaning = getReportRecord(getArray(dataSource, "cleaning"), store.storeId, month);
    const cmpm = getReportRecord(getArray(dataSource, "cmpm"), store.storeId, month);

    const issueCount =
      safeNumber(faults?.pendingFaults) +
      safeNumber(ol?.overdueJobs) +
      safeNumber(cleaning?.pending) +
      safeNumber(cmpm?.cmPending) +
      safeNumber(cmpm?.pmPending) +
      (thermography?.status === "Not Inspected" ? 1 : 0);

    const delayed = safeNumber(faults?.delayedJobs) > 0 || safeNumber(ol?.overdueJobs) > 1;
    const isClosed = Boolean(store.closedDate && new Date(store.closedDate) < new Date(`${month}-01`));

    return {
      ...store,
      attendance,
      faults,
      ol,
      thermography,
      manpower,
      cleaning,
      cmpm,
      issueCount,
      delayed,
      isClosed,
      lifecycleStatus: isClosed ? "Closed" : "Active",
      riskStatus:
        safeNumber(faults?.pendingFaults) >= 5 || thermography?.status === "Not Inspected"
          ? "Critical"
          : delayed
            ? "Attention"
            : "Healthy",
    };
  });
}

export function getFilterOptions(data) {
  const unique = (values) => ["All", ...new Set(values.filter(Boolean))];
  const operationalRegions = [
    "All",
    ...sortOperationalStates([...new Set(data.map((item) => normalizeOperationalState(item.region)).filter((state) => OPERATIONAL_STATE_ORDER.includes(state)))]),
  ];

  return {
    locations: unique(data.map((item) => item.location)),
    storeIds: unique(data.map((item) => item.storeId)),
    regions: operationalRegions,
    statuses: ["All", "Healthy", "Attention", "Critical"],
    reportTypes: Object.values(viewReportTypeMap),
  };
}

export function filterUnifiedData(data, filters) {
  return data.filter((row) => {
    const matchesLocation = filters.location === "All" || row.location === filters.location;
    const matchesStore = filters.storeId === "All" || row.storeId === filters.storeId;
    const matchesRegion = filters.region === "All" || normalizeOperationalState(row.region) === filters.region;
    const matchesStatus = filters.status === "All" || row.riskStatus === filters.status;
    const matchesSearch =
      !filters.search ||
      `${row.storeId} ${row.storeName} ${row.location} ${row.region}`.toLowerCase().includes(filters.search.toLowerCase());

    let matchesReportType = true;

    if (filters.reportType === "Attendance") {
      matchesReportType = Boolean(row.attendance);
    } else if (filters.reportType === "Fault Report") {
      matchesReportType = safeNumber(row.faults?.totalFaults) > 0;
    } else if (filters.reportType === "OL Report") {
      matchesReportType = safeNumber(row.ol?.openJobs) > 0;
    } else if (filters.reportType === "Thermography") {
      matchesReportType = Boolean(row.thermography);
    } else if (filters.reportType === "Manpower") {
      matchesReportType = Boolean(row.manpower);
    } else if (filters.reportType === "Deep Cleaning") {
      matchesReportType = Boolean(row.cleaning);
    } else if (filters.reportType === "CMPM") {
      matchesReportType = Boolean(row.cmpm);
    } else if (filters.reportType === "Stores") {
      matchesReportType = true;
    }

    return matchesLocation && matchesStore && matchesRegion && matchesStatus && matchesReportType && matchesSearch;
  });
}

export function calculateKpis(data, reportType) {
  if (reportType === "Attendance") {
    const attendanceAverage = average(data.map((row) => safeNumber(row.attendance?.presentPct)));
    const absenceAverage = average(data.map((row) => safeNumber(row.attendance?.absentPct)));
    const manpowerOnRoll = data.reduce((sum, row) => sum + safeNumber(row.attendance?.manpowerOnRoll), 0);
    const lowAttendance = data.filter((row) => safeNumber(row.attendance?.presentPct) < 90).length;

    return [
      { title: "Stores Reported", value: data.length, note: "Attendance records in view", tone: "blue" },
      { title: "Attendance %", value: `${attendanceAverage.toFixed(1)}%`, note: "Average presence", tone: "green" },
      { title: "Absent %", value: `${absenceAverage.toFixed(1)}%`, note: "Average absence", tone: "amber" },
      { title: "Headcount", value: manpowerOnRoll, note: "Manpower on roll", tone: "purple" },
      { title: "Low Attendance", value: lowAttendance, note: "Below 90% attendance", tone: "red" },
    ];
  }

  if (reportType === "Fault Report") {
    const totalFaults = data.reduce((sum, row) => sum + safeNumber(row.faults?.totalFaults), 0);
    const pendingFaults = data.reduce((sum, row) => sum + safeNumber(row.faults?.pendingFaults), 0);
    const delayedJobs = data.reduce((sum, row) => sum + safeNumber(row.faults?.delayedJobs), 0);
    const criticalStores = data.filter((row) => safeNumber(row.faults?.pendingFaults) >= 5).length;

    return [
      { title: "Stores Reported", value: data.length, note: "Fault records in view", tone: "blue" },
      { title: "Total Faults", value: totalFaults, note: "Raised in selected month", tone: "purple" },
      { title: "Pending Faults", value: pendingFaults, note: "Open follow-up items", tone: "amber" },
      { title: "Delayed Jobs", value: delayedJobs, note: "Pending beyond SLA", tone: "red" },
      { title: "Critical Stores", value: criticalStores, note: "5+ pending faults", tone: "green" },
    ];
  }

  if (reportType === "OL Report") {
    const openJobs = data.reduce((sum, row) => sum + safeNumber(row.ol?.openJobs), 0);
    const overdueJobs = data.reduce((sum, row) => sum + safeNumber(row.ol?.overdueJobs), 0);
    const activeStores = data.filter((row) => safeNumber(row.ol?.openJobs) > 0).length;
    const severeStores = data.filter((row) => safeNumber(row.ol?.overdueJobs) > 1).length;

    return [
      { title: "Stores Reported", value: data.length, note: "OL records in view", tone: "blue" },
      { title: "Open Jobs", value: openJobs, note: "Current OL workload", tone: "purple" },
      { title: "Overdue Jobs", value: overdueJobs, note: "Need escalation", tone: "red" },
      { title: "Active Stores", value: activeStores, note: "Stores with OL activity", tone: "green" },
      { title: "Escalation Stores", value: severeStores, note: "More than 1 overdue OL item", tone: "amber" },
    ];
  }

  if (reportType === "Thermography") {
    const inspected = data.filter((row) => row.thermography?.status === "Inspected").length;
    const notInspected = data.filter((row) => row.thermography?.status === "Not Inspected").length;
    const inspectionPct = data.length ? (inspected / data.length) * 100 : 0;
    const maxPending = Math.max(...data.map((row) => safeNumber(row.thermography?.daysPending)), 0);

    return [
      { title: "Total Stores", value: data.length, note: "Thermography records in view", tone: "blue" },
      { title: "Inspected", value: inspected, note: "Completed stores", tone: "green" },
      { title: "Not Inspected", value: notInspected, note: "Pending stores", tone: "red" },
      { title: "Inspection %", value: `${inspectionPct.toFixed(1)}%`, note: "Completion rate", tone: "purple" },
      { title: "Max Days Pending", value: maxPending, note: "Oldest pending site", tone: "amber" },
    ];
  }

  if (reportType === "Manpower") {
    const required = data.reduce((sum, row) => sum + safeNumber(row.manpower?.required), 0);
    const deployed = data.reduce((sum, row) => sum + safeNumber(row.manpower?.deployed), 0);
    const gap = data.reduce((sum, row) => sum + Math.abs(Math.min(safeNumber(row.manpower?.variance), 0)), 0);
    const shortageStores = data.filter((row) => safeNumber(row.manpower?.variance) < 0).length;

    return [
      { title: "Stores Reported", value: data.length, note: "Manpower records in view", tone: "blue" },
      { title: "Required", value: required, note: "Total manpower required", tone: "purple" },
      { title: "Deployed", value: deployed, note: "Actual deployed manpower", tone: "green" },
      { title: "Gap", value: gap, note: "Total shortage", tone: "red" },
      { title: "Shortage Stores", value: shortageStores, note: "Need staffing intervention", tone: "amber" },
    ];
  }

  if (reportType === "Deep Cleaning") {
    const completed = data.reduce((sum, row) => sum + safeNumber(row.cleaning?.completed), 0);
    const pending = data.reduce((sum, row) => sum + safeNumber(row.cleaning?.pending), 0);
    const completionPct = completed + pending ? (completed / (completed + pending)) * 100 : 0;
    const pendingStores = data.filter((row) => safeNumber(row.cleaning?.pending) > 0).length;

    return [
      { title: "Stores Reported", value: data.length, note: "Cleaning records in view", tone: "blue" },
      { title: "Completed Jobs", value: completed, note: "Deep cleaning completed", tone: "green" },
      { title: "Pending Jobs", value: pending, note: "Action still pending", tone: "red" },
      { title: "Completion %", value: `${completionPct.toFixed(1)}%`, note: "Overall completion rate", tone: "purple" },
      { title: "Pending Stores", value: pendingStores, note: "Need follow-up", tone: "amber" },
    ];
  }

  if (reportType === "CMPM") {
    const records = data.reduce((sum, row) => sum + safeNumber(row.cmpm?.recordCount || (row.cmpm ? 1 : 0)), 0);
    const cmCompleted = data.reduce((sum, row) => sum + safeNumber(row.cmpm?.cmCompleted), 0);
    const pmCompleted = data.reduce((sum, row) => sum + safeNumber(row.cmpm?.pmCompleted), 0);
    const cmPending = data.reduce((sum, row) => sum + safeNumber(row.cmpm?.cmPending), 0);
    const pmPending = data.reduce((sum, row) => sum + safeNumber(row.cmpm?.pmPending), 0);

    return [
      { title: "Stores Reported", value: data.length, note: "CMPM records in view", tone: "blue" },
      { title: "CM Completed", value: cmCompleted, note: "Corrective maintenance tasks", tone: "green" },
      { title: "PM Completed", value: pmCompleted, note: "Preventive maintenance status", tone: "purple" },
      { title: "CM Pending", value: cmPending, note: "CM follow-up needed", tone: "amber" },
      { title: "PM Pending", value: pmPending, note: "PM follow-up needed", tone: "red" },
    ];
  }

  if (reportType === "Stores") {
    const activeStores = data.filter((row) => String(row.status || row.lifecycleStatus).toLowerCase() === "active").length;
    const stateCounts = OPERATIONAL_STATE_ORDER.map((state) => ({
      state,
      count: data.filter((row) => normalizeOperationalState(row.region) === state).length,
    })).filter((item) => item.count > 0);

    return [
      { title: "Master Stores", value: data.length, note: "Official store master rows", tone: "blue" },
      { title: "Active Stores", value: activeStores, note: "Status marked active", tone: "green" },
      { title: "States", value: stateCounts.length, note: "Operational state groups", tone: "purple" },
      { title: "Top State", value: stateCounts.sort((left, right) => right.count - left.count)[0]?.state || "NA", note: "Highest store count", tone: "amber" },
      { title: "Business Types", value: new Set(data.map((row) => row.business).filter(Boolean)).size, note: "Unique business labels", tone: "red" },
    ];
  }

  const totals = data.reduce(
    (acc, row) => {
      acc.totalStores += 1;
      acc.pendingFaults += safeNumber(row.faults?.pendingFaults);
      acc.delayedJobs += safeNumber(row.faults?.delayedJobs) + safeNumber(row.ol?.overdueJobs);
      acc.attendanceTotal += safeNumber(row.attendance?.presentPct);
      acc.notInspected += row.thermography?.status === "Not Inspected" ? 1 : 0;
      return acc;
    },
    { totalStores: 0, pendingFaults: 0, delayedJobs: 0, attendanceTotal: 0, notInspected: 0 },
  );

  const attendancePct = totals.totalStores ? totals.attendanceTotal / totals.totalStores : 0;

  return [
    { title: "Total Stores", value: totals.totalStores, note: "Active for selected month", tone: "blue" },
    { title: "Pending Faults", value: totals.pendingFaults, note: "Across filtered stores", tone: "amber" },
    { title: "Attendance %", value: `${attendancePct.toFixed(1)}%`, note: "Average monthly presence", tone: "green" },
    { title: "Delayed Jobs", value: totals.delayedJobs, note: "Fault + OL overdue items", tone: "red" },
    { title: "Not Inspected", value: totals.notInspected, note: "Thermography pending", tone: "purple" },
  ];
}

export function buildPivotRows(data, groupBy) {
  const bucket = new Map();

  data.forEach((row) => {
    const key = row[groupBy] || "Unknown";
    if (!bucket.has(key)) {
      bucket.set(key, {
        group: key,
        totalStores: 0,
        attendancePct: 0,
        pendingFaults: 0,
        delayedJobs: 0,
        notInspected: 0,
        manpowerGap: 0,
      });
    }

    const current = bucket.get(key);
    current.totalStores += 1;
    current.attendancePct += safeNumber(row.attendance?.presentPct);
    current.pendingFaults += safeNumber(row.faults?.pendingFaults);
    current.delayedJobs += safeNumber(row.faults?.delayedJobs) + safeNumber(row.ol?.overdueJobs);
    current.notInspected += row.thermography?.status === "Not Inspected" ? 1 : 0;
    current.manpowerGap += Math.abs(Math.min(safeNumber(row.manpower?.variance), 0));
  });

  return Array.from(bucket.values()).map((entry) => ({
    ...entry,
    attendancePct: entry.totalStores ? entry.attendancePct / entry.totalStores : 0,
  }));
}

export function buildTrendSnapshot(dataSource) {
  const recentMonths = getAvailableMonths(dataSource).slice(0, 6).reverse();

  return recentMonths.map((month) => {
    const dataset = createUnifiedDataset(dataSource, month);
    const attendance = average(dataset.map((row) => safeNumber(row.attendance?.presentPct)));
    const pendingFaults = dataset.reduce((sum, row) => sum + safeNumber(row.faults?.pendingFaults), 0);
    const notInspected = dataset.filter((row) => row.thermography?.status === "Not Inspected").length;

    return {
      month: formatMonthLabel(month).split(" ")[0],
      attendance,
      pendingFaults,
      notInspected,
    };
  });
}

function isRawAttendanceRows(rows = []) {
  return rows.some((row) => row?.epNo || row?.attDate || row?.rawStatus);
}

function getReportColumns(reportType, rows = []) {
  if (reportType === "Attendance" && isRawAttendanceRows(rows)) {
    return [
      "EP No",
      "EP Name",
      "Manager Name",
      "Manager EC No",
      "Site Code",
      "Site Name",
      "State",
      "Class",
      "Att. Date",
      "Att. Status",
      "In Time",
      "Out Time",
      "Man Hours",
    ];
  }

  if (reportType === "Attendance") {
    return ["Store ID", "Store Name", "Location", "Region", "Present %", "Absent %", "Manpower On Roll", "Risk Status"];
  }

  if (reportType === "Fault Report") {
    return ["Store ID", "Store Name", "Location", "Region", "Total Faults", "Pending Faults", "Delayed Jobs", "Status"];
  }

  if (reportType === "OL Report") {
    return ["Store ID", "Store Name", "Location", "Region", "Open Jobs", "Overdue Jobs", "Last Raised Date", "Risk Status"];
  }

  if (reportType === "Thermography") {
    return ["Store ID", "Store Name", "Location", "Region", "Last Inspection Date", "Status", "Days Pending"];
  }

  if (reportType === "Manpower") {
    return ["Store ID", "Store Name", "Location", "Region", "Required", "Deployed", "Variance", "Risk Status"];
  }

  if (reportType === "Deep Cleaning") {
    return ["Store ID", "Store Name", "Location", "Region", "Completed", "Pending", "Last Completed Date", "Risk Status"];
  }

  if (reportType === "Stores") {
    return ["Store Code", "State", "Server", "Business", "Status"];
  }

  return [
    "Store ID",
    "Store Name",
    "Location",
    "Region",
    "Attendance %",
    "Pending Faults",
    "Delayed Jobs",
    "Thermography",
    "Manpower Gap",
    "Deep Cleaning Pending",
    "Risk Status",
  ];
}

function getReportRows(rows, reportType) {
  return rows.map((row) => {
    if (reportType === "Attendance" && isRawAttendanceRows([row])) {
      return [
        row.epNo,
        row.employeeName,
        row.managerName,
        row.managerCode,
        row.storeId,
        row.storeName,
        row.state || row.region,
        row.class,
        row.attDate,
        roundNumber(row.attValue ?? row.rawStatus ?? 0),
        row.inTime,
        row.outTime,
        row.manHours,
      ];
    }

    if (reportType === "Attendance") {
      return [
        row.storeId,
        row.storeName,
        row.location,
        row.region,
        roundNumber(row.attendance?.presentPct ?? 0),
        roundNumber(row.attendance?.absentPct ?? 0),
        roundNumber(row.attendance?.manpowerOnRoll ?? 0),
        row.riskStatus,
      ];
    }

    if (reportType === "Fault Report") {
      return [
        row.storeId,
        row.storeName,
        row.location,
        row.region,
        roundNumber(row.faults?.totalFaults ?? 0),
        roundNumber(row.faults?.pendingFaults ?? 0),
        roundNumber(row.faults?.delayedJobs ?? 0),
        row.faults?.status ?? row.riskStatus,
      ];
    }

    if (reportType === "OL Report") {
      return [
        row.storeId,
        row.storeName,
        row.location,
        row.region,
        roundNumber(row.ol?.openJobs ?? 0),
        roundNumber(row.ol?.overdueJobs ?? 0),
        row.ol?.lastRaisedDate ?? "",
        row.riskStatus,
      ];
    }

    if (reportType === "Thermography") {
      return [
        row.storeId,
        row.storeName,
        row.location,
        row.region,
        row.thermography?.lastInspectionDate ?? "",
        row.thermography?.status ?? "No Record",
        roundNumber(row.thermography?.daysPending ?? 0),
      ];
    }

    if (reportType === "Manpower") {
      return [
        row.storeId,
        row.storeName,
        row.location,
        row.region,
        roundNumber(row.manpower?.required ?? 0),
        roundNumber(row.manpower?.deployed ?? 0),
        roundNumber(row.manpower?.variance ?? 0),
        row.riskStatus,
      ];
    }

    if (reportType === "Deep Cleaning") {
      return [
        row.storeId,
        row.storeName,
        row.location,
        row.region,
        roundNumber(row.cleaning?.completed ?? 0),
        roundNumber(row.cleaning?.pending ?? 0),
        row.cleaning?.lastCompletedDate ?? "",
        row.riskStatus,
      ];
    }

    if (reportType === "Stores") {
      return [
        row.storeId,
        row.region,
        row.server ?? "",
        row.business ?? row.storeName ?? "",
        row.status ?? row.lifecycleStatus,
      ];
    }

    return [
      row.storeId,
      row.storeName,
      row.location,
      row.region,
      roundNumber(row.attendance?.presentPct ?? 0),
      roundNumber(row.faults?.pendingFaults ?? 0),
      roundNumber((row.faults?.delayedJobs ?? 0) + (row.ol?.overdueJobs ?? 0)),
      row.thermography?.status ?? "No Record",
      roundNumber(row.manpower?.variance ?? 0),
      roundNumber(row.cleaning?.pending ?? 0),
      row.riskStatus,
    ];
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTableMarkup(columns, data) {
  return `
    <table>
      <thead>
        <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${data
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
    </table>
  `;
}

function slugify(value) {
  return String(value || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function downloadExcelFile(table, fileName) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body>${table}</body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function printTableDocument({ title, subtitle, table }) {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");

  if (!printWindow) {
    window.print();
    return;
  }

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { margin: 0 0 20px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #dbe2ea; padding: 8px 10px; text-align: left; }
          th { background: #eef4fb; color: #1e3a5f; }
          tr:nth-child(even) td { background: #f8fbff; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        ${table}
        <script>
          window.onload = function () {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const attendanceSummaryColumns = [
  "State",
  "HK",
  "MEPC",
  "Grand Total",
  "MEPC AOP Count",
  "MEPC AOP Mandays",
  "HK AOP Count",
  "HK AOP Mandays",
  "MEPC %",
  "HK %",
  "Cumulative %",
];

function getAttendanceSummaryRows(rows) {
  return rows.map((row) => [
    row.state,
    roundNumber(row.hkMandays),
    roundNumber(row.mepcMandays),
    roundNumber(row.grandTotal),
    roundNumber(row.mepcAopCount),
    roundNumber(row.mepcAopMandays),
    roundNumber(row.hkAopCount),
    roundNumber(row.hkAopMandays),
    `${roundNumber(row.mepcPct)}%`,
    `${roundNumber(row.hkPct)}%`,
    `${roundNumber(row.cumulativePct)}%`,
  ]);
}

export function exportAttendanceSummaryToExcel(rows, title, month, selectedDate) {
  const table = buildTableMarkup(attendanceSummaryColumns, getAttendanceSummaryRows(rows));
  const fileName = `qpms-${slugify(title)}-${selectedDate || month || formatDate(new Date())}.xls`;
  downloadExcelFile(table, fileName);
}

export function exportAttendanceSummaryToPdf(rows, title, month, selectedDate) {
  const table = buildTableMarkup(attendanceSummaryColumns, getAttendanceSummaryRows(rows));
  const subtitle = `Month: ${formatMonthLabel(month)} | Selected Attendance Date: ${selectedDate || "--"}`;
  printTableDocument({ title, subtitle, table });
}

export function exportRowsToExcel(rows, reportType, month) {
  const columns = getReportColumns(reportType, rows);
  const data = getReportRows(rows, reportType);
  const table = buildTableMarkup(columns, data);
  const fileReport = reportType === "All Reports" ? "unified-dashboard" : reportType.toLowerCase().replace(/\s+/g, "-");
  downloadExcelFile(table, `qpms-${fileReport}-${month}.xls`);
}

export function exportRowsToPdf() {
  window.print();
}

export function getDataSourceSummary(dataSource) {
  return {
    stores: getArray(dataSource, "stores").length,
    attendance: getArray(dataSource, "attendance").length,
    attendanceDaily: getArray(dataSource, "attendanceDaily").length,
    faults: getArray(dataSource, "faults").length,
    ol: getArray(dataSource, "ol").length,
    pendingTickets: getArray(dataSource, "pendingTickets").length,
    faultTickets: getArray(dataSource, "faultTickets").length,
    olTickets: getArray(dataSource, "olTickets").length,
    thermography: getArray(dataSource, "thermography").length,
    manpower: getArray(dataSource, "manpower").length,
    cleaning: getArray(dataSource, "cleaning").length,
    cmpm: getArray(dataSource, "cmpm").length,
    months: getAvailableMonths(dataSource).map((month) => formatMonthLabel(month)),
    generatedOn: formatDate(new Date()),
  };
}

function getAttendanceStateAopMap(monthRows, stores, month, manualAopOverrides = {}) {
  const stateMap = buildStateAopMap(stores, month, manualAopOverrides);
  const adjustedStoreAopMap = buildAdjustedStoreAopMap(stores, month, manualAopOverrides);
  const storesById = new Map(stores.map((store) => [store.storeId, store]));

  monthRows.forEach((row) => {
    const store = storesById.get(row.storeId);
    if (!store) {
      return;
    }

    const state = normalizeOperationalState(row.state || row.region || store.state || store.region || "Unknown");
    if (!stateMap.has(state)) {
      const adjustedCounts = adjustedStoreAopMap.get(row.storeId) || {
        hkAopCount: safeNumber(store.hkAopCount),
        mepcAopCount: safeNumber(store.mepcAopCount),
      };

      stateMap.set(state, {
        hkAopCount: safeNumber(adjustedCounts.hkAopCount),
        mepcAopCount: safeNumber(adjustedCounts.mepcAopCount),
      });
    }
  });

  return stateMap;
}

function buildAopRows(stateAopMap) {
  return sortOperationalStates([...stateAopMap.keys()])
    .filter((state) => OPERATIONAL_STATE_ORDER.includes(state))
    .map((state) => {
      const counts = stateAopMap.get(state) || {};

      return {
        state,
        hkAopCount: Number(safeNumber(counts.hkAopCount).toFixed(2)),
        mepcAopCount: Number(safeNumber(counts.mepcAopCount).toFixed(2)),
      };
    });
}

function buildAttendanceStateRows(rows, stateAopMap, dayCount, mepcDayCount = dayCount) {
  const grouped = new Map();

  rows.forEach((row) => {
    const state = normalizeOperationalState(row.state || row.region || "Unknown");
    if (!OPERATIONAL_STATE_ORDER.includes(state)) {
      return;
    }

    if (!grouped.has(state)) {
      grouped.set(state, {
        state,
        hkMandays: 0,
        mepcMandays: 0,
      });
    }

    const current = grouped.get(state);
    if (row.class === "HK") {
      current.hkMandays += safeNumber(row.attValue);
    } else if (row.class === "MEPC") {
      current.mepcMandays += safeNumber(row.attValue);
    }
  });

  const states = sortOperationalStates([...new Set([...stateAopMap.keys(), ...grouped.keys()])]).filter((state) =>
    OPERATIONAL_STATE_ORDER.includes(state),
  );
  const formattedRows = states
    .map((state) => {
      const values = grouped.get(state) || { hkMandays: 0, mepcMandays: 0 };
      const aop = stateAopMap.get(state) || { hkAopCount: 0, mepcAopCount: 0 };
      const hkAopMandays = aop.hkAopCount * dayCount;
      const mepcAopMandays = aop.mepcAopCount * mepcDayCount;
      const hkPct = hkAopMandays ? (values.hkMandays / hkAopMandays) * 100 : null;
      const mepcPct = mepcAopMandays ? (values.mepcMandays / mepcAopMandays) * 100 : null;
      const cumulativePct = average([hkPct, mepcPct]);

      return {
        state,
        hkMandays: Number(values.hkMandays.toFixed(1)),
        mepcMandays: Number(values.mepcMandays.toFixed(1)),
        grandTotal: Number((values.hkMandays + values.mepcMandays).toFixed(1)),
        mepcAopCount: Number(aop.mepcAopCount.toFixed(2)),
        mepcAopMandays: Number(mepcAopMandays.toFixed(1)),
        hkAopCount: Number(aop.hkAopCount.toFixed(2)),
        hkAopMandays: Number(hkAopMandays.toFixed(1)),
        mepcPct: Number((mepcPct || 0).toFixed(0)),
        hkPct: Number((hkPct || 0).toFixed(0)),
        cumulativePct: Number((cumulativePct || 0).toFixed(0)),
      };
    });

  const total = formattedRows.reduce(
    (acc, row) => {
      acc.hkMandays += row.hkMandays;
      acc.mepcMandays += row.mepcMandays;
      acc.grandTotal += row.grandTotal;
      acc.mepcAopCount += row.mepcAopCount;
      acc.mepcAopMandays += row.mepcAopMandays;
      acc.hkAopCount += row.hkAopCount;
      acc.hkAopMandays += row.hkAopMandays;
      return acc;
    },
    {
      state: "Grand Total",
      hkMandays: 0,
      mepcMandays: 0,
      grandTotal: 0,
      mepcAopCount: 0,
      mepcAopMandays: 0,
      hkAopCount: 0,
      hkAopMandays: 0,
    },
  );

  total.mepcPct = total.mepcAopMandays ? Number(((total.mepcMandays / total.mepcAopMandays) * 100).toFixed(0)) : 0;
  total.hkPct = total.hkAopMandays ? Number(((total.hkMandays / total.hkAopMandays) * 100).toFixed(0)) : 0;
  total.cumulativePct = Number((average([total.mepcPct, total.hkPct]) || 0).toFixed(0));

  return [...formattedRows, total];
}

export function getAttendanceAvailableDates(dataSource, month) {
  return [...new Set(getArray(dataSource, "attendanceDaily").filter((row) => row.month === month).map((row) => row.attDate))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export function buildAttendanceSummary(dataSource, month, selectedDate, manualAopOverrides = {}) {
  const attendanceDaily = getArray(dataSource, "attendanceDaily").filter((row) => row.month === month);
  const stores = getArray(dataSource, "stores");
  const availableDates = getAttendanceAvailableDates(dataSource, month);
  const effectiveDate = availableDates.includes(selectedDate) ? selectedDate : availableDates[availableDates.length - 1] || null;
  const stateAopMap = getAttendanceStateAopMap(attendanceDaily, stores, month, manualAopOverrides);
  const aopRows = buildAopRows(stateAopMap);

  if (!effectiveDate || attendanceDaily.length === 0) {
    return {
      availableDates,
      selectedDate: null,
      dayRows: [],
      monthToDateRows: [],
      aopRows,
    };
  }

  const dayRows = buildAttendanceStateRows(
    attendanceDaily.filter((row) => row.attDate === effectiveDate),
    stateAopMap,
    1,
    1,
  );
  const selectedDayOfMonth = Number(effectiveDate.split("-")[2]) || 1;
  const monthToDateRows = buildAttendanceStateRows(
    attendanceDaily.filter((row) => row.attDate <= effectiveDate),
    stateAopMap,
    selectedDayOfMonth,
    getMepcWorkingDays(selectedDayOfMonth),
  );

  return {
    availableDates,
    selectedDate: effectiveDate,
    dayRows,
    monthToDateRows,
    aopRows,
  };
}
