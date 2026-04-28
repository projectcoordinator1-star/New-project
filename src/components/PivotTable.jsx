import { formatNumber, formatPercent } from "../utils/formatters";

export function PivotTable({ rows, groupBy, onGroupChange }) {
  const rankedRows = [...rows]
    .map((row) => ({
      ...row,
      opsLoad: row.pendingFaults + row.delayedJobs + row.notInspected + row.manpowerGap,
    }))
    .sort((left, right) => right.opsLoad - left.opsLoad || right.totalStores - left.totalStores);
  const topGroup = rankedRows[0];

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h3>Pivot Summary</h3>
          <p>
            Roll up operations by location or region. Top stress area: <strong>{topGroup?.group || "No data"}</strong>
          </p>
        </div>

        <label className="inline-select">
          <span>Group by</span>
          <select value={groupBy} onChange={(event) => onGroupChange(event.target.value)}>
            <option value="location">Location</option>
            <option value="region">Region</option>
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>{groupBy === "location" ? "Location" : "Region"}</th>
              <th>Total Stores</th>
              <th>Attendance %</th>
              <th>Pending Faults</th>
              <th>Delayed Jobs</th>
              <th>Ops Load</th>
            </tr>
          </thead>
          <tbody>
            {rankedRows.map((row, index) => (
              <tr key={row.group}>
                <td>
                  <span className={`table-rank ${index === 0 ? "is-top" : ""}`}>{index + 1}</span>
                </td>
                <td>{row.group}</td>
                <td>{formatNumber(row.totalStores)}</td>
                <td>
                  <div className="table-progress">
                    <strong>{formatPercent(row.attendancePct)}</strong>
                    <div className="table-progress__track">
                      <div className="table-progress__fill table-progress__fill--green" style={{ width: `${row.attendancePct}%` }} />
                    </div>
                  </div>
                </td>
                <td>{formatNumber(row.pendingFaults)}</td>
                <td>{formatNumber(row.delayedJobs)}</td>
                <td>
                  <div className="table-progress">
                    <strong>{formatNumber(row.opsLoad)}</strong>
                    <div className="table-progress__track">
                      <div
                        className="table-progress__fill table-progress__fill--blue"
                        style={{ width: `${Math.min(row.opsLoad * 4, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
