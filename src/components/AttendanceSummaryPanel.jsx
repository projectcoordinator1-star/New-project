import { exportAttendanceSummaryToExcel, exportAttendanceSummaryToPdf } from "../utils/dashboard";
import { formatNumber, formatPercent } from "../utils/formatters";

function AttendanceMatrix({ title, rows, month, selectedDate, availableDates = [], onDateChange = null, showExportActions = true }) {
  const totalRow = rows.find((row) => row.state === "Grand Total");
  const showDateControl = typeof onDateChange === "function";
  const hasDates = availableDates.length > 0;

  return (
    <section className="panel attendance-panel">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p>State-wise attendance summary with AOP comparison</p>
        </div>
        <div className="panel__actions attendance-panel__actions">
          {showDateControl ? (
            <label className="inline-select attendance-inline-select">
              <span>Attendance Date</span>
              <select value={selectedDate || ""} onChange={(event) => onDateChange(event.target.value)} disabled={!hasDates}>
                {!hasDates ? <option value="">No dates available</option> : null}
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showExportActions ? (
            <>
              <button
                type="button"
                className="excel-button"
                onClick={() => exportAttendanceSummaryToExcel(rows, title, month, selectedDate)}
                disabled={!rows.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => exportAttendanceSummaryToPdf(rows, title, month, selectedDate)}
                disabled={!rows.length}
              >
                Export PDF
              </button>
            </>
          ) : null}
        </div>
      </div>

      {totalRow ? (
        <div className="attendance-snapshot">
          <div className="attendance-snapshot__item">
            <span>Cumulative Attendance</span>
            <strong>{formatPercent(totalRow.cumulativePct)}</strong>
          </div>
          <div className="attendance-snapshot__item">
            <span>HK Attendance</span>
            <strong>{formatPercent(totalRow.hkPct)}</strong>
          </div>
          <div className="attendance-snapshot__item">
            <span>MEPC Attendance</span>
            <strong>{formatPercent(totalRow.mepcPct)}</strong>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No attendance rows are available for this range.</strong>
          <p>Upload the raw attendance workbook together with the store allocation file to generate this summary.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table attendance-table">
            <thead>
              <tr>
                <th>State</th>
                <th>HK</th>
                <th>MEPC</th>
                <th>Grand Total</th>
                <th>MEPC AOP Count</th>
                <th>MEPC AOP Mandays</th>
                <th>HK AOP Count</th>
                <th>HK AOP Mandays</th>
                <th>MEPC %</th>
                <th>HK %</th>
                <th>Cumulative %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.state} className={row.state === "Grand Total" ? "attendance-table__total" : ""}>
                  <td>{row.state}</td>
                  <td>{formatNumber(row.hkMandays)}</td>
                  <td>{formatNumber(row.mepcMandays)}</td>
                  <td>{formatNumber(row.grandTotal)}</td>
                  <td>{formatNumber(row.mepcAopCount)}</td>
                  <td>{formatNumber(row.mepcAopMandays)}</td>
                  <td>{formatNumber(row.hkAopCount)}</td>
                  <td>{formatNumber(row.hkAopMandays)}</td>
                  <td className="attendance-table__pct attendance-table__pct--amber">{formatPercent(row.mepcPct)}</td>
                  <td className="attendance-table__pct attendance-table__pct--green">{formatPercent(row.hkPct)}</td>
                  <td className="attendance-table__pct attendance-table__pct--olive">{formatPercent(row.cumulativePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AttendanceSummaryPanel({ availableDates, selectedDate, onDateChange, dayRows, monthToDateRows, month }) {
  return (
    <>
      <AttendanceMatrix
        title="Selected Day Attendance Summary"
        rows={dayRows}
        month={month}
        selectedDate={selectedDate}
        availableDates={availableDates}
        onDateChange={onDateChange}
        showExportActions
      />
      <AttendanceMatrix
        title="Month-to-Date Attendance Summary"
        rows={monthToDateRows}
        month={month}
        selectedDate={selectedDate}
        showExportActions={false}
      />
    </>
  );
}
