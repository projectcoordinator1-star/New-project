import { WORKFLOW_ROLES } from "../utils/workflowRoles";

export function Header({
  monthLabel,
  currentRole,
  onRoleChange,
  activeView,
  dataInfo,
  visibleStoreCount,
  effectiveReportType,
  onMobileMenuOpen,
}) {
  const currentRoleLabel = WORKFLOW_ROLES.find((role) => role.id === currentRole)?.label || "HQ Admin";
  const modeLabel = dataInfo?.mode === "database" ? "Live DB" : "Demo Snapshot";
  const reportLabel =
    activeView === "dashboard" ? effectiveReportType : activeView.replace(/-/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
  const visibleLabel = activeView === "faults" || activeView === "ol" ? "Visible Jobs" : "Visible Stores";
  const workflowModeLabel = activeView === "faults" ? "All fault tickets visible" : "Role-scoped workflow";

  return (
    <header className="topbar">
      <div className="topbar__intro">
        <div className="topbar__search">
          <button type="button" className="mobile-menu-trigger" onClick={onMobileMenuOpen} aria-label="Open navigation menu">
            Menu
          </button>
          <span className="topbar__menu">||</span>
          <input type="text" value="Search stores, sites, reports..." readOnly aria-label="Search" />
          <span className="topbar__shortcut">Ctrl + K</span>
        </div>
        <div className="topbar__meta">
          <span className="topbar__meta-pill">Operational cockpit</span>
          <span className="topbar__meta-pill">{workflowModeLabel}</span>
          <span className="topbar__meta-pill topbar__meta-pill--status">
            <span className="pulse-dot" />
            {modeLabel}
          </span>
        </div>
      </div>

      <div className="topbar__actions">
        <button type="button" className="date-chip">
          {monthLabel}
        </button>
        <label className="role-chip">
          <span>Workflow Role</span>
          <select value={currentRole} onChange={(event) => onRoleChange(event.target.value)}>
            {WORKFLOW_ROLES.map((role) => (
              <option key={role.id} value={role.id}>
                {role.label}
              </option>
            ))}
          </select>
        </label>
        <div className="user-chip">
          <div className="user-chip__avatar">A</div>
          <div>
            <strong>Admin User</strong>
            <span>{currentRoleLabel}</span>
          </div>
        </div>
      </div>
      <div className="topbar__strip">
        <span className="topbar__strip-pill">
          <b>Scope</b> {reportLabel}
        </span>
        <span className="topbar__strip-pill">
          <b>{visibleLabel}</b> {visibleStoreCount}
        </span>
        <span className="topbar__strip-pill">
          <b>Month</b> {monthLabel}
        </span>
      </div>
    </header>
  );
}
