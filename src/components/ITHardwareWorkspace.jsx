import { useEffect, useMemo, useState } from "react";
import {
  IT_ASSET_STATUSES,
  IT_DEMO_ASSETS,
  IT_DEMO_AUDIT_LOGS,
  IT_DEMO_CONFIG,
  IT_DEMO_EMAIL_EVENTS,
  IT_DEMO_EMPLOYEES,
  IT_DEMO_TICKETS,
  IT_ENVIRONMENT_KEYS,
  IT_HARDWARE_CATEGORIES,
  IT_INTEGRATION_ADAPTERS,
  IT_PRIORITY_OPTIONS,
} from "../data/itHardwareDemoData";
import {
  buildAuditLog,
  buildEmailEvent,
  buildNextTicketNumber,
  canAdministerItModule,
  canManageItTickets,
  getItAccessLevel,
  getNextStatuses,
  getScopedItTickets,
  getTicketDisplayStatus,
  getTicketStatusTone,
  groupTicketsByField,
  isOfficialEmail,
  normalizeEmail,
  parseEmployeeCsv,
  summarizeInventory,
  summarizeTickets,
} from "../utils/itHardware";
import {
  createItHardwareTicket,
  fetchItHardwareBootstrap,
  importItHardwareEmployees,
  loginItHardwareEmployee,
  updateItHardwareTicket,
} from "../services/itHardwareService";

const STORAGE_EMAIL_KEY = "qpms-it-hardware-email";

const emptyTicketForm = {
  ticketType: "New Hardware Request",
  priority: "Medium",
  hardwareCategory: "Laptop",
  assetId: "",
  subject: "",
  description: "",
  businessJustification: "",
  neededBy: "",
};

const emptyAssetForm = {
  assetTag: "",
  category: "Laptop",
  brand: "",
  model: "",
  serialNumber: "",
  status: "Available",
  assignedToEmail: "",
  warrantyEnd: "",
  purchaseDate: "",
  location: "IT Store",
};

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function readStoredEmail() {
  if (typeof window === "undefined") {
    return IT_DEMO_EMPLOYEES[0].email;
  }

  return window.localStorage.getItem(STORAGE_EMAIL_KEY) || IT_DEMO_EMPLOYEES[0].email;
}

function mapEmployeeRoleToWorkflowRole(role) {
  const normalizedRole = String(role || "").toUpperCase();

  if (normalizedRole === "IT") return "it";
  if (normalizedRole === "ADMIN") return "admin";
  return "employee";
}

function createEmployeeFromEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const name = normalizedEmail
    .split("@")[0]
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    employeeId: `EMP-${Date.now()}`,
    fullName: name || "Demo Employee",
    email: normalizedEmail,
    department: "Demo Department",
    designation: "Employee",
    officeLocation: "Office",
    role: "EMPLOYEE",
    managerEmail: "",
    isActive: true,
  };
}

function normalizeBootstrapPayload(payload) {
  const data = payload.data || payload;

  return {
    employees: data.employees || IT_DEMO_EMPLOYEES,
    assets: data.assets || IT_DEMO_ASSETS,
    tickets: data.tickets || IT_DEMO_TICKETS,
    auditLogs: data.auditLogs || data.audit_logs || IT_DEMO_AUDIT_LOGS,
    emailEvents: data.emailEvents || data.email_events || IT_DEMO_EMAIL_EVENTS,
    config: data.config || IT_DEMO_CONFIG,
  };
}

function MetricCard({ item }) {
  return (
    <article className={`it-metric-card it-metric-card--${item.tone || "blue"}`}>
      <span>{item.title}</span>
      <strong>{item.value}</strong>
      <p>{item.note}</p>
    </article>
  );
}

function StatusBadge({ status }) {
  return <span className={`it-status-badge it-status-badge--${getTicketStatusTone(status)}`}>{status}</span>;
}

function EnvironmentKeyList({ config }) {
  return (
    <div className="it-env-grid">
      {IT_ENVIRONMENT_KEYS.map((key) => (
        <span key={key}>
          <b>{key}</b>
          {config?.[toConfigKey(key)] || "Configured on server"}
        </span>
      ))}
    </div>
  );
}

