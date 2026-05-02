function FaultRemarkCard({ row, remark, editable, onRemarkChange }) {
  return (
    <article className="fault-remark-card">
      <div className="fault-remark-card__header">
        <div>
          <strong>{row.storeName}</strong>
          <span>
            {row.ticketNumber} | {row.storeId}
          </span>
        </div>
        <span className="fault-remark-card__stage">{row.workflowStage}</span>
      </div>

      <p className="fault-remark-card__issue">{row.issueTitle || "Issue not provided"}</p>

      <textarea
        value={remark}
        onChange={(event) => onRemarkChange && onRemarkChange(row.ticketNumber, event.target.value)}
        placeholder={editable ? "Add MIS update, blocker, vendor note, or next action..." : "Remarks visible in read-only mode"}
        disabled={!editable || !onRemarkChange}
        rows={4}
      />
    </article>
  );
}

export function FaultRemarksPanel({ rows, roleLabel, editable, remarks, onRemarkChange }) {
  return (
    <section className="panel fault-remarks-panel">
      <div className="panel__header">
        <div>
          <h3>Fault Remarks Desk</h3>
          <p>
            MIS can capture structured updates here. Current role: <strong>{roleLabel}</strong>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No fault jobs are visible for this role and month.</strong>
          <p>Load the pending source and switch workflow role if you want to test remarks entry.</p>
        </div>
      ) : (
        <div className="fault-remarks-grid">
          {rows.slice(0, 18).map((row) => (
            <FaultRemarkCard
              key={row.ticketNumber || row.storeId}
              row={row}
              remark={remarks[row.ticketNumber] || ""}
              editable={editable}
              onRemarkChange={onRemarkChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
