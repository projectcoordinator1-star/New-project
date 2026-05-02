import { AppHero } from "./components/AppHero";
import { DataSourcePanel } from "./components/DataSourcePanel";
import { FilterPanel } from "./components/FilterPanel";
import { Header } from "./components/Header";
import { KpiCards } from "./components/KpiCards";
import { Sidebar } from "./components/Sidebar";
import { ViewRenderer } from "./components/ViewRenderer";
import { formatMonthLabel } from "./utils/dashboard";
import { useDashboardController } from "./hooks/useDashboardController";

function App() {
  const controller = useDashboardController();
  const {
    activeFilters,
    activeView,
    attendanceAopOverrides,
    attendanceSummary,
    currentRole,
    dataInfo,
    dataSource,
    databaseSyncInfo,
    effectiveReportType,
    faultRemarks,
    filterOptions,
    filteredRows,
    groupBy,
    hero,
    heroStats,
    isUploading,
    isSyncingDatabase,
    kpis,
    pivotRows,
    roleConfig,
    scopedReportRows,
    scopedWorkflowRows,
    showFilterPanel,
    showKpis,
    trendItems,
    visibleStoreCount,
    workflowFiles,
    canProcessWorkflow,
    handleAddStore,
    handleAttendanceAopReset,
    handleAttendanceAopSave,
    handleAttendanceDateChange,
    handleFilterChange,
    handleFilterReset,
    handleProcessWorkflow,
    handleRemarkChange,
    handleSyncRawDatabase,
    handleStageChange,
    handleStoreUpdate,
    handleStoreStatusChange,
    handleUseDemoData,
    handleWorkflowFileChange,
    onGroupChange,
    onNavigate,
    onRoleChange,
  } = controller;

  return (
    <div className="app-shell">
      <Sidebar activeView={activeView} onNavigate={onNavigate} />

      <main className="content">
        <Header
          monthLabel={formatMonthLabel(activeFilters.month)}
          currentRole={currentRole}
          onRoleChange={onRoleChange}
          activeView={activeView}
          dataInfo={dataInfo}
          visibleStoreCount={visibleStoreCount}
          effectiveReportType={effectiveReportType}
        />

        {activeView !== "stores" && activeView !== "attendance" ? (
          <AppHero
            activeView={activeView}
            hero={hero}
            heroStats={heroStats}
            roleConfig={roleConfig}
            dataMode={dataInfo.mode}
          />
        ) : null}

        {activeView === "data-sync" ? (
          <DataSourcePanel
            dataInfo={dataInfo}
            summary={controller.summary}
            workflowFiles={workflowFiles}
            onWorkflowFileChange={handleWorkflowFileChange}
            onProcessWorkflow={handleProcessWorkflow}
            onSyncRawDatabase={handleSyncRawDatabase}
            onUseDemoData={handleUseDemoData}
            isUploading={isUploading}
            isSyncingDatabase={isSyncingDatabase}
            canProcessWorkflow={canProcessWorkflow}
            databaseSyncInfo={databaseSyncInfo}
          />
        ) : null}

        {showFilterPanel ? (
          <FilterPanel
            options={filterOptions}
            filters={activeFilters}
            onChange={handleFilterChange}
            onReset={handleFilterReset}
            showReportType={activeView === "dashboard"}
            lockedReportLabel={effectiveReportType}
            resultsCount={visibleStoreCount}
          />
        ) : null}

        {showKpis ? <KpiCards items={kpis} /> : null}

        <ViewRenderer
          activeFilters={activeFilters}
          activeView={activeView}
          attendanceAopOverrides={attendanceAopOverrides}
          attendanceSummary={attendanceSummary}
          currentRole={currentRole}
          dataSource={dataSource}
          effectiveReportType={effectiveReportType}
          faultRemarks={faultRemarks}
          filteredRows={filteredRows}
          groupBy={groupBy}
          month={activeFilters.month}
          onAddStore={handleAddStore}
          onAttendanceAopReset={handleAttendanceAopReset}
          onAttendanceAopSave={handleAttendanceAopSave}
          onAttendanceDateChange={handleAttendanceDateChange}
          onGroupChange={onGroupChange}
          onRemarkChange={handleRemarkChange}
          onStageChange={handleStageChange}
          onStoreUpdate={handleStoreUpdate}
          onStoreStatusChange={handleStoreStatusChange}
          pivotRows={pivotRows}
          scopedReportRows={scopedReportRows}
          scopedWorkflowRows={scopedWorkflowRows}
          trendItems={trendItems}
        />
      </main>
    </div>
  );
}

export default App;
