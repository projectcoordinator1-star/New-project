import { stores } from "./masterData";
import {
  attendanceReports,
  deepCleaningReports,
  faultReports,
  manpowerReports,
  olReports,
  thermographyReports,
} from "./transactionData";

export const defaultDataSource = {
  stores,
  attendance: attendanceReports,
  faults: faultReports,
  ol: olReports,
  thermography: thermographyReports,
  manpower: manpowerReports,
  cleaning: deepCleaningReports,
  attendanceDaily: [],
  pendingTickets: [],
  overallPendingTickets: [],
  faultTickets: [],
  olTickets: [],
  cmpm: [],
};

// Keep this for fallback/demo mode only
export const MOCK_MODE = false;