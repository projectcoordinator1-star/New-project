const exportLabels = {
  ppt: "Export PPT",
  pdf: "Export PDF",
  excel: "Export Excel",
};

export function ReportExportMenu({ options = [], onExport, disabled = false }) {
  return (
    <div className="report-export-menu">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className={option === "excel" ? "excel-button" : "ghost-button"}
          onClick={() => onExport(option)}
          disabled={disabled}
        >
          {exportLabels[option] || option}
        </button>
      ))}
    </div>
  );
}
