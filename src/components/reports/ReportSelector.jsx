import { ReportExportMenu } from "./ReportExportMenu";

export function ReportSelector({ reports, selectedReportId, selectedReport, onReportChange, onExport, exportDisabled = false }) {
  return (
    <section className="panel reports-launcher">
      <div className="reports-launcher__main">
        <div>
          <p className="eyebrow">Pivot Reports Module</p>
          <h3>Pivot Builder</h3>
          <p>
            Pick a report type, then drag fields into Filters, Columns, Rows, and Values just like an Excel pivot
            workspace. The center preview and exports update from that layout.
          </p>
        </div>

        <div className="reports-launcher__controls">
          <label className="report-selector-field">
            <span>Report Type</span>
            <select value={selectedReportId} onChange={(event) => onReportChange(event.target.value)}>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.name}
                </option>
              ))}
            </select>
          </label>

          <ReportExportMenu options={selectedReport?.exportOptions || []} onExport={onExport} disabled={exportDisabled} />
        </div>
      </div>

      {selectedReport ? (
        <div className="filter-summary">
          <span className="filter-chip">
            <b>Selected</b>
            {selectedReport.name}
          </span>
          <span className="filter-chip">
            <b>Fields</b>
            {selectedReport.fields.length} available columns
          </span>
          <span className="filter-chip">
            <b>Source</b>
            {selectedReport.sourceLabel || "Data Sync"}
          </span>
          <span className="filter-chip">
            <b>Rows</b>
            {selectedReport.rows.length}
          </span>
          <span className="filter-chip">
            <b>Exports</b>
            {selectedReport.exportOptions.join(", ").toUpperCase()}
          </span>
        </div>
      ) : null}
    </section>
  );
}
