export function FilterPanel({ options, filters, onChange, onReset, showReportType = true, lockedReportLabel = "", resultsCount = 0 }) {
  const formatMonth = (value) => {
    if (!/^\d{4}-\d{2}$/.test(String(value))) {
      return value;
    }

    const [year, month] = String(value).split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const renderSelect = (label, field, values) => (
    <label className="filter-field">
      <span>{label}</span>
      <select value={filters[field]} onChange={(event) => onChange(field, event.target.value)}>
        {values.map((value) => (
          <option key={value} value={value}>
            {field === "month" ? formatMonth(value) : value}
          </option>
        ))}
      </select>
    </label>
  );

  const activeChips = [
    { label: "Month", value: formatMonth(filters.month) },
    filters.region !== "All" ? { label: "Region", value: filters.region } : null,
    filters.location !== "All" ? { label: "Location", value: filters.location } : null,
    filters.storeId !== "All" ? { label: "Store", value: filters.storeId } : null,
    filters.status !== "All" ? { label: "Status", value: filters.status } : null,
    showReportType
      ? filters.reportType !== "All Reports"
        ? { label: "Report", value: filters.reportType }
        : null
      : { label: "Report", value: lockedReportLabel },
    filters.search.trim() ? { label: "Search", value: filters.search.trim() } : null,
  ].filter(Boolean);

  return (
    <section className="filters-card">
      <div className="filters-card__header">
        <div>
          <p className="eyebrow">Operational Filters</p>
          <h2>Store Performance Scope</h2>
          <p>Filter by month, geography, store, status, and report to quickly focus on pending actions and execution quality.</p>
        </div>
        <div className="filters-card__meta">
          <div className="filters-card__stat">
            <strong>{resultsCount}</strong>
            <span>visible rows</span>
          </div>
          <button type="button" className="ghost-button" onClick={onReset}>
            Reset
          </button>
        </div>
      </div>

      <div className="filters-grid">
        {renderSelect("Month", "month", options.months)}
        {renderSelect("Region", "region", options.regions)}
        {renderSelect("Location", "location", options.locations)}
        {renderSelect("Store ID", "storeId", options.storeIds)}
        {renderSelect("Status", "status", options.statuses)}
        {showReportType ? (
          renderSelect("Report Type", "reportType", options.reportTypes)
        ) : (
          <label className="filter-field">
            <span>Report Type</span>
            <input type="text" value={lockedReportLabel} readOnly />
          </label>
        )}
        <label className="filter-field filter-field--wide">
          <span>Search</span>
          <input
            type="text"
            placeholder="Store, location, region..."
            value={filters.search}
            onChange={(event) => onChange("search", event.target.value)}
          />
        </label>
      </div>

      <div className="filter-summary">
        {activeChips.map((chip) => (
          <span key={`${chip.label}-${chip.value}`} className="filter-chip">
            <b>{chip.label}</b>
            {chip.value}
          </span>
        ))}
      </div>
    </section>
  );
}
