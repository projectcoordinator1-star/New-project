function renderField(filter, value, onChange) {
  if (filter.type === "date") {
    return (
      <label key={filter.id} className="filter-field">
        <span>{filter.label}</span>
        <input type="date" value={value || ""} onChange={(event) => onChange(filter.id, event.target.value)} />
      </label>
    );
  }

  return (
    <label key={filter.id} className="filter-field">
      <span>{filter.label}</span>
      <select value={value || filter.defaultValue || ""} onChange={(event) => onChange(filter.id, event.target.value)}>
        {filter.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReportFilterPanel({
  report,
  filterValues,
  activeFilterCount,
  onFilterChange,
  onApply,
  onReset,
  isPending = false,
}) {
  if (!report) {
    return null;
  }

  return (
    <aside className="panel report-filter-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Dynamic Filters</p>
          <h3>{report.name}</h3>
          <p>{report.description}</p>
        </div>
        <div className="filters-card__stat report-filter-panel__stat">
          <strong>{activeFilterCount}</strong>
          <span>active filters</span>
        </div>
      </div>

      <div className="report-filter-panel__grid">
        {report.filters.map((filter) => renderField(filter, filterValues?.[filter.id], onFilterChange))}
      </div>

      <div className="report-filter-panel__footer">
        <button type="button" className="ghost-button" onClick={onReset} disabled={isPending}>
          Reset Filters
        </button>
        <button type="button" className="primary-button" onClick={onApply} disabled={isPending}>
          {isPending ? "Running..." : "Run Report"}
        </button>
      </div>
    </aside>
  );
}
