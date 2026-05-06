import { useEffect, useMemo, useState } from "react";
import { formatNumber } from "../utils/formatters";
import { WORKFLOW_STAGES } from "../utils/qpmsWorkflow";
import { normalizeOperationalState } from "../utils/stateGroups";
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

const FAULT_PAGE_SIZE = 100;
const FAULT_TICKET_TYPES = [
  { value: "All", label: "All Tickets" },
  { value: "CM", label: "RFM4U Call Logs" },
  { value: "NC", label: "Non Critical Call Logs" },
];
const FAULT_CATEGORY_OPTIONS = ["All", "House Keeping", "Pest Control"];
const FAULT_STATE_OPTIONS = ["All", "TN", "KL", "KN", "TG", "AP-1", "AP-2"];

function uniqueSorted(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function matchesFaultCategory(rowCategory, selectedCategory) {
  if (selectedCategory === "All") return true;

  const category = normalizeText(rowCategory);
  if (selectedCategory === "House Keeping") {
    return category.includes("house") || category.includes("hk");
  }

  if (selectedCategory === "Pest Control") {
    return category.includes("pest");
  }

  return category === normalizeText(selectedCategory);
}

function matchesTicketType(ticketNumber, ticketType) {
  if (ticketType === "All") return true;
  return String(ticketNumber || "").trim().toUpperCase().startsWith(ticketType);
}

function getFaultState(row) {
  return normalizeOperationalState(row.state || row.region || row.location, "");
}

export function WorkflowTrackerPanel({ rows, reportType, currentRole, onStageChange, remarks = {}, onRemarkChange }) {
  const isFaultReport = reportType === "Fault Report";
  const counts = groupCounts(rows);
  const roleConfig = getRoleConfig(currentRole);
  const [activeRemarkRow, setActiveRemarkRow] = useState(null);
  const [draftRemark, setDraftRemark] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [faultPage, setFaultPage] = useState(1);
  const statusOptions = useMemo(() => ["All", ...uniqueSorted(["Assigned", ...rows.map((row) => row.status)])], [rows]);
  const sortedRows = [...rows].sort((left, right) => {
    const leftIndex = getStageIndex(left.workflowStage);
    const rightIndex = getStageIndex(right.workflowStage);
    return right.ageingDays - left.ageingDays || leftIndex - rightIndex;
  });
  const trackerFilteredRows = useMemo(() => {
    if (!isFaultReport) return sortedRows;

    const query = normalizeText(ticketSearch);
    return sortedRows.filter((row) => {
      const ticketNumber = String(row.ticketNumber || "");
      const matchesTicketSearch = !query || normalizeText(ticketNumber).includes(query);
      const matchesType = matchesTicketType(ticketNumber, ticketTypeFilter);
      const matchesState = stateFilter === "All" || getFaultState(row) === stateFilter;
      const matchesStatus = statusFilter === "All" || normalizeText(row.status) === normalizeText(statusFilter);
      const matchesCategory = matchesFaultCategory(row.category, categoryFilter);

      return matchesTicketSearch && matchesType && matchesState && matchesStatus && matchesCategory;
    });
  }, [categoryFilter, isFaultReport, sortedRows, stateFilter, statusFilter, ticketSearch, ticketTypeFilter]);
  const totalFaultPages = Math.max(1, Math.ceil(trackerFilteredRows.length / FAULT_PAGE_SIZE));
  const visibleRows = isFaultReport
    ? trackerFilteredRows.slice((faultPage - 1) * FAULT_PAGE_SIZE, faultPage * FAULT_PAGE_SIZE)
    : sortedRows.slice(0, 50);

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
  const faultStatusCoverage = isFaultReport
    ? {
        filled: trackerFilteredRows.filter((row) => String(row.remark ?? row.statusNote ?? "").trim()).length,
        blank: trackerFilteredRows.filter((row) => !String(row.remark ?? row.statusNote ?? "").trim()).length,
      }
    : null;

  useEffect(() => {
    setFaultPage(1);
  }, [categoryFilter, stateFilter, statusFilter, ticketSearch, ticketTypeFilter]);

  useEffect(() => {
    if (faultPage > totalFaultPages) {
      setFaultPage(totalFaultPages);
    }
  }, [faultPage, totalFaultPages]);

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
            <strong>{trackerFilteredRows.length} Tickets Visible</strong>
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

      {isFaultReport ? (
        <div className="workflow-tracker-controls">
          <label>
            <span>Search Ticket Number</span>
            <input
              type="search"
              value={ticketSearch}
              placeholder="Type ticket number"
              onChange={(event) => setTicketSearch(event.target.value)}
            />
          </label>
          <label>
            <span>Ticket Type</span>
            <select value={ticketTypeFilter} onChange={(event) => setTicketTypeFilter(event.target.value)}>
              {FAULT_TICKET_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>State</span>
            <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}>
              {FAULT_STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Category</span>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {FAULT_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {trackerFilteredRows.length === 0 ? (
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
          {isFaultReport ? (
            <div className="workflow-pagination">
              <span>
                Showing {visibleRows.length ? (faultPage - 1) * FAULT_PAGE_SIZE + 1 : 0}-
                {(faultPage - 1) * FAULT_PAGE_SIZE + visibleRows.length} of {trackerFilteredRows.length}
              </span>
              <div>
                <button type="button" className="ghost-button" onClick={() => setFaultPage((page) => Math.max(1, page - 1))} disabled={faultPage === 1}>
                  Previous
                </button>
                <span>
                  Page {faultPage} of {totalFaultPages}
                </span>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setFaultPage((page) => Math.min(totalFaultPages, page + 1))}
                  disabled={faultPage >= totalFaultPages}
                >
                  Next Page
                </button>
              </div>
            </div>
          ) : null}
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
