export const attendanceReports = [
  { storeId: "S10023", month: "2025-01", presentPct: 92, absentPct: 8, manpowerOnRoll: 52 },
  { storeId: "S10045", month: "2025-01", presentPct: 88, absentPct: 12, manpowerOnRoll: 47 },
  { storeId: "S10067", month: "2025-01", presentPct: 85, absentPct: 15, manpowerOnRoll: 39 },
  { storeId: "S10089", month: "2025-01", presentPct: 81, absentPct: 19, manpowerOnRoll: 31 },
  { storeId: "S10112", month: "2025-01", presentPct: 90, absentPct: 10, manpowerOnRoll: 41 },
  { storeId: "S10134", month: "2025-01", presentPct: 83, absentPct: 17, manpowerOnRoll: 44 },
  { storeId: "S10156", month: "2025-01", presentPct: 87, absentPct: 13, manpowerOnRoll: 29 },
  { storeId: "S10178", month: "2025-01", presentPct: 79, absentPct: 21, manpowerOnRoll: 37 },
  { storeId: "S10201", month: "2025-01", presentPct: 91, absentPct: 9, manpowerOnRoll: 49 },
  { storeId: "S10224", month: "2025-01", presentPct: 94, absentPct: 6, manpowerOnRoll: 26 },
  { storeId: "S10246", month: "2025-01", presentPct: 84, absentPct: 16, manpowerOnRoll: 33 },
  { storeId: "S10275", month: "2025-01", presentPct: 76, absentPct: 24, manpowerOnRoll: 20 },
];

export const faultReports = [
  { storeId: "S10023", month: "2025-01", totalFaults: 8, pendingFaults: 2, delayedJobs: 1, status: "Controlled" },
  { storeId: "S10045", month: "2025-01", totalFaults: 12, pendingFaults: 5, delayedJobs: 3, status: "Attention" },
  { storeId: "S10067", month: "2025-01", totalFaults: 9, pendingFaults: 4, delayedJobs: 2, status: "Attention" },
  { storeId: "S10089", month: "2025-01", totalFaults: 5, pendingFaults: 1, delayedJobs: 0, status: "Controlled" },
  { storeId: "S10112", month: "2025-01", totalFaults: 7, pendingFaults: 2, delayedJobs: 1, status: "Controlled" },
  { storeId: "S10134", month: "2025-01", totalFaults: 13, pendingFaults: 6, delayedJobs: 4, status: "Critical" },
  { storeId: "S10156", month: "2025-01", totalFaults: 6, pendingFaults: 2, delayedJobs: 1, status: "Controlled" },
  { storeId: "S10178", month: "2025-01", totalFaults: 11, pendingFaults: 5, delayedJobs: 3, status: "Critical" },
  { storeId: "S10201", month: "2025-01", totalFaults: 4, pendingFaults: 1, delayedJobs: 0, status: "Controlled" },
  { storeId: "S10224", month: "2025-01", totalFaults: 3, pendingFaults: 0, delayedJobs: 0, status: "Controlled" },
  { storeId: "S10246", month: "2025-01", totalFaults: 10, pendingFaults: 4, delayedJobs: 2, status: "Attention" },
  { storeId: "S10275", month: "2025-01", totalFaults: 6, pendingFaults: 3, delayedJobs: 2, status: "Attention" },
];

export const olReports = [
  { storeId: "S10023", month: "2025-01", openJobs: 3, overdueJobs: 1, lastRaisedDate: "2025-01-24" },
  { storeId: "S10045", month: "2025-01", openJobs: 5, overdueJobs: 2, lastRaisedDate: "2025-01-27" },
  { storeId: "S10067", month: "2025-01", openJobs: 4, overdueJobs: 2, lastRaisedDate: "2025-01-26" },
  { storeId: "S10089", month: "2025-01", openJobs: 2, overdueJobs: 0, lastRaisedDate: "2025-01-18" },
  { storeId: "S10112", month: "2025-01", openJobs: 2, overdueJobs: 1, lastRaisedDate: "2025-01-19" },
  { storeId: "S10134", month: "2025-01", openJobs: 6, overdueJobs: 3, lastRaisedDate: "2025-01-29" },
  { storeId: "S10156", month: "2025-01", openJobs: 3, overdueJobs: 1, lastRaisedDate: "2025-01-20" },
  { storeId: "S10178", month: "2025-01", openJobs: 5, overdueJobs: 2, lastRaisedDate: "2025-01-28" },
  { storeId: "S10201", month: "2025-01", openJobs: 1, overdueJobs: 0, lastRaisedDate: "2025-01-12" },
  { storeId: "S10224", month: "2025-01", openJobs: 1, overdueJobs: 0, lastRaisedDate: "2025-01-15" },
  { storeId: "S10246", month: "2025-01", openJobs: 4, overdueJobs: 2, lastRaisedDate: "2025-01-23" },
  { storeId: "S10275", month: "2025-01", openJobs: 3, overdueJobs: 1, lastRaisedDate: "2025-01-14" },
];

