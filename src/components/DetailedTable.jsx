import { useEffect, useMemo, useState } from "react";
import { formatNumber, formatPercent } from "../utils/formatters";

function Badge({ tone, children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

function renderStatusBadge(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("critical") || normalized.includes("not inspected") || normalized.includes("delayed")) {
    return <Badge tone="red">{value}</Badge>;
  }

  if (normalized.includes("attention") || normalized.includes("pending") || normalized.includes("overdue")) {
    return <Badge tone="amber">{value}</Badge>;
  }

  return <Badge tone="green">{value}</Badge>;
}

function getColumns(reportType) {
  if (reportType === "Attendance") {
    return [
      { key: "storeId", label: "Store ID", render: (row) => row.storeId },
      {
        key: "storeName",
        label: "Store Name",
        render: (row) => (
          <div className="store-cell">
            <strong>{row.storeName}</strong>
            <span>{row.location}</span>
          </div>
        ),
      },
      { key: "region", label: "Region", render: (row) => row.region },
      { key: "presentPct", label: "Present %", render: (row) => formatPercent(row.attendance?.presentPct ?? 0) },
      { key: "absentPct", label: "Absent %", render: (row) => formatPercent(row.attendance?.absentPct ?? 0) },
      { key: "headcount", label: "Headcount", render: (row) => formatNumber(row.attendance?.manpowerOnRoll ?? 0) },
      { key: "status", label: "Status", render: (row) => renderStatusBadge(row.riskStatus) },
    ];
  }

  if (reportType === "Fault Report") {
    return [
      { key: "storeId", label: "Store ID", render: (row) => row.storeId },
      { key: "storeName", label: "Store Name", render: (row) => row.storeName },
      { key: "location", label: "Location", render: (row) => row.location },
      { key: "totalFaults", label: "Total Faults", render: (row) => formatNumber(row.faults?.totalFaults ?? 0) },
      { key: "pendingFaults", label: "Pending Faults", render: (row) => formatNumber(row.faults?.pendingFaults ?? 0) },
      { key: "delayedJobs", label: "Delayed Jobs", render: (row) => formatNumber(row.faults?.delayedJobs ?? 0) },
      { key: "faultStatus", label: "Fault Status", render: (row) => renderStatusBadge(row.faults?.status ?? row.riskStatus) },
    ];
  }

  if (reportType === "OL Report") {
    return [
      { key: "storeId", label: "Store ID", render: (row) => row.storeId },
      { key: "storeName", label: "Store Name", render: (row) => row.storeName },
      { key: "location", label: "Location", render: (row) => row.location },
      { key: "openJobs", label: "Open Jobs", render: (row) => formatNumber(row.ol?.openJobs ?? 0) },
      { key: "overdueJobs", label: "Overdue Jobs", render: (row) => formatNumber(row.ol?.overdueJobs ?? 0) },
      { key: "lastRaisedDate", label: "Last Raised", render: (row) => row.ol?.lastRaisedDate ?? "--" },
      { key: "status", label: "Status", render: (row) => renderStatusBadge(row.riskStatus) },
    ];
  }

  if (reportType === "Thermography") {
    return [
      { key: "storeId", label: "Store ID", render: (row) => row.storeId },
      { key: "storeName", label: "Store Name", render: (row) => row.storeName },
      { key: "location", label: "Location", render: (row) => row.location },
      { key: "region", label: "Region", render: (row) => row.region },
      { key: "lastInspectionDate", label: "Last Inspection", render: (row) => row.thermography?.lastInspectionDate ?? "--" },
      { key: "thermoStatus", label: "Status", render: (row) => renderStatusBadge(row.thermography?.status ?? "No Record") },
      { key: "daysPending", label: "Days Pending", render: (row) => formatNumber(row.thermography?.daysPending ?? 0) },
    ];
  }

  if (reportType === "Manpower") {
    return [
      { key: "storeId", label: "Store ID", render: (row) => row.storeId },
      { key: "storeName", label: "Store Name", render: (row) => row.storeName },
      { key: "location", label: "Location", render: (row) => row.location },
      { key: "required", label: "Required", render: (row) => formatNumber(row.manpower?.required ?? 0) },
      { key: "deployed", label: "Deployed", render: (row) => formatNumber(row.manpower?.deployed ?? 0) },
      { key: "variance", label: "Variance", render: (row) => formatNumber(row.manpower?.variance ?? 0) },
      { key: "status", label: "Status", render: (row) => renderStatusBadge(row.riskStatus) },
    ];
  }

  if (reportType === "Deep Cleaning") {
    return [
      { key: "storeId", label: "Store ID", render: (row) => row.storeId },
      { key: "storeName", label: "Store Name", render: (row) => row.storeName },
      { key: "location", label: "Location", render: (row) => row.location },
      { key: "completed", label: "Completed", render: (row) => formatNumber(row.cleaning?.completed ?? 0) },
      { key: "pending", label: "Pending", render: (row) => formatNumber(row.cleaning?.pending ?? 0) },
      { key: "lastCompletedDate", label: "Last Completed", render: (row) => row.cleaning?.lastCompletedDate ?? "--" },
      { key: "status", label: "Status", render: (row) => renderStatusBadge(row.riskStatus) },
    ];
  }

  if (reportType === "Stores") {
    return [
      { key: "storeId", label: "Store Code", render: (row) => row.storeId },
      { key: "region", label: "State", render: (row) => row.region },
      { key: "server", label: "Server", render: (row) => row.server || "--" },
      { key: "business", label: "Business", render: (row) => row.business || "--" },
      { key: "status", label: "Status", render: (row) => renderStatusBadge(row.status || row.lifecycleStatus) },
    ];
  }

  return [
    { key: "storeId", label: "Store ID", render: (row) => row.storeId },
    {
      key: "storeName",
      label: "Store Name",
      render: (row) => (
        <div className="store-cell">
          <strong>{row.storeName}</strong>
          <span>{row.issueCount} open issues</span>
        </div>
      ),
    },
    { key: "location", label: "Location", render: (row) => row.location },
    { key: "region", label: "Region", render: (row) => row.region },
    { key: "attendance", label: "Attendance", render: (row) => formatPercent(row.attendance?.presentPct ?? 0) },
    { key: "pendingFaults", label: "Pending Faults", render: (row) => formatNumber(row.faults?.pendingFaults ?? 0) },
    {
      key: "delayedJobs",
      label: "Delayed Jobs",
      render: (row) => formatNumber((row.faults?.delayedJobs ?? 0) + (row.ol?.overdueJobs ?? 0)),
    },
    { key: "thermography", label: "Thermography", render: (row) => renderStatusBadge(row.thermography?.status ?? "No Record") },
    { key: "manpowerGap", label: "Manpower Gap", render: (row) => formatNumber(row.manpower?.variance ?? 0) },
    { key: "cleaningPending", label: "Cleaning Pending", render: (row) => formatNumber(row.cleaning?.pending ?? 0) },
    { key: "status", label: "Status", render: (row) => renderStatusBadge(row.riskStatus) },
  ];
}

function getRowAlert(reportType, row) {
  if (reportType === "Attendance") {
    return (row.attendance?.presentPct ?? 0) < 90;
  }

  if (reportType === "Fault Report") {
    return (row.faults?.delayedJobs ?? 0) > 0 || (row.faults?.pendingFaults ?? 0) >= 5;
  }

  if (reportType === "OL Report") {
    return (row.ol?.overdueJobs ?? 0) > 1;
  }

  if (reportType === "Thermography") {
    return row.thermography?.status === "Not Inspected";
  }

  if (reportType === "Manpower") {
    return (row.manpower?.variance ?? 0) < 0;
  }

  if (reportType === "Deep Cleaning") {
    return (row.cleaning?.pending ?? 0) > 0;
  }

  return ((row.faults?.delayedJobs ?? 0) + (row.ol?.overdueJobs ?? 0)) > 2;
}

export function DetailedTable({ rows, reportType, onExportExcel, onExportPdf }) {
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [attendancePage, setAttendancePage] = useState(1);
  const columns = getColumns(reportType);
  const isAttendanceView = reportType === "Attendance";
  const pageSize = 20;

  const filteredRows = useMemo(() => {
    if (!isAttendanceView) return rows;
    const query = attendanceSearch.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      `${row.storeId} ${row.storeName} ${row.region} ${row.location}`.toLowerCase().includes(query),
    );
  }, [rows, isAttendanceView, attendanceSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    if (!isAttendanceView) return filteredRows;
    const startIndex = (attendancePage - 1) * pageSize;
    return filteredRows.slice(startIndex, startIndex + pageSize);
  }, [filteredRows, isAttendanceView, attendancePage]);

  useEffect(() => {
    setAttendancePage(1);
  }, [attendanceSearch, reportType, rows]);

  useEffect(() => {
    if (attendancePage > totalPages) {
      setAttendancePage(totalPages);
    }
  }, [attendancePage, totalPages]);

  return (
    <section className="panel panel--wide">
      <div className="panel__header">
        <div>
          <h3>{reportType === "All Reports" ? "Unified Store View" : reportType}</h3>
          <p>
            {reportType === "All Reports"
              ? "Merged operational data linked by storeId"
              : `Focused view for ${reportType.toLowerCase()} using the current filters`}
          </p>
        </div>

        <div className="panel__actions">
          <button type="button" className="excel-button" onClick={onExportExcel}>
            Export Excel
          </button>
          <button type="button" className="ghost-button" onClick={onExportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      {isAttendanceView ? (
        <div className="attendance-table-controls">
          <label className="attendance-table-search">
            <span>Search Attendance</span>
            <input
              type="search"
              value={attendanceSearch}
              placeholder="Search by store id, store name, or region"
              onChange={(event) => setAttendanceSearch(event.target.value)}
            />
          </label>

          <div className="attendance-pagination">
            <span>
              Showing {paginatedRows.length ? (attendancePage - 1) * pageSize + 1 : 0}-{(attendancePage - 1) * pageSize + paginatedRows.length} of{" "}
              {filteredRows.length}
            </span>
            <div className="attendance-pagination__actions">
              <button type="button" className="ghost-button" onClick={() => setAttendancePage((page) => Math.max(1, page - 1))} disabled={attendancePage === 1}>
                Previous
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setAttendancePage((page) => Math.min(totalPages, page + 1))}
                disabled={attendancePage >= totalPages}
              >
                Next Page
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="empty-state">
          <strong>No rows match the current filters.</strong>
          <p>Try changing the month, report tab, or location filters after you load your Excel workbook.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--detail">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={`${row.storeId}-${index}`} className={getRowAlert(reportType, row) ? "row-alert" : ""}>
                  {columns.map((column) => (
                    <td key={`${row.storeId}-${column.key}`}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
