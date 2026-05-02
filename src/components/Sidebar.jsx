const sections = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", enabled: true },
      { id: "reports", label: "Reports", enabled: true },
      { id: "po-lab", label: "PO Lab", enabled: true },
    ],
  },
  {
    title: "Reports",
    items: [
      { id: "attendance", label: "Attendance", enabled: true },
      { id: "faults", label: "Faults & Tickets", enabled: true },
      { id: "ol", label: "OL Job Tracker", enabled: true },
      { id: "thermography", label: "Thermography", enabled: true },
      { id: "manpower", label: "Manpower Readiness", enabled: true },
      { id: "cleaning", label: "Deep Cleaning", enabled: true },
      { id: "cmpm", label: "CMPM", enabled: true },
      { id: "training", label: "Technical Training", enabled: true },
    ],
  },
  {
    title: "Masters",
    items: [
      { id: "stores", label: "Stores", enabled: true },
      { id: "users", label: "Users", enabled: false },
    ],
  },
  {
    title: "Settings",
    items: [
      { id: "data-sync", label: "Data Sync", enabled: true },
      { id: "email-alerts", label: "Email Alerts", enabled: false },
      { id: "system-settings", label: "System Settings", enabled: false },
    ],
  },
];

const itemAbbreviations = {
  dashboard: "DB",
  reports: "RP",
  "po-lab": "PO",
  attendance: "AT",
  faults: "FR",
  ol: "OL",
  thermography: "TH",
  manpower: "MP",
  cleaning: "DC",
  cmpm: "CM",
  training: "TT",
  stores: "ST",
  users: "US",
  "data-sync": "DS",
  "email-alerts": "EA",
  "system-settings": "SS",
};

export function Sidebar({ activeView, onNavigate, mobileOpen, onMobileClose }) {
  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onMobileClose} />}
      <aside className={`sidebar ${mobileOpen ? "is-mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand__logo">Q</div>
          <div>
            <h1>QPMS Ops</h1>
            <p>Quality. Property. Visibility.</p>
          </div>
          {mobileOpen && (
            <button type="button" className="sidebar-close" onClick={onMobileClose}>
              ×
            </button>
          )}
        </div>

        <div className="sidebar__status">
          <strong>Store Operations Command Center</strong>
          <span>Track attendance, faults, thermography, OL jobs, and compliance workflows in one workspace.</span>
        </div>

        <nav className="sidebar__nav">
          {sections.map((section) => (
            <div key={section.title} className="sidebar__section">
              <span className="sidebar__heading">
                {section.title}
                <b>{section.items.filter((item) => item.enabled).length}</b>
              </span>
              {section.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  disabled={!item.enabled}
                  className={`sidebar__link ${activeView === item.id ? "is-active" : ""} ${!item.enabled ? "is-disabled" : ""}`}
                  onClick={() => {
                    if (item.enabled) {
                      onNavigate(item.id);
                      onMobileClose && onMobileClose();
                    }
                  }}
                >
                  <span className="sidebar__icon">{itemAbbreviations[item.id] || item.label.slice(0, 2).toUpperCase()}</span>
                  <span className="sidebar__label">{item.label}</span>
                  {!item.enabled ? <small className="sidebar__coming-soon">Soon</small> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__footer-card">
            <strong>Phase 2 Ready</strong>
            <span>Spring Boot, database-backed updates, and team-level approvals can fit on top of this UI.</span>
          </div>
        </div>
      </aside>
    </>
  );
}
