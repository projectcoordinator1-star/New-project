import { formatDisplayValue } from "../../utils/formatters";

function renderCellLines(values) {
  return values.map((value) => (
    <div key={value.key} className="pivot-preview__cell-line">
      <span>{value.label}</span>
      <strong>{value.display}</strong>
    </div>
  ));
}

function PivotMatrix({ result }) {
  const pivotTable = result.pivotTable;
  const rowFields = pivotTable.rowFields;
  const columnGroups = pivotTable.columnGroups;

  return (
    <div className="table-scroll">
      <table className="data-table pivot-preview__table">
        <thead>
          <tr>
            {(rowFields.length ? rowFields : [{ id: "__row__", label: "Row Group" }]).map((field) => (
              <th key={field.id}>{field.label}</th>
            ))}
            {columnGroups.length ? (
              columnGroups.map((column) => (
                <th key={column.key}>{column.labels.map((label) => label.label).join(" / ")}</th>
              ))
            ) : (
              <th>Values</th>
            )}
            <th>Grand Total</th>
          </tr>
        </thead>
        <tbody>
          {pivotTable.rows.map((row) => (
            <tr key={row.key}>
              {(row.labels.length ? row.labels : [{ key: "__row__", label: "All Records" }]).map((label) => (
                <td key={`${row.key}-${label.key}`} className="pivot-preview__label-cell">
                  {label.label}
                </td>
              ))}
              {row.cells.length ? (
                row.cells.map((cell) => <td key={cell.key}>{renderCellLines(cell.values)}</td>)
              ) : (
                <td>{renderCellLines(row.totals)}</td>
              )}
              <td className="pivot-preview__total-cell">{renderCellLines(row.totals)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={Math.max(rowFields.length, 1)}>Grand Total</th>
            {columnGroups.length
              ? columnGroups.map((column) => {
                  const totalRow = result.table.rows[result.table.rows.length - 1] || {};
                  return <th key={`total-${column.key}`}>{formatDisplayValue(totalRow[column.key])}</th>;
                })
              : null}
            <th>{result.pivotTable.grandTotals.map((value) => value.display).join(" | ")}</th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function PivotSummary({ result, layout }) {
  const layoutSummary = [
    { label: "Filters", value: layout.filters.length },
    { label: "Rows", value: layout.rows.length },
    { label: "Columns", value: layout.columns.length },
    { label: "Values", value: layout.values.length },
  ];

  return (
    <>
      <div className="report-summary-grid">
        {result.summaryCards.map((item) => (
          <article key={item.label} className={`report-summary-card report-summary-card--${item.tone || "blue"}`}>
            <span>{item.label}</span>
            <strong>{formatDisplayValue(item.value)}</strong>
            <p>{item.note}</p>
          </article>
        ))}
      </div>

      <div className="filter-summary">
        {layoutSummary.map((item) => (
          <span key={item.label} className="filter-chip">
            <b>{item.label}</b>
            {item.value}
          </span>
        ))}
        {result.filterSummary.map((item) => (
          <span key={`${item.label}-${item.value}`} className="filter-chip">
            <b>{item.label}</b>
            {item.value}
          </span>
        ))}
      </div>
    </>
  );
}

function PivotChart({ chart }) {
  if (!chart?.items?.length) {
    return null;
  }

  const maxValue = Math.max(...chart.items.map((item) => item.value), 1);

  return (
    <section className="panel report-preview__panel">
      <div className="panel__header">
        <div>
          <h3>{chart.title}</h3>
          <p>{chart.subtitle}</p>
        </div>
      </div>

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
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
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

export function PivotPreviewPanel({ result, layout }) {
  if (!result) {
    return (
      <section className="panel report-preview__placeholder">
        <div className="empty-state">
          <strong>Assign at least one numeric field to Values to render the pivot preview.</strong>
          <p>Once values are added, the matrix preview and export actions will become useful.</p>
        </div>
      </section>
    );
  }

  return (
    <div className="report-preview">
      <section className="panel report-preview__hero">
        <div>
          <p className="eyebrow">Pivot Preview</p>
          <h3>{result.title}</h3>
          <p>{result.subtitle}</p>
        </div>
      </section>

      <PivotSummary result={result} layout={layout} />

      <section className="report-preview__top-grid">
        <section className="panel report-preview__panel">
          <div className="panel__header">
            <div>
              <h3>Live Pivot Matrix</h3>
              <p>The center preview updates from the current field shelves just like a pivot workspace.</p>
            </div>
          </div>
          <PivotMatrix result={result} />
        </section>

        <PivotChart chart={result.chart} />
      </section>

      <BeforeAfterGallery gallery={result.beforeAfter} />
    </div>
  );
}
