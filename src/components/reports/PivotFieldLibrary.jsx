const zoneActions = {
  filters: "Filter",
  rows: "Row",
  columns: "Column",
  values: "Value",
};

function FieldCard({ field, onMoveField, onDragStart, assignedZone }) {
  const targetZones = field.type === "number" ? ["values"] : ["filters", "rows", "columns"];

  return (
    <article
      className={`pivot-field-card ${assignedZone ? "is-assigned" : ""}`}
      draggable
      onDragStart={(event) => onDragStart(event, field.id)}
    >
      <div className="pivot-field-card__header">
        <div>
          <strong>{field.label}</strong>
          <span>{field.type === "number" ? "Measure field" : "Dimension field"}</span>
        </div>
        {assignedZone ? <span className="pivot-field-card__badge">In {zoneActions[assignedZone]}</span> : null}
      </div>

      <div className="pivot-field-card__actions">
        {targetZones.map((zoneId) => (
          <button key={zoneId} type="button" className="pivot-mini-button" onClick={() => onMoveField(field.id, zoneId)}>
            + {zoneActions[zoneId]}
          </button>
        ))}
      </div>
    </article>
  );
}

export function PivotFieldLibrary({ report, assignedFieldIds, layoutByField, onMoveField, onDragStart }) {
  if (!report) {
    return null;
  }

  const dimensions = report.fields.filter((field) => field.type !== "number");
  const measures = report.fields.filter((field) => field.type === "number");

  return (
    <section className="panel pivot-field-library">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Field Library</p>
          <h3>{report.name}</h3>
          <p>Drag fields into the shelves or use the quick add buttons when you are on mobile or touch devices.</p>
        </div>
      </div>

      <div className="filter-summary">
        <span className="filter-chip">
          <b>Assigned</b>
          {assignedFieldIds.length}
        </span>
        <span className="filter-chip">
          <b>Dimensions</b>
          {dimensions.length}
        </span>
        <span className="filter-chip">
          <b>Measures</b>
          {measures.length}
        </span>
      </div>

      <div className="pivot-field-library__section">
        <div className="pivot-field-library__title">
          <strong>Dimensions</strong>
          <span>Use these for Filters, Rows, and Columns</span>
        </div>
        <div className="pivot-field-library__list">
          {dimensions.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              onMoveField={onMoveField}
              onDragStart={onDragStart}
              assignedZone={layoutByField[field.id]}
            />
          ))}
        </div>
      </div>

      <div className="pivot-field-library__section">
        <div className="pivot-field-library__title">
          <strong>Measures</strong>
          <span>Numeric fields used in the Values shelf</span>
        </div>
        <div className="pivot-field-library__list">
          {measures.map((field) => (
            <FieldCard
              key={field.id}
              field={field}
              onMoveField={onMoveField}
              onDragStart={onDragStart}
              assignedZone={layoutByField[field.id]}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
