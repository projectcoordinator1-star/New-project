import { useEffect, useState } from "react";
import { formatNumber } from "../utils/formatters";
import { WORKFLOW_STAGES } from "../utils/qpmsWorkflow";
import { canRoleEditStage, getAllowedStages, getRoleConfig, getScopeLabel, getStageIndex } from "../utils/workflowRoles";

function groupCounts(rows) {
  const counts = new Map(WORKFLOW_STAGES.map((stage) => [stage, 0]));

  rows.forEach((row) => {
    counts.set(row.workflowStage, (counts.get(row.workflowStage) || 0) + 1);
  });

  return WORKFLOW_STAGES.map((stage, index) => ({
    stage,
    count: counts.get(stage) || 0,
    index: index + 1,
  }));
}

function getLifecycleTone(index) {
  if (index <= 2) {
    return "blue";
  }

  if (index <= 5) {
    return "amber";
  }

  if (index <= 8) {
    return "purple";
  }

  return "green";
}

export function WorkflowTrackerPanel({ rows, reportType, currentRole, onStageChange, remarks = {}, onRemarkChange }) {
  const isFaultReport = reportType === "Fault Report";
  const counts = groupCounts(rows);
  const roleConfig = getRoleConfig(currentRole);
  const [activeRemarkRow, setActiveRemarkRow] = useState(null);
  const [draftRemark, setDraftRemark] = useState("");
  const sortedRows = [...rows].sort((left, right) => {
    const leftIndex = getStageIndex(left.workflowStage);
    const rightIndex = getStageIndex(right.workflowStage);
    return right.ageingDays - left.ageingDays || leftIndex - rightIndex;
  });

  useEffect(() => {
    if (!activeRemarkRow) {
      return;
    }

    setDraftRemark(activeRemarkRow.remark ?? remarks[activeRemarkRow.ticketNumber] ?? activeRemarkRow.statusNote ?? "");
  }, [activeRemarkRow, remarks]);

  useEffect(() => {
    if (!activeRemarkRow) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActiveRemarkRow(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [activeRemarkRow]);

  const title = isFaultReport ? "Fault Status Tracker" : "OL Commercial Tracker";
  const subtitle =
    isFaultReport
      ? "Shows every imported fault ticket in scope. Status_2 values are displayed as remarks and can be updated inline."
      : "The dropdown shows the full lifecycle, but teams can move jobs only inside their own hierarchy stages.";
  const visibleRows = isFaultReport ? sortedRows : sortedRows.slice(0, 50);
  const faultStatusCoverage = isFaultReport
    ? {
        filled: rows.filter((row) => String(row.remark ?? row.statusNote ?? "").trim()).length,
        blank: rows.filter((row) => !String(row.remark ?? row.statusNote ?? "").trim()).length,
      }
    : null;

  const closeRemarkModal = () => {
    setActiveRemarkRow(null);
    setDraftRemark("");
  };

  const saveRemark = () => {
    if (!activeRemarkRow || !onRemarkChange) {
      return;
    }

    onRemarkChange(activeRemarkRow.ticketNumber, draftRemark);
    closeRemarkModal();
  };

  return (
    <section className="panel workflow-panel">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {isFaultReport ? (
          <div className="workflow-panel__role">
            <strong>{rows.length} Tickets Visible</strong>
            <span>
              {faultStatusCoverage?.filled || 0} with Status_2 notes | {faultStatusCoverage?.blank || 0} blank
            </span>
          </div>
        ) : (
          <div className="workflow-panel__role">
            <strong>{roleConfig.label}</strong>
            <span>Visible through stage {roleConfig.visibleMaxStage}</span>
          </div>
        )}
      </div>

      {!isFaultReport ? (
        <div className="workflow-board">
          {counts.map((item) => (
            <article key={item.stage} className={`workflow-stage workflow-stage--${getLifecycleTone(item.index)}`}>
              <span className="workflow-stage__step">{item.index}</span>
              <strong>{formatNumber(item.count)}</strong>
              <p>{item.stage}</p>
            </article>
          ))}
        </div>
      ) : null}

      {sortedRows.length === 0 ? (
        <div className="empty-state">
          <strong>{isFaultReport ? "No fault tickets match the current month and filters." : "No workflow jobs match the current role, month, and filters."}</strong>
          <p>{isFaultReport ? "Try changing the month, store, or search filters." : "Jobs beyond your stage scope are hidden automatically."}</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table workflow-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Store</th>
                <th>Issue</th>
                <th>Category</th>
                <th>Ageing</th>
                <th>{isFaultReport ? "Status" : "Criticality"}</th>
                <th>Breached</th>
                {!isFaultReport && <th>Scope</th>}
                <th>{isFaultReport ? "Status_2 / Remarks Update" : (reportType === "OL Report" ? "Status Bar" : "Update")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const stageIndex = getStageIndex(row.workflowStage);
                const rowEditable = isFaultReport ? true : canRoleEditStage(currentRole, stageIndex);
                const scopeLabel = getScopeLabel(currentRole, stageIndex);
                const remarkValue = row.remark ?? remarks[row.ticketNumber] ?? row.statusNote ?? "";

                return (
                  <tr key={row.ticketNumber}>
                    <td>{row.ticketNumber}</td>
                    <td>
                      <div className="store-cell">
                        <strong>{row.storeName}</strong>
                        <span>{row.storeId}</span>
                      </div>
                    </td>
                    <td>{row.issueTitle || ""}</td>
                    <td>{row.category || ""}</td>
                    <td>{formatNumber(row.ageingDays)}</td>
                    <td>{isFaultReport ? row.status || "" : row.criticality || "NA"}</td>
                    <td>{row.breachedFlag || ""}</td>
                    {!isFaultReport && <td>{scopeLabel}</td>}
                    <td>
                      {reportType === "OL Report" ? (
                        <select
                          className="workflow-stage-select"
                          value={row.workflowStage}
                          onChange={(event) => onStageChange(row.ticketNumber, event.target.value)}
                          disabled={!rowEditable}
                        >
                          {WORKFLOW_STAGES.map((stage, index) => {
                            const optionStageIndex = index + 1;
                            const isAllowed = getAllowedStages(currentRole).includes(stage);

                            return (
                              <option key={stage} value={stage} disabled={!isAllowed && stage !== row.workflowStage}>
                                {optionStageIndex}. {stage}
                              </option>
                            );
                          })}
                        </select>
                      ) : isFaultReport ? (
                        <input
                          type="text"
                          className="workflow-inline-input"
                          key={`${row.ticketNumber}-${remarkValue}`}
                          defaultValue={remarkValue}
                          placeholder="Update Status_2..."
                          onBlur={(e) => {
                            if (e.target.value !== remarkValue) {
                              onRemarkChange(row.ticketNumber, e.target.value);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              if (e.target.value !== remarkValue) {
                                onRemarkChange(row.ticketNumber, e.target.value);
                              }
                              e.target.blur();
                            }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="remark-button is-editable"
                          onClick={() => setActiveRemarkRow(row)}
                        >
                          <strong>Update Status</strong>
                          <span>{remarkValue}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeRemarkRow ? (
        <div className="workflow-modal">
          <div className="workflow-modal__backdrop" onClick={closeRemarkModal} />
          <div className="workflow-modal__card" role="dialog" aria-modal="true" aria-labelledby="fault-remark-title">
            <div className="workflow-modal__header">
              <div>
                <p className="eyebrow">{isFaultReport ? "Fault Status Update" : "Workflow Status Update"}</p>
                <h3 id="fault-remark-title">{activeRemarkRow.storeName}</h3>
                <p>
                  {activeRemarkRow.ticketNumber} | {activeRemarkRow.storeId}
                  {isFaultReport ? "" : ` | Stage ${getStageIndex(activeRemarkRow.workflowStage)}`}
                </p>
              </div>
              <button type="button" className="ghost-button" onClick={closeRemarkModal}>
                Close
              </button>
            </div>

            <div className="workflow-modal__body">
              <div className="workflow-modal__meta">
                <span>
                  <b>Issue</b>
                  {activeRemarkRow.issueTitle || ""}
                </span>
                <span>
                  <b>{isFaultReport ? "Current Status" : "Current Stage"}</b>
                  {isFaultReport ? activeRemarkRow.status || "" : activeRemarkRow.workflowStage}
                </span>
              </div>

              <label className="workflow-modal__field">
                <span>{isFaultReport ? "Status_2 / Remarks" : "Remarks"}</span>
                <textarea
                  value={draftRemark}
                  onChange={(event) => setDraftRemark(event.target.value)}
                  placeholder={isFaultReport ? "" : "Add the latest fault status, blocker, team update, or next action..."}
                  disabled={false}
                  rows={6}
                />
              </label>
            </div>

            <div className="workflow-modal__actions">
              <button type="button" className="ghost-button" onClick={closeRemarkModal}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={saveRemark}>
                {isFaultReport ? "Save Status_2" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
