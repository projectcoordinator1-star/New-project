export function DataSyncExplainer() {
  return (
    <section className="report-insight-grid">
      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Master-Data-First Flow</h3>
            <p>Start by locking your store master from the allocation workbook, then layer reports on top only when needed.</p>
          </div>
        </div>
        <div className="metric-list">
          <div className="metric-list__row">
            <span>1. Load Store Allocation</span>
            <strong>Required</strong>
          </div>
          <div className="metric-list__row">
            <span>2. Build Store Master</span>
            <strong>Quick path</strong>
          </div>
          <div className="metric-list__row">
            <span>3. Review Stores page</span>
            <strong>Initial output</strong>
          </div>
          <div className="metric-list__row">
            <span>4. Load Attendance Raw</span>
            <strong>Optional next step</strong>
          </div>
          <div className="metric-list__row">
            <span>5. Add other sources later</span>
            <strong>Optional</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Optional Expansion</h3>
            <p>Once attendance is stable, these uploads can turn on the other report tabs. The IFMS Dashboard workbook can now be built on its own for report demos.</p>
          </div>
        </div>
        <div className="metric-list">
          <div className="metric-list__row">
            <span>Overall Pending</span>
            <strong>Fault / OL fallback</strong>
          </div>
          <div className="metric-list__row">
            <span>IFMS Dashboard</span>
            <strong>Multi-report workbook</strong>
          </div>
          <div className="metric-list__row">
            <span>M-here BASE</span>
            <strong>Attendance Fallback</strong>
          </div>
          <div className="metric-list__row">
            <span>Split Server / CMPM / Thermography / Cleaning / Vacancy</span>
            <strong>Advanced reports</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <div>
            <h3>Why Not MySQL Yet</h3>
            <p>For the next demo, UI credibility matters more than infrastructure setup.</p>
          </div>
        </div>
        <div className="metric-list">
          <div className="metric-list__row">
            <span>React app today</span>
            <strong>Ready</strong>
          </div>
          <div className="metric-list__row">
            <span>MySQL alone</span>
            <strong>Not enough</strong>
          </div>
          <div className="metric-list__row">
            <span>Backend/API also needed</span>
            <strong>Yes</strong>
          </div>
          <div className="metric-list__row">
            <span>Recommended next phase</span>
            <strong>Spring Boot + MySQL</strong>
          </div>
        </div>
      </section>
    </section>
  );
}
