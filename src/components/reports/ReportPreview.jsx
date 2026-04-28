import { formatDisplayValue } from "../../utils/formatters";

function SummaryCards({ items }) {
  return (
    <div className="report-summary-grid">
      {items.map((item) => (
        <article key={item.label} className={`report-summary-card report-summary-card--${item.tone || "blue"}`}>
          <span>{item.label}</span>
          <strong>{formatDisplayValue(item.value)}</strong>
          <p>{item.note}</p>
        </article>
      ))}
    </div>
  );
}

function BarChart({ chart }) {
  const maxValue = Math.max(...chart.items.map((item) => item.value || 0), 1);

  return (
    <div className="report-chart-list">
      {chart.items.map((item) => (
        <div key={item.label} className="report-chart-row">
          <div className="report-chart-row__label">
            <strong>{item.label}</strong>
            <span>{formatDisplayValue(item.value)}</span>
          </div>
          <div className="report-chart-row__track">
            <div
              className={`report-chart-row__fill report-chart-row__fill--${item.tone || "blue"}`}
              style={{ width: `${((item.value || 0) / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CompareChart({ chart }) {
  const maxValue = Math.max(
    ...chart.items.flatMap((item) => [item.primary || 0, item.secondary || 0]),
    1,
  );

  return (
    <div className="report-compare-list">
      {chart.items.map((item) => (
        <div key={item.label} className="report-compare-row">
          <div className="report-compare-row__header">
            <strong>{item.label}</strong>
            <span>
              {formatDisplayValue(item.primary)} / {formatDisplayValue(item.secondary)}
            </span>
          </div>

          <div className="report-compare-row__metric">
            <small>{item.primaryLabel || "Primary"}</small>
            <div className="report-chart-row__track">
              <div className="report-chart-row__fill report-chart-row__fill--blue" style={{ width: `${((item.primary || 0) / maxValue) * 100}%` }} />
            </div>
          </div>

          <div className="report-compare-row__metric">
            <small>{item.secondaryLabel || "Secondary"}</small>
            <div className="report-chart-row__track">
              <div className="report-chart-row__fill report-chart-row__fill--amber" style={{ width: `${((item.secondary || 0) / maxValue) * 100}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ChartCard({ chart }) {
  return (
    <section className="panel report-preview__panel">
      <div className="panel__header">
        <div>
          <h3>{chart.title}</h3>
          <p>{chart.subtitle}</p>
        </div>
      </div>

      {chart.type === "compare" ? <CompareChart chart={chart} /> : <BarChart chart={chart} />}
    </section>
  );
}

function FilterSummary({ items }) {
  return (
    <section className="panel report-preview__panel report-preview__panel--summary">
      <div className="panel__header">
        <div>
          <h3>Selected Filters</h3>
          <p>These chips reflect the filters that were applied when the report was last run.</p>
        </div>
      </div>

      {items.length ? (
        <div className="filter-summary">
          {items.map((item) => (
            <span key={`${item.label}-${item.value}`} className="filter-chip">
              <b>{item.label}</b>
              {item.value}
            </span>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <strong>No additional filters are applied.</strong>
          <p>The report is currently showing its default preview scope.</p>
        </div>
      )}
    </section>
  );
}

function ReportTable({ table }) {
  return (
    <section className="panel report-preview__panel">
      <div className="panel__header">
        <div>
          <h3>Report Output</h3>
          <p>Config-driven table layout ready for API data later.</p>
        </div>
      </div>

      {table.rows.length ? (
        <div className="table-scroll">
          <table className="data-table data-table--detail report-output-table">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={`${index}-${row[table.columns[0].key]}`}>
                  {table.columns.map((column) => (
                    <td key={column.key}>{formatDisplayValue(row[column.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No records matched the selected filters.</strong>
          <p>Adjust the filter panel and run the report again to preview a different slice.</p>
        </div>
      )}
    </section>
  );
}

function BeforeAfterGallery({ gallery }) {
  if (!gallery?.items?.length) {
    return null;
  }

  return (
    <section className="panel report-preview__panel">
      <div className="panel__header">
        <div>
          <h3>{gallery.title}</h3>
          <p>{gallery.subtitle}</p>
        </div>
      </div>

      <div className="before-after-grid">
        {gallery.items.map((item, index) => (
          <article key={`${item.site}-${item.area}-${index}`} className="before-after-card">
            <div className="before-after-card__media">
              <div className={`before-after-card__shot before-after-card__shot--${item.beforeTone || "warm"}`}>
                <span>Before</span>
                <strong>{item.beforeLabel}</strong>
              </div>
              <div className={`before-after-card__shot before-after-card__shot--${item.afterTone || "fresh"}`}>
                <span>After</span>
                <strong>{item.afterLabel}</strong>
              </div>
            </div>

            <div className="before-after-card__body">
              <strong>{item.site}</strong>
              <span>{item.area}</span>
              <p>{item.note}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReportPreview({ result }) {
  if (!result) {
    return (
      <section className="panel report-preview__placeholder">
        <div className="empty-state">
          <strong>Select a report and run it to preview the output.</strong>
          <p>This area will show the title, applied filters, KPI cards, chart, grid, and optional before/after gallery.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="report-preview">
      <section className="panel report-preview__hero">
        <div>
          <p className="eyebrow">Report Preview</p>
          <h3>{result.title}</h3>
          <p>{result.subtitle}</p>
        </div>
      </section>

      <SummaryCards items={result.summaryCards} />

      <section className="report-preview__top-grid">
        <ChartCard chart={result.chart} />
        <FilterSummary items={result.filterSummary} />
      </section>

      <ReportTable table={result.table} />
      <BeforeAfterGallery gallery={result.beforeAfter} />
    </div>
  );
}
