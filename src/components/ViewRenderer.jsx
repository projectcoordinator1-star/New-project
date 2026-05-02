import { useMemo } from "react";
import { exportRowsToExcel, exportRowsToPdf } from "../utils/dashboard";
import { AttendanceSummaryPanel } from "./AttendanceSummaryPanel";
import { DataSyncExplainer } from "./DataSyncExplainer";
import { DeepCleaningImagePanel } from "./DeepCleaningImagePanel";
import { DetailedTable } from "./DetailedTable";
import { PivotTable } from "./PivotTable";
import { ReportChart } from "./ReportChart";
import { ReportInsights } from "./ReportInsights";
import { ReportsWorkspace } from "./reports/ReportsWorkspace";
import { StoreMasterWorkspace } from "./StoreMasterWorkspace";
import { TrendPanel } from "./TrendPanel";
import { WorkflowTrackerPanel } from "./WorkflowTrackerPanel";
import { PoRequestLab } from "./po/PoRequestLab";
import { TechnicalTrainingWorkspace } from "./TechnicalTrainingWorkspace";

export function ViewRenderer({
  activeFilters,
  activeView,
  attendanceAopOverrides,
  attendanceSummary,
  currentRole,
  dataSource,
  effectiveReportType,
  faultRemarks,
  filteredRows,
  groupBy,
  month,
  onAddStore,
  onAttendanceAopReset,
  onAttendanceAopSave,
  onAttendanceDateChange,
  onGroupChange,
  onRemarkChange,
  onStageChange,
  onStoreUpdate,
  onStoreStatusChange,
  pivotRows,
  scopedReportRows,
  scopedWorkflowRows,
  trendItems,
}) {
  const attendanceRawRows = useMemo(() => {
    if (activeView !== "attendance") {
      return [];
    }

    const visibleStoreIds = new Set(filteredRows.map((row) => row.storeId));

    return (dataSource.attendanceDaily || []).filter((row) => row.month === month && visibleStoreIds.has(row.storeId));
  }, [activeView, dataSource.attendanceDaily, filteredRows, month]);

  if (activeView === "dashboard") {
    return (
      <>
        <section className="insight-grid">
          <PivotTable rows={pivotRows} groupBy={groupBy} onGroupChange={onGroupChange} />
          <ReportChart rows={pivotRows} />
        </section>

        <section className="insight-grid insight-grid--bottom">
          <DetailedTable
            rows={filteredRows}
            reportType={effectiveReportType}
            onExportExcel={() => exportRowsToExcel(filteredRows, effectiveReportType, month)}
            onExportPdf={exportRowsToPdf}
          />
          <TrendPanel items={trendItems} />
        </section>
      </>
    );
  }

  if (activeView === "data-sync") {
    return <DataSyncExplainer />;
  }

  if (activeView === "reports") {
    return <ReportsWorkspace dataSource={dataSource} month={month} />;
  }

  if (activeView === "po-lab") {
    return <PoRequestLab />;
  }

  if (activeView === "training") {
    return <TechnicalTrainingWorkspace stores={dataSource.stores} />;
  }

  if (activeView === "stores") {
    return (
      <StoreMasterWorkspace
        stores={dataSource.stores}
        onAddStore={onAddStore}
        onStatusChange={onStoreStatusChange}
        onUpdateStore={onStoreUpdate}
      />
    );
  }

  if (activeView === "attendance") {
    return (
      <>
        <AttendanceSummaryPanel
          availableDates={attendanceSummary.availableDates}
          aopRows={attendanceSummary.aopRows}
          manualAopOverrides={attendanceAopOverrides?.[month] || {}}
          selectedDate={attendanceSummary.selectedDate}
          onDateChange={onAttendanceDateChange}
          onAopReset={onAttendanceAopReset}
          onAopSave={onAttendanceAopSave}
          dayRows={attendanceSummary.dayRows}
          monthToDateRows={attendanceSummary.monthToDateRows}
          month={month}
        />
        <ReportInsights activeView={activeView} rows={filteredRows} dataSource={dataSource} month={month} />
        <DetailedTable
          rows={attendanceRawRows}
          reportType={effectiveReportType}
          onExportExcel={(exportRows = attendanceRawRows, range) =>
            exportRowsToExcel(
              exportRows,
              effectiveReportType,
              range?.fromDate && range?.toDate ? `${range.fromDate}-to-${range.toDate}` : month,
            )
          }
          onExportPdf={exportRowsToPdf}
        />
      </>
    );
  }

  if (activeView === "faults" || activeView === "ol") {
    return (
      <>
        <WorkflowTrackerPanel
          rows={scopedWorkflowRows}
          reportType={effectiveReportType}
          currentRole={currentRole}
          onStageChange={onStageChange}
          remarks={faultRemarks}
          onRemarkChange={onRemarkChange}
        />
        <ReportInsights
          activeView={activeView}
          rows={scopedReportRows}
          dataSource={dataSource}
          month={month}
          workflowRows={scopedWorkflowRows}
        />
        <DetailedTable
          rows={scopedReportRows}
          reportType={effectiveReportType}
          onExportExcel={() => exportRowsToExcel(scopedReportRows, effectiveReportType, month)}
          onExportPdf={exportRowsToPdf}
        />
      </>
    );
  }

  if (activeView === "cleaning") {
    return (
      <>
        <ReportInsights activeView={activeView} rows={filteredRows} dataSource={dataSource} month={month} />
        <DeepCleaningImagePanel rows={filteredRows} masterStores={dataSource.stores} filters={activeFilters} />
        <DetailedTable
          rows={filteredRows}
          reportType={effectiveReportType}
          onExportExcel={() => exportRowsToExcel(filteredRows, effectiveReportType, month)}
          onExportPdf={exportRowsToPdf}
        />
      </>
    );
  }

  return (
    <>
      <ReportInsights activeView={activeView} rows={filteredRows} dataSource={dataSource} month={month} />
      <DetailedTable
        rows={filteredRows}
        reportType={effectiveReportType}
        onExportExcel={() => exportRowsToExcel(filteredRows, effectiveReportType, month)}
        onExportPdf={exportRowsToPdf}
      />
    </>
  );
}
