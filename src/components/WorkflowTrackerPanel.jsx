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

    setDraftRemark(remarks[activeRemarkRow.ticketNumber] || "");
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

  const title = reportType === "Fault Report" ? "Fault Job Lifecycle" : "OL Commercial Tracker";
  const subtitle =
    reportType === "Fault Report"
      ? "Use the remarks action to capture the latest fault status without leaving the tracker."
      : "The dropdown shows the full lifecycle, but teams can move jobs only inside their own hierarchy stages.";

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
        <div className="workflow-panel__role">
          <strong>{roleConfig.label}</strong>
          <span>Visible through stage {roleConfig.visibleMaxStage}</span>
        </div>
      </div>

      <div className="workflow-board">
        {counts.map((item) => (
          <article key={item.stage} className={`workflow-stage workflow-stage--${getLifecycleTone(item.index)}`}>
            <span className="workflow-stage__step">{item.index}</span>
            <strong>{formatNumber(item.count)}</strong>
            <p>{item.stage}</p>
          </article>
        ))}
      </div>

      {sortedRows.length === 0 ? (
        <div className="empty-state">
          <strong>No workflow jobs match the current role, month, and filters.</strong>
          <p>Jobs beyond your stage scope are hidden automatically.</p>
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
                <th>Criticality</th>
                <th>Breached</th>
                <th>Scope</th>
                <th>{reportType === "OL Report" ? "Status Bar" : "Remarks"}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.slice(0, 50).map((row) => {
                const stageIndex = getStageIndex(row.workflowStage);
                const rowEditable = canRoleEditStage(currentRole, stageIndex);
                const scopeLabel = getScopeLabel(currentRole, stageIndex);
                const remarkValue = remarks[row.ticketNumber] || "";

                return (
                  <tr key={row.ticketNumber}>
                    <td>{row.ticketNumber}</td>
                    <td>
                      <div className="store-cell">
                        <strong>{row.storeName}</strong>
                        <span>{row.storeId}</span>
                      </div>
                    </td>
                    <td>{row.issueTitle || "Issue not provided"}</td>
                    <td>{row.category || "Unknown"}</td>
                    <td>{formatNumber(row.ageingDays)}</td>
                    <td>{row.criticality || "NA"}</td>
                    <td>{row.breachedFlag || "No"}</td>
                    <td>{scopeLabel}</td>
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
                      ) : (
                        <button
                          type="button"
                          className={`remark-button ${roleConfig.canEditFaultRemarks ? "is-editable" : "is-readonly"}`}
                          onClick={() => setActiveRemarkRow(row)}
                        >
                          <strong>{roleConfig.canEditFaultRemarks ? "Edit Status" : "View Status"}</strong>
                          <span>{remarkValue ? "Update saved" : "Add current fault note"}</span>
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
                <p className="eyebrow">Fault Status Update</p>
                <h3 id="fault-remark-title">{activeRemarkRow.storeName}</h3>
                <p>
                  {activeRemarkRow.ticketNumber} | {activeRemarkRow.storeId} | Stage {getStageIndex(activeRemarkRow.workflowStage)}
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
                  {activeRemarkRow.issueTitle || "Issue not provided"}
                </span>
                <span>
                  <b>Current Stage</b>
                  {activeRemarkRow.workflowStage}
                </span>
              </div>

              <label className="workflow-modal__field">
                <span>Remarks</span>
                <textarea
                  value={draftRemark}
                  onChange={(event) => setDraftRemark(event.target.value)}
                  placeholder={
                    roleConfig.canEditFaultRemarks
                      ? "Add the latest fault status, blocker, team update, or next action..."
                      : "Remarks are visible in read-only mode for this role."
                  }
                  disabled={!roleConfig.canEditFaultRemarks}
                  rows={6}
                />
              </label>
            </div>

            <div className="workflow-modal__actions">
              <button type="button" className="ghost-button" onClick={closeRemarkModal}>
                Cancel
              </button>
              <button type="button" className="primary-button" onClick={saveRemark} disabled={!roleConfig.canEditFaultRemarks}>
                Save Remark
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
