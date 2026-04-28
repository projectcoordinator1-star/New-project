import { useEffect, useMemo, useState, useTransition } from "react";
import { exportReport } from "../../utils/reportExports";
import {
  buildPivotPreview,
  buildPivotReportCatalog,
  countActivePivotFilters,
  getFieldOptionsForFilter,
  getLayoutFieldIds,
  moveFieldToZone,
  removeFieldFromLayout,
} from "../../utils/pivotReports";
import { PivotFieldLibrary } from "./PivotFieldLibrary";
import { PivotPreviewPanel } from "./PivotPreviewPanel";
import { PivotShelfBoard } from "./PivotShelfBoard";
import { ReportSelector } from "./ReportSelector";

export function ReportsWorkspace({ dataSource, month }) {
  const reportCatalog = useMemo(() => buildPivotReportCatalog(dataSource, month), [dataSource, month]);
  const [selectedReportId, setSelectedReportId] = useState(reportCatalog[0]?.id || "");
  const [layout, setLayout] = useState({ filters: [], rows: [], columns: [], values: [] });
  const [filterValues, setFilterValues] = useState({});
  const [reportResult, setReportResult] = useState(null);
  const [isPending, startTransition] = useTransition();

  const selectedReport = useMemo(
    () => reportCatalog.find((report) => report.id === selectedReportId) || reportCatalog[0] || null,
    [reportCatalog, selectedReportId],
  );

  useEffect(() => {
    if (reportCatalog.length && !reportCatalog.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(reportCatalog[0].id);
    }
  }, [reportCatalog, selectedReportId]);

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    setLayout(selectedReport.defaultLayout);
    setFilterValues(selectedReport.defaultFilterValues);
    startTransition(() => {
      setReportResult(buildPivotPreview(selectedReport, selectedReport.defaultLayout, selectedReport.defaultFilterValues));
    });
  }, [selectedReport, month]);

  const activeFilterCount = useMemo(
    () => countActivePivotFilters(layout, filterValues),
    [layout, filterValues],
  );

  const layoutByField = useMemo(
    () =>
      Object.fromEntries(
        getLayoutFieldIds(layout).map((fieldId) => [
          fieldId,
          ["filters", "rows", "columns", "values"].find((zoneId) => layout[zoneId].includes(fieldId)),
        ]),
      ),
    [layout],
  );

  const assignedFieldIds = useMemo(() => getLayoutFieldIds(layout), [layout]);

  const runPreview = (nextLayout, nextFilters) => {
    if (!selectedReport) {
      return;
    }

    startTransition(() => {
      setReportResult(buildPivotPreview(selectedReport, nextLayout, nextFilters));
    });
  };

  const handleMoveField = (fieldId, zoneId) => {
    if (!selectedReport) {
      return;
    }

    const nextLayout = moveFieldToZone(layout, fieldId, zoneId, selectedReport.fieldMap);
    setLayout(nextLayout);

    const nextFilters = { ...filterValues };
    if (zoneId === "filters" && !Object.prototype.hasOwnProperty.call(nextFilters, fieldId)) {
      nextFilters[fieldId] = "All";
      setFilterValues(nextFilters);
    }

    if (zoneId !== "filters" && Object.prototype.hasOwnProperty.call(nextFilters, fieldId)) {
      delete nextFilters[fieldId];
      setFilterValues(nextFilters);
    }

    runPreview(nextLayout, nextFilters);
  };

  const handleRemoveField = (fieldId) => {
    const nextLayout = removeFieldFromLayout(layout, fieldId);
    const nextFilters = { ...filterValues };
    delete nextFilters[fieldId];
    setLayout(nextLayout);
    setFilterValues(nextFilters);
    runPreview(nextLayout, nextFilters);
  };

  const handleResetLayout = () => {
    if (!selectedReport) {
      return;
    }

    setLayout(selectedReport.defaultLayout);
    setFilterValues(selectedReport.defaultFilterValues);
    runPreview(selectedReport.defaultLayout, selectedReport.defaultFilterValues);
  };

  const handleFilterValueChange = (fieldId, value) => {
    const nextFilters = { ...filterValues, [fieldId]: value };
    setFilterValues(nextFilters);
    runPreview(layout, nextFilters);
  };

  const handleExport = (format) => {
    exportReport(reportResult, format);
  };

  const handleDragStart = (event, fieldId) => {
    event.dataTransfer.setData("text/plain", fieldId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleFieldDrop = (event, zoneId) => {
    event.preventDefault();
    const fieldId = event.dataTransfer.getData("text/plain");
    if (fieldId) {
      handleMoveField(fieldId, zoneId);
    }
  };

  return (
    <div className="reports-workspace">
      <ReportSelector
        reports={reportCatalog}
        selectedReportId={selectedReportId}
        selectedReport={selectedReport}
        onReportChange={setSelectedReportId}
        onExport={handleExport}
        exportDisabled={!reportResult}
      />

      <div className="reports-layout">
        <PivotFieldLibrary
          report={selectedReport}
          assignedFieldIds={assignedFieldIds}
          layoutByField={layoutByField}
          onMoveField={handleMoveField}
          onDragStart={handleDragStart}
        />

        <div className="reports-builder-stack">
          <PivotShelfBoard
            report={selectedReport}
            layout={layout}
            filterValues={filterValues}
            onFilterValueChange={handleFilterValueChange}
            onFieldDrop={handleFieldDrop}
            onRemoveField={handleRemoveField}
            onResetLayout={handleResetLayout}
            getFilterOptions={(fieldId) => getFieldOptionsForFilter(selectedReport, fieldId)}
          />

          {isPending ? <div className="panel"><div className="empty-state"><strong>Updating pivot preview...</strong><p>The new layout is being recalculated.</p></div></div> : null}

          <PivotPreviewPanel result={reportResult} layout={layout} activeFilterCount={activeFilterCount} />
        </div>
      </div>
    </div>
  );
}