function toConfigKey(envKey) {
  const [first, ...rest] = envKey.toLowerCase().split("_");
  return `${first}${rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;
}

export function ITHardwareWorkspace({ currentRole, onRoleChange }) {
  const [employees, setEmployees] = useState(() => cloneRows(IT_DEMO_EMPLOYEES));
  const [assets, setAssets] = useState(() => cloneRows(IT_DEMO_ASSETS));
  const [tickets, setTickets] = useState(() => cloneRows(IT_DEMO_TICKETS));
  const [auditLogs, setAuditLogs] = useState(() => cloneRows(IT_DEMO_AUDIT_LOGS));
  const [emailEvents, setEmailEvents] = useState(() => cloneRows(IT_DEMO_EMAIL_EVENTS));
  const [config, setConfig] = useState(IT_DEMO_CONFIG);
  const [activeTab, setActiveTab] = useState("raise");
  const [loginEmail, setLoginEmail] = useState(readStoredEmail);
  const [loginError, setLoginError] = useState("");
  const [apiStatus, setApiStatus] = useState("Demo mode");
  const [isLoading, setIsLoading] = useState(false);
  const [ticketForm, setTicketForm] = useState(emptyTicketForm);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [csvImportMessage, setCsvImportMessage] = useState("");

  const activeEmployee = useMemo(() => {
    const normalizedLogin = normalizeEmail(loginEmail);
    return employees.find((employee) => normalizeEmail(employee.email) === normalizedLogin) || null;
  }, [employees, loginEmail]);

  const accessLevel = getItAccessLevel(currentRole, activeEmployee?.role);
  const canManage = canManageItTickets(currentRole, activeEmployee?.role);
  const canAdminister = canAdministerItModule(currentRole, activeEmployee?.role);

  const scopedTickets = useMemo(
    () =>
      getScopedItTickets(tickets, activeEmployee, currentRole).sort(
        (left, right) => new Date(right.updatedAt || right.createdAt) - new Date(left.updatedAt || left.createdAt),
      ),
    [activeEmployee, currentRole, tickets],
  );
  const ticketMetrics = useMemo(() => summarizeTickets(scopedTickets), [scopedTickets]);
  const inventorySummary = useMemo(() => summarizeInventory(assets), [assets]);
  const statusGroups = useMemo(() => groupTicketsByField(scopedTickets, "status"), [scopedTickets]);
  const typeGroups = useMemo(() => groupTicketsByField(scopedTickets, "ticketType"), [scopedTickets]);
  const departmentGroups = useMemo(() => groupTicketsByField(scopedTickets, "department"), [scopedTickets]);

  const tabs = useMemo(() => {
    const baseTabs = [
      { id: "raise", label: "Raise Ticket" },
      { id: "tickets", label: canManage ? "IT Queue" : "My Tickets" },
      { id: "assets", label: "Assets" },
      { id: "reports", label: "Reports" },
      { id: "integrations", label: "Integrations" },
    ];

    if (canManage) {
      baseTabs.splice(3, 0, { id: "employees", label: "Employees" });
      baseTabs.splice(5, 0, { id: "audit", label: "Audit Logs" });
    }

    return baseTabs;
  }, [canManage]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("tickets");
    }
  }, [activeTab, tabs]);

  useEffect(() => {
    if (typeof window !== "undefined" && loginEmail) {
      window.localStorage.setItem(STORAGE_EMAIL_KEY, loginEmail);
    }
  }, [loginEmail]);

  useEffect(() => {
    let cancelled = false;

    async function loadBootstrap() {
      setIsLoading(true);
      try {
        const payload = await fetchItHardwareBootstrap({
          email: loginEmail,
          workflowRole: currentRole,
        });

        if (cancelled) return;

        const bootstrap = normalizeBootstrapPayload(payload);
        setEmployees(cloneRows(bootstrap.employees));
        setAssets(cloneRows(bootstrap.assets));
        setTickets(cloneRows(bootstrap.tickets));
        setAuditLogs(cloneRows(bootstrap.auditLogs));
        setEmailEvents(cloneRows(bootstrap.emailEvents));
        setConfig(bootstrap.config);
        setApiStatus("Live API");
      } catch {
        if (!cancelled) {
          setApiStatus("Demo mode");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadBootstrap();

    return () => {
      cancelled = true;
    };
  }, [currentRole, loginEmail]);

  const handleDemoLogin = (employee) => {
    setLoginEmail(employee.email);
    setLoginError("");
    onRoleChange?.(mapEmployeeRoleToWorkflowRole(employee.role));
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(loginEmail);
    if (!isOfficialEmail(normalizedEmail, config.allowedEmailDomain)) {
      setLoginError(`Use an official office email for ${config.allowedEmailDomain || "the configured company domain"}.`);
      return;
    }

    setLoginError("");
    try {
      const result = await loginItHardwareEmployee(normalizedEmail);
      const employee = result.employee || result.data?.employee;
      if (employee) {
        setEmployees((current) => upsertByKey(current, employee, "email"));
        setLoginEmail(employee.email);
        onRoleChange?.(mapEmployeeRoleToWorkflowRole(employee.role));
        setApiStatus("Live API");
      }
    } catch {
      const existing = employees.find((employee) => normalizeEmail(employee.email) === normalizedEmail);
      const employee = existing || createEmployeeFromEmail(normalizedEmail);
      setEmployees((current) => upsertByKey(current, employee, "email"));
      setLoginEmail(employee.email);
      onRoleChange?.(mapEmployeeRoleToWorkflowRole(employee.role));
      setApiStatus("Demo mode");
    }
  };

  const handleTicketFieldChange = (field, value) => {
    setTicketForm((current) => ({ ...current, [field]: value }));
  };

  const handleRaiseTicket = async (event) => {
    event.preventDefault();

    if (!activeEmployee) {
      setLoginError("Login with an official office email before raising a ticket.");
      return;
    }

    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      setLoginError("Add a ticket subject and description.");
      return;
    }

    const ticketNumber = buildNextTicketNumber(tickets);
    const now = new Date().toISOString();
    const ticketPayload = {
      ...ticketForm,
      ticketId: ticketNumber,
      ticketNumber,
      status: "Requested",
      resolutionStatus: "Open",
      employeeId: activeEmployee.employeeId,
      employeeName: activeEmployee.fullName,
      employeeEmail: activeEmployee.email,
      department: activeEmployee.department,
      designation: activeEmployee.designation,
      assignedToEmail: "",
      createdAt: now,
      updatedAt: now,
      resolvedAt: "",
      closedAt: "",
      resolutionNote: "",
    };

    try {
      const result = await createItHardwareTicket(ticketPayload, {
        email: activeEmployee.email,
        workflowRole: currentRole,
      });
      applyTicketPayload(result.ticket || result.data?.ticket || ticketPayload, result);
      setApiStatus("Live API");
    } catch {
      applyTicketPayload(ticketPayload, {
        auditLog: buildAuditLog(
          ticketNumber,
          "Ticket Raised",
          activeEmployee.email,
          "Ticket raised in demo mode. Notification queued to IT_TEAM_EMAIL with HR_MANAGER_EMAIL in CC.",
        ),
        emailEvent: buildEmailEvent(ticketNumber, "RAISED", "IT_TEAM_EMAIL", "HR_MANAGER_EMAIL"),
      });
      setApiStatus("Demo mode");
    }

    setTicketForm(emptyTicketForm);
    setLoginError("");
    setActiveTab("tickets");
  };

  const applyTicketPayload = (ticket, result = {}) => {
    setTickets((current) => upsertByKey(current, ticket, "ticketNumber"));

    const auditLog = result.auditLog || result.data?.auditLog;
    if (auditLog) {
      setAuditLogs((current) => [auditLog, ...current]);
    }

    const emailEvent = result.emailEvent || result.data?.emailEvent;
    if (emailEvent) {
      setEmailEvents((current) => [emailEvent, ...current]);
    }
  };

  const handleTicketUpdate = async (ticket, updates) => {
    if (!canManage || !activeEmployee) {
      return;
    }

    const nextUpdates = { ...updates };
    if (nextUpdates.status === "Closed") {
      nextUpdates.resolutionStatus = "Resolved";
      nextUpdates.resolvedAt = new Date().toISOString();
      nextUpdates.closedAt = new Date().toISOString();
      nextUpdates.resolutionNote = nextUpdates.resolutionNote || ticket.resolutionNote || "Resolved and closed by IT team.";
    }

    const nextTicket = {
      ...ticket,
      ...nextUpdates,
      updatedAt: new Date().toISOString(),
      assignedToEmail: ticket.assignedToEmail || activeEmployee.email,
    };

    try {
      const result = await updateItHardwareTicket(ticket.ticketNumber, nextUpdates, {
        email: activeEmployee.email,
        workflowRole: currentRole,
      });
      applyTicketPayload(result.ticket || result.data?.ticket || nextTicket, result);
      updateLinkedAsset(nextTicket);
      setApiStatus("Live API");
    } catch {
      applyTicketPayload(nextTicket, {
        auditLog: buildAuditLog(
          ticket.ticketNumber,
          nextUpdates.status === "Closed" ? "Ticket Closed" : "Ticket Updated",
          activeEmployee.email,
          `Updated ticket in demo mode: ${Object.keys(nextUpdates).join(", ")}.`,
        ),
        emailEvent:
          nextUpdates.status === "Closed"
            ? buildEmailEvent(ticket.ticketNumber, "CLOSED", "Employee email", "HR_MANAGER_EMAIL")
            : null,
      });
      updateLinkedAsset(nextTicket);
      setApiStatus("Demo mode");
    }
  };

  const updateLinkedAsset = (ticket) => {
    if (!ticket.assetId) {
      return;
    }

    setAssets((current) =>
      current.map((asset) => {
        if (asset.assetId !== ticket.assetId) {
          return asset;
        }

        if (ticket.status === "Returned" || ticket.status === "Closed") {
          return { ...asset, status: "Available", assignedToEmail: "" };
        }

        if (ticket.status === "Issued" || ticket.status === "In Use") {
          return { ...asset, status: ticket.status, assignedToEmail: ticket.employeeEmail };
        }

        if (ticket.status === "Repair Pending") {
          return { ...asset, status: "Repair" };
        }

        return asset;
      }),
    );
  };

  const handleAssetFieldChange = (field, value) => {
    setAssetForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddAsset = (event) => {
    event.preventDefault();

    if (!canManage || !assetForm.assetTag.trim()) {
      return;
    }

    const asset = {
      ...assetForm,
      assetId: `AST-${Date.now()}`,
    };

    setAssets((current) => [asset, ...current]);
    setAuditLogs((current) => [
      buildAuditLog("Asset Inventory", "Asset Added", activeEmployee?.email || "system", `${asset.assetTag} added to inventory.`),
      ...current,
    ]);
    setAssetForm(emptyAssetForm);
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    const rows = parseEmployeeCsv(text).filter((employee) => isOfficialEmail(employee.email, config.allowedEmailDomain));

    if (!rows.length) {
      setCsvImportMessage("No valid employees found. CSV needs official email values.");
      return;
    }

    try {
      const result = await importItHardwareEmployees(rows, {
        email: activeEmployee?.email,
        workflowRole: currentRole,
      });
      const imported = result.employees || result.data?.employees || rows;
      setEmployees((current) => mergeByKey(current, imported, "email"));
      setCsvImportMessage(`${imported.length} employees imported through API.`);
      setApiStatus("Live API");
    } catch {
      setEmployees((current) => mergeByKey(current, rows, "email"));
      setCsvImportMessage(`${rows.length} employees imported into demo data.`);
      setApiStatus("Demo mode");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <section className="it-hardware-workspace">
      <div className="it-hero panel">
        <div className="it-hero__copy">
          <span className="eyebrow">Internal IT Service Desk</span>
          <h3>Hardware Ticketing System</h3>
          <p>
            Employees can raise hardware requests from their office email, while IT and Admin roles can manage issuance,
            returns, repairs, replacements, closure, audit logs, and inventory.
          </p>
        </div>
        <div className="it-access-card">
          <span>Access</span>
          <strong>{accessLevel === "admin" ? "Admin Full Access" : accessLevel === "it" ? "IT Team Queue" : "Employee Self Service"}</strong>
          <p>{apiStatus}{isLoading ? " - syncing" : ""}</p>
        </div>
      </div>

      <div className="it-login-panel panel">
        <form className="it-login-form" onSubmit={handleLogin}>
          <label>
            <span>Official Office Email</span>
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder={`name@${config.allowedEmailDomain || "company.com"}`}
            />
          </label>
          <button type="submit" className="primary-button">
            Login
          </button>
        </form>

        <div className="it-demo-logins" aria-label="Demo employee logins">
          {employees.slice(0, 5).map((employee) => (
            <button
              type="button"
              key={employee.email}
              className={normalizeEmail(employee.email) === normalizeEmail(loginEmail) ? "is-selected" : ""}
              onClick={() => handleDemoLogin(employee)}
            >
              <strong>{employee.fullName}</strong>
              <span>{employee.role}</span>
            </button>
          ))}
        </div>

        {activeEmployee ? (
          <div className="it-current-user">
            <strong>{activeEmployee.fullName}</strong>
            <span>
              {activeEmployee.department} | {activeEmployee.designation} | {activeEmployee.email}
            </span>
          </div>
        ) : null}
        {loginError ? <p className="it-form-error">{loginError}</p> : null}
      </div>

      <div className="it-metric-grid">
        {ticketMetrics.map((item) => (
          <MetricCard key={item.title} item={item} />
        ))}
      </div>

      <div className="it-tabs" role="tablist" aria-label="IT hardware module views">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={activeTab === tab.id ? "is-active" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "raise" ? (
        <TicketFormPanel
          ticketForm={ticketForm}
          assets={assets}
          onFieldChange={handleTicketFieldChange}
          onSubmit={handleRaiseTicket}
        />
      ) : null}

      {activeTab === "tickets" ? (
        <TicketQueuePanel
          tickets={scopedTickets}
          assets={assets}
          canManage={canManage}
          currentRole={currentRole}
          onTicketUpdate={handleTicketUpdate}
        />
      ) : null}

      {activeTab === "assets" ? (
        <AssetInventoryPanel
          assets={assets}
          employees={employees}
          summary={inventorySummary}
          canManage={canManage}
          assetForm={assetForm}
          onAssetFieldChange={handleAssetFieldChange}
          onAddAsset={handleAddAsset}
        />
      ) : null}

      {activeTab === "employees" && canManage ? (
        <EmployeeImportPanel
          employees={employees}
          canAdminister={canAdminister}
          csvImportMessage={csvImportMessage}
          onCsvImport={handleCsvImport}
        />
      ) : null}

      {activeTab === "reports" ? (
        <ReportsPanel
          statusGroups={statusGroups}
          typeGroups={typeGroups}
          departmentGroups={departmentGroups}
          emailEvents={emailEvents}
        />
      ) : null}

      {activeTab === "audit" && canManage ? <AuditPanel auditLogs={auditLogs} emailEvents={emailEvents} /> : null}

      {activeTab === "integrations" ? <IntegrationPanel config={config} /> : null}
    </section>
  );
}

function TicketFormPanel({ ticketForm, assets, onFieldChange, onSubmit }) {
  return (
    <section className="panel it-form-panel">
      <div className="panel__header">
        <div>
          <h3>Raise Hardware Ticket</h3>
          <p>Select a ticket type, describe the need, and submit it to the IT team with HR copied through the email service.</p>
        </div>
      </div>

      <form className="it-ticket-form" onSubmit={onSubmit}>
        <label>
          <span>Ticket Type</span>
          <select value={ticketForm.ticketType} onChange={(event) => onFieldChange("ticketType", event.target.value)}>
            {[
              "New Hardware Request",
              "Hardware Issued",
              "Hardware Return",
              "Repair Request",
              "Replacement Request",
              "Lost/Damaged Hardware",
              "Warranty Service",
            ].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Hardware Category</span>
          <select value={ticketForm.hardwareCategory} onChange={(event) => onFieldChange("hardwareCategory", event.target.value)}>
            {IT_HARDWARE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select value={ticketForm.priority} onChange={(event) => onFieldChange("priority", event.target.value)}>
            {IT_PRIORITY_OPTIONS.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Needed By</span>
          <input type="date" value={ticketForm.neededBy} onChange={(event) => onFieldChange("neededBy", event.target.value)} />
        </label>
        <label>
          <span>Known Asset</span>
          <select value={ticketForm.assetId} onChange={(event) => onFieldChange("assetId", event.target.value)}>
            <option value="">Not applicable / IT to assign</option>
            {assets.map((asset) => (
              <option key={asset.assetId} value={asset.assetId}>
                {asset.assetTag} - {asset.category} - {asset.status}
              </option>
            ))}
          </select>
        </label>
        <label className="it-ticket-form__wide">
          <span>Subject</span>
          <input
            type="text"
            value={ticketForm.subject}
            onChange={(event) => onFieldChange("subject", event.target.value)}
            placeholder="Short hardware request summary"
          />
        </label>
        <label className="it-ticket-form__wide">
          <span>Description</span>
          <textarea
            value={ticketForm.description}
            onChange={(event) => onFieldChange("description", event.target.value)}
            placeholder="Describe the issue, hardware need, or return details"
            rows={4}
          />
        </label>
        <label className="it-ticket-form__wide">
          <span>Business Justification</span>
          <textarea
            value={ticketForm.businessJustification}
            onChange={(event) => onFieldChange("businessJustification", event.target.value)}
            placeholder="Why this hardware is required"
            rows={3}
          />
        </label>
        <div className="it-ticket-form__actions">
          <button type="submit" className="primary-button">
            Raise Ticket
          </button>
        </div>
      </form>
    </section>
  );
}

function TicketQueuePanel({ tickets, assets, canManage, currentRole, onTicketUpdate }) {
  return (
    <section className="panel it-ticket-panel">
      <div className="panel__header">
        <div>
          <h3>{canManage ? "IT Ticket Queue" : "My Hardware Tickets"}</h3>
          <p>
            {canManage
              ? "IT and Admin roles can assign assets, update workflow status, reject, resolve, and close tickets."
              : "Employee role is scoped to tickets raised with the logged-in office email."}
          </p>
        </div>
        <div className="workflow-panel__role">
          <strong>{tickets.length} Tickets</strong>
          <span>{currentRole} role scope</span>
        </div>
      </div>

      {tickets.length ? (
        <div className="table-scroll">
          <table className="data-table it-ticket-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Asset</th>
                <th>Updated</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => {
                const displayStatus = getTicketDisplayStatus(ticket);

                return (
                  <tr key={ticket.ticketNumber}>
                    <td>
                      <div className="store-cell">
                        <strong>{ticket.ticketNumber}</strong>
                        <span>{ticket.priority} priority</span>
                      </div>
                    </td>
                    <td>
                      <div className="store-cell">
                        <strong>{ticket.employeeName}</strong>
                        <span>{ticket.department}</span>
                      </div>
                    </td>
                    <td>{ticket.ticketType}</td>
                    <td>
                      <div className="it-ticket-subject">
                        <strong>{ticket.subject}</strong>
                        <span>{ticket.description}</span>
                      </div>
                    </td>
                    <td>
                      {canManage ? (
                        <select
                          className="workflow-stage-select"
                          value={ticket.status}
                          onChange={(event) => onTicketUpdate(ticket, { status: event.target.value })}
                        >
                          {getNextStatuses(ticket.status).map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={displayStatus} />
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <select
                          className="workflow-stage-select"
                          value={ticket.assetId || ""}
                          onChange={(event) => onTicketUpdate(ticket, { assetId: event.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {assets.map((asset) => (
                            <option key={asset.assetId} value={asset.assetId}>
                              {asset.assetTag} - {asset.status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        ticket.assetId || "IT to assign"
                      )}
                    </td>
                    <td>{formatDateTime(ticket.updatedAt || ticket.createdAt)}</td>
                    <td>
                      {canManage ? (
                        <div className="it-ticket-actions">
                          <input
                            type="text"
                            defaultValue={ticket.resolutionNote || ""}
                            placeholder="Resolution note"
                            onBlur={(event) => {
                              if (event.target.value !== (ticket.resolutionNote || "")) {
                                onTicketUpdate(ticket, { resolutionNote: event.target.value });
                              }
                            }}
                          />
                          <button type="button" className="primary-button" onClick={() => onTicketUpdate(ticket, { status: "Closed" })}>
                            Resolve & Close
                          </button>
                          <button type="button" className="ghost-button" onClick={() => onTicketUpdate(ticket, { status: "Rejected" })}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="it-readonly-note">{ticket.resolutionNote || "Waiting for IT update"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <strong>No hardware tickets in this role scope.</strong>
          <p>Raise a ticket from the first tab and it will appear here immediately.</p>
        </div>
      )}
    </section>
  );
}

function AssetInventoryPanel({ assets, employees, summary, canManage, assetForm, onAssetFieldChange, onAddAsset }) {
  return (
    <section className="panel it-asset-panel">
      <div className="panel__header">
        <div>
          <h3>Asset Inventory</h3>
          <p>Track asset allocation, warranty, repair, return, and availability from the same hardware module.</p>
        </div>
        <div className="it-inventory-summary">
          <span>Total: {summary.total}</span>
          <span>Available: {summary.available}</span>
          <span>Assigned: {summary.assigned}</span>
          <span>Service: {summary.service}</span>
        </div>
      </div>

      {canManage ? (
        <form className="it-asset-form" onSubmit={onAddAsset}>
          <input
            type="text"
            value={assetForm.assetTag}
            onChange={(event) => onAssetFieldChange("assetTag", event.target.value)}
            placeholder="Asset tag"
          />
          <select value={assetForm.category} onChange={(event) => onAssetFieldChange("category", event.target.value)}>
            {IT_HARDWARE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <input type="text" value={assetForm.brand} onChange={(event) => onAssetFieldChange("brand", event.target.value)} placeholder="Brand" />
          <input type="text" value={assetForm.model} onChange={(event) => onAssetFieldChange("model", event.target.value)} placeholder="Model" />
          <select value={assetForm.status} onChange={(event) => onAssetFieldChange("status", event.target.value)}>
            {IT_ASSET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <select value={assetForm.assignedToEmail} onChange={(event) => onAssetFieldChange("assignedToEmail", event.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((employee) => (
              <option key={employee.email} value={employee.email}>
                {employee.fullName}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-button">
            Add Asset
          </button>
        </form>
      ) : null}

      <div className="table-scroll">
        <table className="data-table it-asset-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Category</th>
              <th>Model</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Warranty</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.assetId}>
                <td>
                  <div className="store-cell">
                    <strong>{asset.assetTag}</strong>
                    <span>{asset.serialNumber}</span>
                  </div>
                </td>
                <td>{asset.category}</td>
                <td>
                  {asset.brand} {asset.model}
                </td>
                <td>
                  <StatusBadge status={asset.status} />
                </td>
                <td>{asset.assignedToEmail || "Available"}</td>
                <td>{asset.warrantyEnd || "Not captured"}</td>
                <td>{asset.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmployeeImportPanel({ employees, canAdminister, csvImportMessage, onCsvImport }) {
  return (
    <section className="panel it-employee-panel">
      <div className="panel__header">
        <div>
          <h3>Employee Directory & CSV Import</h3>
          <p>Import demo or HRMS-exported employee rows with employee_id, full_name, email, department, designation, role, and manager_email.</p>
        </div>
        <label className={`it-file-button ${canAdminister ? "" : "is-disabled"}`}>
          Import CSV
          <input type="file" accept=".csv,text/csv" disabled={!canAdminister} onChange={onCsvImport} />
        </label>
      </div>
      {csvImportMessage ? <p className="it-import-message">{csvImportMessage}</p> : null}
      <div className="table-scroll">
        <table className="data-table it-employee-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Email</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Role</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.email}>
                <td>
                  <div className="store-cell">
                    <strong>{employee.fullName}</strong>
                    <span>{employee.employeeId}</span>
                  </div>
                </td>
                <td>{employee.email}</td>
                <td>{employee.department}</td>
                <td>{employee.designation}</td>
                <td>{employee.role}</td>
                <td>{employee.officeLocation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReportsPanel({ statusGroups, typeGroups, departmentGroups, emailEvents }) {
  return (
    <section className="panel it-report-panel">
      <div className="panel__header">
        <div>
          <h3>Hardware Reports</h3>
          <p>Operational summaries for ticket workflow, demand type, department ownership, and notification queue health.</p>
        </div>
      </div>
      <div className="it-report-grid">
        <ReportList title="Status Workflow" items={statusGroups} />
        <ReportList title="Ticket Types" items={typeGroups} />
        <ReportList title="Departments" items={departmentGroups} />
        <ReportList title="Email Notifications" items={groupTicketsByField(emailEvents, "eventType")} />
      </div>
    </section>
  );
}

function ReportList({ title, items }) {
  return (
    <article className="it-report-card">
      <h4>{title}</h4>
      {items.length ? (
        items.map((item) => (
          <span key={item.label}>
            <b>{item.label}</b>
            {item.count}
          </span>
        ))
      ) : (
        <p>No records yet</p>
      )}
    </article>
  );
}

function AuditPanel({ auditLogs, emailEvents }) {
  return (
    <section className="panel it-audit-panel">
      <div className="panel__header">
        <div>
          <h3>Audit Logs & Email Trail</h3>
          <p>Every ticket action and notification event is captured for IT and Admin review.</p>
        </div>
      </div>
      <div className="it-audit-grid">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Ticket</th>
                <th>Actor</th>
                <th>Details</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.auditId}>
                  <td>{log.action}</td>
                  <td>{log.ticketNumber}</td>
                  <td>{log.actorEmail}</td>
                  <td>{log.details}</td>
                  <td>{formatDateTime(log.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="it-email-trail">
          {emailEvents.map((event) => (
            <article key={event.emailId}>
              <strong>{event.eventType}</strong>
              <span>{event.ticketNumber}</span>
              <p>
                To: {event.toLabel} | CC: {event.ccLabel}
              </p>
              <small>{event.status} - {formatDateTime(event.createdAt)}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function IntegrationPanel({ config }) {
  return (
    <section className="panel it-integration-panel">
      <div className="panel__header">
        <div>
          <h3>Integrations & Email Configuration</h3>
          <p>Email recipients are resolved from environment variables, and directory integrations are ready for adapter wiring later.</p>
        </div>
      </div>
      <EnvironmentKeyList config={config} />
      <div className="it-integration-grid">
        {IT_INTEGRATION_ADAPTERS.map((adapter) => (
          <article key={adapter.id}>
            <span>{adapter.status}</span>
            <strong>{adapter.name}</strong>
            <p>{adapter.purpose}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function upsertByKey(rows, item, key) {
  const itemValue = normalizeLookupValue(item[key]);
  const nextRows = rows.filter((row) => normalizeLookupValue(row[key]) !== itemValue);
  return [item, ...nextRows];
}

function mergeByKey(rows, incomingRows, key) {
  return incomingRows.reduce((merged, row) => upsertByKey(merged, row, key), rows);
}

function normalizeLookupValue(value) {
  return String(value || "").trim().toLowerCase();
}

function formatDateTime(value) {
  if (!value) {
    return "Not updated";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
