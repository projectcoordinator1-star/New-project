function FileSlot({ label, fileName, onChange, disabled }) {
  return (
    <label className="upload-button upload-button--wide">
      <span>{label}</span>
      <strong>{fileName || "Choose file"}</strong>
      <input type="file" accept=".xlsx,.xls,.csv" onChange={onChange} disabled={disabled} />
    </label>
  );
}

function buildLoadedMetricText(items) {
  const activeItems = items.filter((item) => item.value > 0);

  if (!activeItems.length) {
    return "No uploaded report data yet.";
  }

  return activeItems.map((item) => `${item.label} ${item.value}`).join(" | ");
}

function getReconciliationRows(summary, bootstrapCounts = {}) {
  const definitions = [
    { label: "Stores", app: summary.stores, db: bootstrapCounts.stores },
    { label: "Attendance Raw", app: summary.attendanceDaily, db: bootstrapCounts.attendanceRows },
    { label: "Fault Tickets", app: summary.faultTickets, db: bootstrapCounts.faults },
    { label: "OL Line Items", app: summary.ol, db: bootstrapCounts.olItems },
    { label: "Thermography", app: summary.thermography, db: bootstrapCounts.thermographyRows },
    { label: "Deep Cleaning", app: summary.cleaning, db: bootstrapCounts.deepCleaningRows },
    { label: "Manpower", app: summary.manpower, db: bootstrapCounts.manpowerRows },
    { label: "CMPM", app: summary.cmpm, db: bootstrapCounts.cmpmRows },
  ];

  return definitions.map((item) => {
    const appCount = Number.isFinite(item.app) ? item.app : 0;
    const dbCount = Number.isFinite(item.db) ? item.db : 0;
    const delta = appCount - dbCount;
    const baseline = Math.max(1, dbCount);
    const deltaPct = Math.round((Math.abs(delta) / baseline) * 100);

    return {
      ...item,
      appCount,
      dbCount,
      delta,
      deltaPct,
      status: delta === 0 ? "ok" : deltaPct <= 3 ? "warn" : "error",
    };
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

const workbookRoutes = [
  {
    sheet: "Split Server",
    report: "OL Report",
    note: "Builds the commercial workflow tracker and OL ageing view.",
  },
  {
    sheet: "Fault Report",
    report: "Fault Report",
    note: "Feeds fault KPIs, tracker rows, and delayed fault visibility.",
  },
  {
    sheet: "M-here BASE",
    report: "Attendance",
    note: "Acts as the attendance fallback when the raw client export is not loaded.",
  },
  {
    sheet: "Thermography",
    report: "Thermography",
    note: "Maps inspection schedule, completion, and pending-site status.",
  },
  {
    sheet: "Deep cleaning Activity",
    report: "Deep Cleaning",
    note: "Creates cleaning completion and pending follow-up counts by store.",
  },
  {
    sheet: "Manpower Vacancy",
    report: "Manpower",
    note: "Calculates required vs deployed manpower using vacancy counts.",
  },
  {
    sheet: "CMPM",
    report: "CMPM Report",
    note: "Maps CM task and PM status by store for the reports pivot builder.",
  },
];

export function DataSourcePanel({
  dataInfo,
  summary,
  workflowFiles,
  onWorkflowFileChange,
  onProcessWorkflow,
  onSyncRawDatabase,
  onUseDemoData,
  isUploading,
  isSyncingDatabase,
  canProcessWorkflow,
  databaseSyncInfo,
}) {
  const stats = dataInfo.stats || {};
  const hasAllocation = Boolean(workflowFiles.allocation);
  const hasAttendance = Boolean(workflowFiles.attendance);
  const hasPending = Boolean(workflowFiles.pending);
  const hasDashboard = Boolean(workflowFiles.dashboard);
  const canSyncRawDatabase = (hasAllocation || hasAttendance || hasPending || hasDashboard) && !isSyncingDatabase;
  const canBuildMaster = hasAllocation && !isUploading;
  const canBuildAttendance = hasAllocation && hasAttendance && !isUploading;
  const canBuildSelected = canProcessWorkflow && !isUploading;
  const showWorkbookRoutes = hasDashboard || Boolean(dataInfo.sources?.dashboardFile);
  const loadedRecordsText = buildLoadedMetricText([
    { label: "Attendance", value: summary.attendance },
    { label: "Faults", value: summary.faults },
    { label: "OL", value: summary.ol },
    { label: "Thermography", value: summary.thermography },
    { label: "Manpower", value: summary.manpower },
    { label: "Cleaning", value: summary.cleaning },
    { label: "CMPM", value: summary.cmpm },
  ]);
  const importedMetricsText = buildLoadedMetricText([
    { label: "Attendance rows", value: stats.attendanceImported || 0 },
    { label: "Fault tickets", value: stats.faultTickets || 0 },
    { label: "OL tickets", value: stats.olTickets || 0 },
    { label: "CMPM rows", value: stats.cmpm || 0 },
    { label: "Daily attendance", value: summary.attendanceDaily || 0 },
  ]);
  const reconciliationRows = getReconciliationRows(summary, dataInfo.bootstrap?.counts || {});
  const mismatchCount = reconciliationRows.filter((row) => row.delta !== 0).length;
  const severeMismatchCount = reconciliationRows.filter((row) => row.status === "error").length;
  const hasBootstrap = Boolean(dataInfo.bootstrap?.counts);
  const summarySnapshot = dataInfo.summarySnapshot;

  return (
    <section className="panel data-source-panel">
      <div className="panel__header">
        <div>
          <h3>Data Source</h3>
          <p>
            Start with attendance only when that is your focus. Add the other report files later, instead of feeling
            like every dataset has to be uploaded together.
          </p>
        </div>
        <div className="panel__actions">
          <button type="button" className="ghost-button" onClick={onSyncRawDatabase} disabled={!canSyncRawDatabase}>
            {isSyncingDatabase ? "Syncing DB..." : "Sync Raw Files to DB"}
          </button>
          <button type="button" className="ghost-button" onClick={onUseDemoData}>
            Use Demo Data
          </button>
        </div>
      </div>

      {databaseSyncInfo?.message ? (
        <div className={`db-sync-status db-sync-status--${databaseSyncInfo.status}`}>
          <strong>PostgreSQL Raw Sync</strong>
          <p>{databaseSyncInfo.message}</p>
          {databaseSyncInfo.results?.length ? (
            <div className="sheet-status__list">
              {databaseSyncInfo.results.flatMap((result) =>
                result.sheets.map((sheet) => (
                  <span key={`${result.importBatchId}-${sheet.sheetName}`} className="sheet-pill sheet-pill--loaded">
                    {sheet.tableName}: {sheet.rows} rows
                  </span>
                )),
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasBootstrap ? (
        <section className="db-recon panel">
          <div className="panel__header">
            <div>
              <h3>Excel vs DB Reconciliation</h3>
              <p>Compares what the app currently loaded against DB view counts to quickly spot integration mismatches.</p>
            </div>
            <div className="filter-summary">
              <span className="filter-chip">
                <b>Mismatch Buckets</b>
                {mismatchCount}
              </span>
              <span className="filter-chip">
                <b>Critical</b>
                {severeMismatchCount}
              </span>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table compact-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>App Count</th>
                  <th>DB Count</th>
                  <th>Delta</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {reconciliationRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>{row.appCount}</td>
                    <td>{row.dbCount}</td>
                    <td>{row.delta === 0 ? "0" : `${row.delta > 0 ? "+" : ""}${row.delta} (${row.deltaPct}%)`}</td>
                    <td>
                      <span
                        className={`badge ${
                          row.status === "ok" ? "badge--green" : row.status === "warn" ? "badge--amber" : "badge--red"
                        }`}
                      >
                        {row.status === "ok" ? "Matched" : row.status === "warn" ? "Near Match" : "Mismatch"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {summarySnapshot ? (
        <section className="panel">
          <div className="panel__header">
            <div>
              <h3>Summary Sheet Snapshot</h3>
              <p>Presentation-ready totals captured directly from the `Summary` tab of your IFMS dashboard workbook.</p>
            </div>
          </div>
          <div className="report-summary-grid">
            <article className="report-summary-card report-summary-card--blue">
              <span>RP5 Grand Total</span>
              <strong>{formatCurrency(summarySnapshot.rp5Server.totalValue)}</strong>
              <p>{summarySnapshot.rp5Server.monthLabel || "Current month"}</p>
            </article>
            <article className="report-summary-card report-summary-card--green">
              <span>CM Completed</span>
              <strong>
                {summarySnapshot.cmStatus.completed}/{summarySnapshot.cmStatus.total}
              </strong>
              <p>{summarySnapshot.cmStatus.monthLabel || "Current month"}</p>
            </article>
            <article className="report-summary-card report-summary-card--amber">
              <span>PM Completion</span>
              <strong>
                {summarySnapshot.pmStatus.completed}/{summarySnapshot.pmStatus.total}
              </strong>
              <p>Pending {summarySnapshot.pmStatus.pending}</p>
            </article>
            <article className="report-summary-card report-summary-card--purple">
              <span>Attendance Cumulative</span>
              <strong>{(summarySnapshot.attendance.cumulativePct || 0).toFixed(1)}%</strong>
              <p>
                HK {summarySnapshot.attendance.hk} | MEPC {summarySnapshot.attendance.mepc}
              </p>
            </article>
            <article className="report-summary-card report-summary-card--red">
              <span>Thermography Completion</span>
              <strong>{Math.round((summarySnapshot.thermography.completionPct || 0) * 100)}%</strong>
              <p>
                {summarySnapshot.thermography.completed}/{summarySnapshot.thermography.scheduled} sites
              </p>
            </article>
            <article className="report-summary-card report-summary-card--blue">
              <span>Deep Cleaning Completion</span>
              <strong>{Math.round((summarySnapshot.deepCleaning.completionPct || 0) * 100)}%</strong>
              <p>
                {summarySnapshot.deepCleaning.completed}/{summarySnapshot.deepCleaning.scheduled} sites
              </p>
            </article>
            <article className="report-summary-card report-summary-card--green">
              <span>Training Status</span>
              <strong>
                {summarySnapshot.training.completed}/{summarySnapshot.training.total}
              </strong>
              <p>Pending {summarySnapshot.training.pending}</p>
            </article>
            <article className="report-summary-card report-summary-card--amber">
              <span>Technical Vacancies</span>
              <strong>{summarySnapshot.technicalVacancy.vacantTotal}</strong>
              <p>Open manpower positions</p>
            </article>
          </div>
        </section>
      ) : null}

      <div className="data-sync-sections">
        <section className="sync-workbench sync-workbench--primary">
          <div className="sync-workbench__header">
            <div>
              <p className="eyebrow">Master Data First</p>
              <h4>Store Master + Attendance</h4>
              <p>
                Start with the allocation workbook to create your initial in-scope store master. If attendance is also
                loaded, you can jump straight into the attendance report from the same block.
              </p>
            </div>
            <div className="sync-workbench__actions">
              <button
                type="button"
                className="ghost-button"
                onClick={() => onProcessWorkflow("stores")}
                disabled={!canBuildMaster}
              >
                {isUploading ? "Processing..." : "Build Store Master"}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => onProcessWorkflow("attendance")}
                disabled={!canBuildAttendance}
              >
                {isUploading ? "Processing..." : "Build Attendance Data"}
              </button>
            </div>
          </div>

          <div className="workflow-grid workflow-grid--compact">
            <FileSlot
              label="Store Allocation"
              fileName={workflowFiles.allocation?.name}
              onChange={(event) => onWorkflowFileChange("allocation", event.target.files?.[0] || null)}
              disabled={isUploading}
            />
            <FileSlot
              label="Attendance Raw"
              fileName={workflowFiles.attendance?.name}
              onChange={(event) => onWorkflowFileChange("attendance", event.target.files?.[0] || null)}
              disabled={isUploading}
            />
          </div>

          <div className="filter-summary">
            <span className="filter-chip">
              <b>Required</b>
              Store Allocation
            </span>
            <span className="filter-chip">
              <b>Optional</b>
              Attendance Raw
            </span>
            <span className="filter-chip">
              <b>Output</b>
              Store master or attendance page
            </span>
          </div>
        </section>

        <section className="sync-workbench">
          <div className="sync-workbench__header">
            <div>
              <p className="eyebrow">Optional Sources</p>
              <h4>Other Report Uploads</h4>
              <p>
                Upload the dashboard workbook here when you want the report tabs and pivot builder to show real data.
                Store Allocation is helpful, but no longer required for this block.
              </p>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => onProcessWorkflow("dashboard")}
              disabled={!canBuildSelected}
            >
              {isUploading ? "Processing..." : "Build Selected Files"}
            </button>
          </div>

          <div className="workflow-grid workflow-grid--compact">
            <FileSlot
              label="Overall Pending"
              fileName={workflowFiles.pending?.name}
              onChange={(event) => onWorkflowFileChange("pending", event.target.files?.[0] || null)}
              disabled={isUploading}
            />
            <FileSlot
              label="IFMS Dashboard"
              fileName={workflowFiles.dashboard?.name}
              onChange={(event) => onWorkflowFileChange("dashboard", event.target.files?.[0] || null)}
              disabled={isUploading}
            />
          </div>

          <div className="filter-summary">
            <span className="filter-chip">
              <b>Optional</b>
              Overall Pending
            </span>
            <span className="filter-chip">
              <b>Best For Demo</b>
              IFMS Dashboard
            </span>
            <span className="filter-chip">
              <b>Status</b>
              {canBuildSelected ? "Ready to build" : hasDashboard || hasPending ? "Add one more source or build now" : "Waiting for files"}
            </span>
          </div>

          {showWorkbookRoutes ? (
            <div className="source-map-grid">
              {workbookRoutes.map((route) => (
                <article key={route.sheet} className="source-map-card">
                  <span>{route.sheet}</span>
                  <strong>{route.report}</strong>
                  <p>{route.note}</p>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="data-source-grid">
        <div className="data-source-card">
          <span className="data-source-card__label">Current Source</span>
          <strong>{dataInfo.fileName}</strong>
          <p>
            {dataInfo.mode === "qpms"
              ? "Generated from the real QPMS workbook flow."
              : "Built-in prototype dataset for design and demo work."}
          </p>
        </div>

        <div className="data-source-card">
          <span className="data-source-card__label">Loaded Records</span>
          <strong>{summary.stores} stores</strong>
          <p>{loadedRecordsText}</p>
        </div>

        <div className="data-source-card">
          <span className="data-source-card__label">Imported Metrics</span>
          <strong>{stats.attendanceImported || 0} attendance rows</strong>
          <p>{importedMetricsText}</p>
        </div>
      </div>

      {dataInfo.loadedSheets?.length > 0 ? (
        <div className="sheet-status">
          <strong>Imported Sources</strong>
          <div className="sheet-status__list">
            {dataInfo.loadedSheets.map((sheet) => (
              <span key={sheet.key} className="sheet-pill sheet-pill--loaded">
                {sheet.key}: {sheet.sheetName} ({sheet.rows} rows)
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {dataInfo.missingSheets?.length > 0 ? (
        <div className="sheet-status">
          <strong>Optional Sources Not Loaded</strong>
          <div className="sheet-status__list">
            {dataInfo.missingSheets.map((sheet) => (
              <span key={sheet} className="sheet-pill sheet-pill--missing">
                {sheet}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {dataInfo.error ? <p className="upload-error">{dataInfo.error}</p> : null}
    </section>
  );
}
