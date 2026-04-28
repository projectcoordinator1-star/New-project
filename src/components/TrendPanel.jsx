import { formatNumber, formatPercent } from "../utils/formatters";

export function TrendPanel({ items }) {
  const maxValue = Math.max(...items.flatMap((item) => [item.attendance, item.pendingFaults, item.notInspected]), 100);
  const bestAttendance = [...items].sort((left, right) => right.attendance - left.attendance)[0];
  const peakPending = [...items].sort((left, right) => right.pendingFaults - left.pendingFaults)[0];

  const points = (key) =>
    items
      .map((item, index) => {
        const x = 30 + index * 90;
        const y = 160 - (item[key] / maxValue) * 120;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h3>Trend Analysis</h3>
          <p>Monthly movement across operational signals</p>
        </div>
      </div>

      <svg viewBox="0 0 240 180" className="trend-chart" aria-label="Trend analysis chart">
        <polyline fill="none" stroke="#1f78ff" strokeWidth="3" points={points("attendance")} />
        <polyline fill="none" stroke="#f59e0b" strokeWidth="3" points={points("pendingFaults")} />
        <polyline fill="none" stroke="#22c55e" strokeWidth="3" points={points("notInspected")} />
      </svg>

      <div className="trend-chart__months">
        {items.map((item) => (
          <span key={item.month}>{item.month}</span>
        ))}
      </div>

      <div className="trend-chart__legend">
        <span><i className="dot dot--blue" /> Attendance %</span>
        <span><i className="dot dot--amber" /> Pending Faults</span>
        <span><i className="dot dot--green" /> Not Inspected</span>
      </div>

      <div className="trend-summary">
        <div className="trend-summary__item">
          <span>Best Attendance</span>
          <strong>
            {bestAttendance?.month || "--"} | {formatPercent(bestAttendance?.attendance)}
          </strong>
        </div>
        <div className="trend-summary__item">
          <span>Peak Pending Faults</span>
          <strong>
            {peakPending?.month || "--"} | {formatNumber(peakPending?.pendingFaults)}
          </strong>
        </div>
      </div>
    </section>
  );
}
