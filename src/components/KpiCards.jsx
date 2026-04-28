import { formatDisplayValue } from "../utils/formatters";

export function KpiCards({ items }) {
  const getAccentWidth = (value, index) => {
    const numeric = Number.parseFloat(String(value).replace(/[^\d.]/g, ""));

    if (!Number.isFinite(numeric)) {
      return 48 + index * 8;
    }

    return Math.max(24, Math.min(index === 0 ? numeric : numeric % 100 || numeric, 100));
  };

  return (
    <section className="kpi-grid">
      {items.map((item, index) => (
        <article key={item.title} className={`kpi-card kpi-card--${item.tone}`}>
          <div className="kpi-card__icon">{item.title.charAt(0)}</div>
          <div className="kpi-card__body">
            <p>{item.title}</p>
            <h3>{formatDisplayValue(item.value)}</h3>
            <span>{item.note}</span>
            <div className="kpi-card__meter">
              <div className="kpi-card__meter-fill" style={{ width: `${getAccentWidth(item.value, index)}%` }} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
