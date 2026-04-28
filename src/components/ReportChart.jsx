import { formatNumber } from "../utils/formatters";

export function ReportChart({ rows }) {
  const rankedRows = [...rows].sort((left, right) => right.pendingFaults - left.pendingFaults).slice(0, 6);
  const maxPending = Math.max(...rankedRows.map((row) => row.pendingFaults), 1);
  const maxDelayed = Math.max(...rankedRows.map((row) => row.delayedJobs), 1);

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h3>Issue Pressure by Group</h3>
          <p>Compare pending faults and delayed jobs in one quick ranking surface.</p>
        </div>
      </div>

      <div className="rank-chart">
        {rankedRows.map((row) => (
          <div key={row.group} className="rank-chart__row">
            <div className="rank-chart__label">
              <strong>{row.group}</strong>
              <span>{formatNumber(row.totalStores)} stores</span>
            </div>
            <div className="rank-chart__bars">
              <div className="rank-chart__metric">
                <span>Pending</span>
                <div className="rank-chart__track">
                  <div className="rank-chart__fill rank-chart__fill--blue" style={{ width: `${(row.pendingFaults / maxPending) * 100}%` }} />
                </div>
                <strong>{formatNumber(row.pendingFaults)}</strong>
              </div>
              <div className="rank-chart__metric">
                <span>Delayed</span>
                <div className="rank-chart__track">
                  <div className="rank-chart__fill rank-chart__fill--amber" style={{ width: `${(row.delayedJobs / maxDelayed) * 100}%` }} />
                </div>
                <strong>{formatNumber(row.delayedJobs)}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