export const thermographyReports = [
  { storeId: "S10023", month: "2025-01", status: "Inspected", lastInspectionDate: "2025-01-22", daysPending: 0 },
  { storeId: "S10045", month: "2025-01", status: "Not Inspected", lastInspectionDate: null, daysPending: 28 },
  { storeId: "S10067", month: "2025-01", status: "Not Inspected", lastInspectionDate: null, daysPending: 27 },
  { storeId: "S10089", month: "2025-01", status: "Inspected", lastInspectionDate: "2025-01-16", daysPending: 0 },
  { storeId: "S10112", month: "2025-01", status: "Inspected", lastInspectionDate: "2025-01-21", daysPending: 0 },
  { storeId: "S10134", month: "2025-01", status: "Not Inspected", lastInspectionDate: null, daysPending: 19 },
  { storeId: "S10156", month: "2025-01", status: "Not Inspected", lastInspectionDate: null, daysPending: 18 },
  { storeId: "S10178", month: "2025-01", status: "Inspected", lastInspectionDate: "2025-01-17", daysPending: 0 },
  { storeId: "S10201", month: "2025-01", status: "Inspected", lastInspectionDate: "2025-01-20", daysPending: 0 },
  { storeId: "S10224", month: "2025-01", status: "Inspected", lastInspectionDate: "2025-01-24", daysPending: 0 },
  { storeId: "S10246", month: "2025-01", status: "Not Inspected", lastInspectionDate: null, daysPending: 14 },
  { storeId: "S10275", month: "2025-01", status: "Not Inspected", lastInspectionDate: null, daysPending: 12 },
];

export const manpowerReports = [
  { storeId: "S10023", month: "2025-01", deployed: 49, required: 52, variance: -3 },
  { storeId: "S10045", month: "2025-01", deployed: 43, required: 47, variance: -4 },
  { storeId: "S10067", month: "2025-01", deployed: 35, required: 39, variance: -4 },
  { storeId: "S10089", month: "2025-01", deployed: 30, required: 31, variance: -1 },
  { storeId: "S10112", month: "2025-01", deployed: 40, required: 41, variance: -1 },
  { storeId: "S10134", month: "2025-01", deployed: 38, required: 44, variance: -6 },
  { storeId: "S10156", month: "2025-01", deployed: 27, required: 29, variance: -2 },
  { storeId: "S10178", month: "2025-01", deployed: 33, required: 37, variance: -4 },
  { storeId: "S10201", month: "2025-01", deployed: 47, required: 49, variance: -2 },
  { storeId: "S10224", month: "2025-01", deployed: 25, required: 26, variance: -1 },
  { storeId: "S10246", month: "2025-01", deployed: 30, required: 33, variance: -3 },
  { storeId: "S10275", month: "2025-01", deployed: 18, required: 20, variance: -2 },
];

export const deepCleaningReports = [
  { storeId: "S10023", month: "2025-01", completed: 5, pending: 1, lastCompletedDate: "2025-01-23" },
  { storeId: "S10045", month: "2025-01", completed: 4, pending: 2, lastCompletedDate: "2025-01-18" },
  { storeId: "S10067", month: "2025-01", completed: 3, pending: 2, lastCompletedDate: "2025-01-14" },
  { storeId: "S10089", month: "2025-01", completed: 5, pending: 0, lastCompletedDate: "2025-01-21" },
  { storeId: "S10112", month: "2025-01", completed: 4, pending: 1, lastCompletedDate: "2025-01-20" },
  { storeId: "S10134", month: "2025-01", completed: 3, pending: 3, lastCompletedDate: "2025-01-11" },
  { storeId: "S10156", month: "2025-01", completed: 4, pending: 1, lastCompletedDate: "2025-01-16" },
  { storeId: "S10178", month: "2025-01", completed: 3, pending: 2, lastCompletedDate: "2025-01-13" },
  { storeId: "S10201", month: "2025-01", completed: 5, pending: 0, lastCompletedDate: "2025-01-25" },
  { storeId: "S10224", month: "2025-01", completed: 4, pending: 0, lastCompletedDate: "2025-01-24" },
  { storeId: "S10246", month: "2025-01", completed: 4, pending: 1, lastCompletedDate: "2025-01-19" },
  { storeId: "S10275", month: "2025-01", completed: 2, pending: 2, lastCompletedDate: "2025-01-10" },
];
