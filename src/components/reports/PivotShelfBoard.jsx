function ShelfChip({ field, onRemove }) {
  return (
    <div className="pivot-shelf-chip">
      <div>
        <strong>{field.label}</strong>
        {field.aggregation ? <span>{field.aggregation.toUpperCase()}</span> : null}
      </div>
      <button type="button" className="pivot-shelf-chip__remove" onClick={onRemove} aria-label={`Remove ${field.label}`}>
        ×
      </button>
    </div>
  );
}

function FilterShelfChip({ field, value, options, onChange, onRemove }) {
  return (
    <div className="pivot-filter-chip">
      <div className="pivot-filter-chip__header">
        <strong>{field.label}</strong>
        <button type="button" className="pivot-shelf-chip__remove" onClick={onRemove} aria-label={`Remove ${field.label}`}>
          ×
        </button>
      </div>
      <select value={value || "All"} onChange={(event) => onChange(field.id, event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function DropShelf({ title, helper, fields, zoneId, onDragOver, onDrop, children }) {
  return (
    <section className="pivot-shelf">
      <div className="pivot-shelf__header">
        <strong>{title}</strong>
        <span>{helper}</span>
      </div>
      <div className="pivot-shelf__body" onDragOver={onDragOver} onDrop={(event) => onDrop(event, zoneId)}>
        {fields.length ? children : <p className="pivot-shelf__empty">Drop fields here</p>}
      </div>
    </section>
  );
}

export function PivotShelfBoard({
  report,
  layout,
  filterValues,
  onFilterValueChange,
  onFieldDrop,
  onRemoveField,
  onResetLayout,
  getFilterOptions,
}) {
  if (!report) {
    return null;
  }

  const fieldMap = report.fieldMap;
  const shelves = [
    { id: "filters", title: "Filters", helper: "Slice the source rows before building the pivot" },
    { id: "columns", title: "Columns", helper: "Create column buckets across the top" },
    { id: "rows", title: "Rows", helper: "Create row groups down the left side" },
    { id: "values", title: "Values", helper: "Choose numeric measures to aggregate" },
  ];

  return (
    <section className="panel pivot-shelf-board">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Pivot Shelves</p>
          <h3>Filters, Columns, Rows, Values</h3>
          <p>This works like an Excel pivot builder: assign fields to shelves and the preview updates in the center.</p>
        </div>
        <div className="panel__actions">
          <button type="button" className="ghost-button" onClick={onResetLayout}>
            Reset Layout
          </button>
        </div>
      </div>

      <div className="pivot-shelf-grid">
        {shelves.map((shelf) => {
          const shelfFields = layout[shelf.id].map((fieldId) => fieldMap.get(fieldId)).filter(Boolean);

          return (
            <DropShelf
              key={shelf.id}
              title={shelf.title}
              helper={shelf.helper}
              zoneId={shelf.id}
              fields={shelfFields}
              onDragOver={(event) => event.preventDefault()}
              onDrop={onFieldDrop}
            >
              {shelf.id === "filters"
                ? shelfFields.map((field) => (
                    <FilterShelfChip
                      key={field.id}
                      field={field}
                      value={filterValues[field.id]}
                      options={getFilterOptions(field.id)}
                      onChange={onFilterValueChange}
                      onRemove={() => onRemoveField(field.id)}
                    />
                  ))
                : shelfFields.map((field) => <ShelfChip key={field.id} field={field} onRemove={() => onRemoveField(field.id)} />)}
            </DropShelf>
          );
        })}
      </div>
    </section>
  );
}
