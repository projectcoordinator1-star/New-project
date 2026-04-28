import { formatDisplayValue } from "../utils/formatters";

function InfoPanel({ title, subtitle, children }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyPanel({ title, subtitle }) {
  return (
    <InfoPanel title={title} subtitle={subtitle}>
      <div className="empty-state">
        <strong>This report will populate once its source data is loaded.</strong>
        <p>The layout is ready, and we can connect the real workbook whenever you have it.</p>
      </div>
    </InfoPanel>
  );
}

function MetricList({ items, suffix = "" }) {
  return (
    <div className="metric-list">
      {items.map((item) => (
        <div key={item.label} className="metric-list__row">
          <span>{item.label}</span>
          <strong>
            {formatDisplayValue(item.value)}
            {suffix}
          </strong>
        </div>
      ))}
    </div>
  );
}

function CompactTable({ columns, rows }) {
  return (
    <div className="table-scroll">
      <table className="data-table compact-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${row[columns[0].key]}`}>
              {columns.map((column) => (
                <td key={column.key}>{formatDisplayValue(row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function groupAndSort(items, labelFn, valueFn) {
  const map = new Map();

  items.forEach((item) => {
    const label = labelFn(item);
    const value = valueFn(item);
    map.set(label, (map.get(label) || 0) + value);
  });

  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value);
}

function renderFaultInsights(_rows, workflowRows) {
  const monthJobs = workflowRows;
  const stageMix = groupAndSort(
    monthJobs,
    (item) => item.workflowStage || "Unknown",
    () => 1,
  ).slice(0, 8);
  const categoryMix = groupAndSort(monthJobs, (item) => item.category || "Unknown", () => 1).slice(0, 8);

  return (
    <section className="report-insight-grid">
      <InfoPanel title="Lifecycle Stage Mix" subtitle="Current jobs split by PO / execution / documentation stage">
        {stageMix.length ? (
          <MetricList items={stageMix} />
        ) : (
          <div className="empty-state">
            <strong>No lifecycle jobs for this month.</strong>
            <p>Load the overall pending file to activate the lifecycle tracker.</p>
          </div>
        )}
      </InfoPanel>

      <InfoPanel title="Issue Category Mix" subtitle="Most common categories from in-scope lifecycle jobs">
        {categoryMix.length ? (
          <MetricList items={categoryMix} />
        ) : (
          <div className="empty-state">
            <strong>No job categories available.</strong>
            <p>Upload the overall pending source to activate this panel.</p>
          </div>
        )}
      </InfoPanel>
    </section>
  );
}

function renderOlInsights(rows, dataSource, month, workflowRows) {
  const sourceRows = dataSource.olTickets?.length ? dataSource.olTickets : dataSource.pendingTickets || [];
  const monthJobs = sourceRows.filter((item) => item.month === month);
  const visibleJobs = monthJobs.filter((job) => workflowRows.some((row) => row.ticketNumber === job.ticketNumber));
  const commercialStages = visibleJobs.filter((item) =>
    [
      "AFM Pending",
      "Certification done- Document shared to Commercial for JMS",
      "JMS In progress",
      "Invoice Processed",
      "Payment Received From client",
    ].includes(item.workflowStage),
  );
  const stageMix = groupAndSort(commercialStages, (item) => item.workflowStage, () => 1).slice(0, 8);
  const breachedByState = groupAndSort(visibleJobs.filter((item) => item.isOverdue), (item) => item.state || item.region || "Unknown", () => 1).slice(0, 8);

  return (
    <section className="report-insight-grid">
      <InfoPanel title="Commercial Stage Load" subtitle="Jobs in AFM, JMS, invoice, and payment stages">
        {stageMix.length ? (
          <MetricList items={stageMix} />
        ) : (
          <div className="empty-state">
            <strong>No commercial-stage jobs yet.</strong>
            <p>The tracker will populate here once jobs move further in the lifecycle.</p>
          </div>
        )}
      </InfoPanel>

      <InfoPanel title="Breached Ticket Load" subtitle="In-scope overdue items by state">
        {breachedByState.length ? (
          <MetricList items={breachedByState} />
        ) : (
          <div className="empty-state">
            <strong>No breached tickets found.</strong>
            <p>This panel updates from the overall pending source.</p>
          </div>
        )}
      </InfoPanel>
    </section>
  );
}

function renderThermographyInsights(rows) {
  const filtered = rows.filter((row) => row.thermography);
  if (!filtered.length) {
    return (
      <section className="report-insight-grid">
        <EmptyPanel title="Inspection Coverage" subtitle="Thermography workbook not loaded yet" />
        <EmptyPanel title="Pending Sites" subtitle="Oldest pending thermography stores will appear here" />
      </section>
    );
  }

  const byRegion = groupAndSort(
    filtered.filter((row) => row.thermography?.status === "Not Inspected"),
    (row) => row.region || "Unknown",
    () => 1,
  );
  const oldest = filtered
    .filter((row) => row.thermography?.status === "Not Inspected")
    .sort((left, right) => safeNumber(right.thermography?.daysPending) - safeNumber(left.thermography?.daysPending))
    .slice(0, 8)
    .map((row) => ({
      store: row.storeName,
      state: row.region,
      days: row.thermography?.daysPending ?? 0,
    }));

  return (
    <section className="report-insight-grid">
      <InfoPanel title="Inspection Gaps by Region" subtitle="Not inspected sites grouped by region">
        <MetricList items={byRegion} />
      </InfoPanel>
      <InfoPanel title="Oldest Pending Stores" subtitle="Thermography backlog by age">
        <CompactTable
          columns={[
            { key: "store", label: "Store" },
            { key: "state", label: "State" },
            { key: "days", label: "Days Pending" },
          ]}
          rows={oldest}
        />
      </InfoPanel>
    </section>
  );
}

function renderManpowerInsights(rows) {
  const filtered = rows.filter((row) => row.manpower);
  if (!filtered.length) {
    return (
      <section className="report-insight-grid">
        <EmptyPanel title="Shortage by Region" subtitle="Manpower workbook not loaded yet" />
        <EmptyPanel title="Top Gap Stores" subtitle="Largest shortages will appear here" />
      </section>
    );
  }

  const gapByRegion = groupAndSort(
    filtered,
    (row) => row.region || "Unknown",
    (row) => Math.abs(Math.min(safeNumber(row.manpower?.variance), 0)),
  );
  const topGaps = filtered
    .sort((left, right) => safeNumber(left.manpower?.variance) - safeNumber(right.manpower?.variance))
    .slice(0, 8)
    .map((row) => ({
      store: row.storeName,
      state: row.region,
      gap: Math.abs(Math.min(safeNumber(row.manpower?.variance), 0)),
    }));

  return (
    <section className="report-insight-grid">
      <InfoPanel title="Shortage by Region" subtitle="Aggregate manpower gaps">
        <MetricList items={gapByRegion} />
      </InfoPanel>
      <InfoPanel title="Top Gap Stores" subtitle="Highest-priority manpower shortages">
        <CompactTable
          columns={[
            { key: "store", label: "Store" },
            { key: "state", label: "State" },
            { key: "gap", label: "Gap" },
          ]}
          rows={topGaps}
        />
      </InfoPanel>
    </section>
  );
}

function renderCleaningInsights(rows) {
  const filtered = rows.filter((row) => row.cleaning);
  if (!filtered.length) {
    return (
      <section className="report-insight-grid">
        <EmptyPanel title="Pending Cleaning Load" subtitle="Cleaning workbook not loaded yet" />
        <EmptyPanel title="Completion by Region" subtitle="This page will become active once cleaning data is available" />
      </section>
    );
  }

  const pendingStores = filtered
    .filter((row) => safeNumber(row.cleaning?.pending) > 0)
    .sort((left, right) => safeNumber(right.cleaning?.pending) - safeNumber(left.cleaning?.pending))
    .slice(0, 8)
    .map((row) => ({
      store: row.storeName,
      state: row.region,
      pending: row.cleaning?.pending ?? 0,
    }));

  const completionByRegion = groupAndSort(
    filtered,
    (row) => row.region || "Unknown",
    (row) => safeNumber(row.cleaning?.completed),
  );

  return (
    <section className="report-insight-grid">
      <InfoPanel title="Pending Cleaning Stores" subtitle="Follow-up priority list">
        <CompactTable
          columns={[
            { key: "store", label: "Store" },
            { key: "state", label: "State" },
            { key: "pending", label: "Pending" },
          ]}
          rows={pendingStores}
        />
      </InfoPanel>
      <InfoPanel title="Completion by Region" subtitle="Completed deep-cleaning jobs">
        <MetricList items={completionByRegion} />
      </InfoPanel>
    </section>
  );
}

function renderStoreInsights(rows) {
  const regionMix = groupAndSort(rows, (row) => row.region || "Unknown", () => 1);
  const latest = [...rows]
    .sort((left, right) => String(right.openedDate || "").localeCompare(String(left.openedDate || "")))
    .slice(0, 8)
    .map((row) => ({
      store: row.storeName,
      state: row.region,
      opened: row.openedDate || "--",
    }));

  return (
    <section className="report-insight-grid">
      <InfoPanel title="Region Footprint" subtitle="Current visible stores by region">
        <MetricList items={regionMix} />
      </InfoPanel>
      <InfoPanel title="Recently Launched Stores" subtitle="Latest stores from master data">
        <CompactTable
          columns={[
            { key: "store", label: "Store" },
            { key: "state", label: "State" },
            { key: "opened", label: "Opened" },
          ]}
          rows={latest}
        />
      </InfoPanel>
    </section>
  );
}

export function ReportInsights({ activeView, rows, dataSource, month, workflowRows = [] }) {
  if (activeView === "faults") {
    return renderFaultInsights(rows, workflowRows);
  }

  if (activeView === "ol") {
    return renderOlInsights(rows, dataSource, month, workflowRows);
  }

  if (activeView === "thermography") {
    return renderThermographyInsights(rows);
  }

  if (activeView === "manpower") {
    return renderManpowerInsights(rows);
  }

  if (activeView === "cleaning") {
    return renderCleaningInsights(rows);
  }

  if (activeView === "stores") {
    return renderStoreInsights(rows);
  }

  return null;
}
