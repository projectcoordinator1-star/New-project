import { useEffect, useMemo, useState } from "react";
import { exportAttendanceSummaryToExcel, exportAttendanceSummaryToPdf, formatMonthLabel } from "../utils/dashboard";
import { formatNumber, formatPercent } from "../utils/formatters";
import { OPERATIONAL_STATE_ORDER } from "../utils/stateGroups";

function toDraftValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : "";
}

function AopUpdatePanel({ month, aopRows = [], manualAopOverrides = {}, onSave, onReset }) {
  const stateOptions = useMemo(() => {
    const availableStates = new Set(aopRows.map((row) => row.state));
    return OPERATIONAL_STATE_ORDER.filter((state) => availableStates.has(state));
  }, [aopRows]);
  const [selectedState, setSelectedState] = useState(stateOptions[0] || OPERATIONAL_STATE_ORDER[0]);
  const selectedAop = aopRows.find((row) => row.state === selectedState) || {
    state: selectedState,
    hkAopCount: 0,
    mepcAopCount: 0,
  };
  const [draft, setDraft] = useState({
    hkAopCount: toDraftValue(selectedAop.hkAopCount),
    mepcAopCount: toDraftValue(selectedAop.mepcAopCount),
  });
  const hasManualOverride = Boolean(manualAopOverrides?.[selectedState]);

  useEffect(() => {
    if (stateOptions.length && !stateOptions.includes(selectedState)) {
      setSelectedState(stateOptions[0]);
    }
  }, [selectedState, stateOptions]);

  useEffect(() => {
    setDraft({
      hkAopCount: toDraftValue(selectedAop.hkAopCount),
      mepcAopCount: toDraftValue(selectedAop.mepcAopCount),
    });
  }, [selectedAop.hkAopCount, selectedAop.mepcAopCount]);

  const handleDraftChange = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSave = () => {
    if (!stateOptions.length) {
      return;
    }

    onSave(selectedState, {
      hkAopCount: draft.hkAopCount,
      mepcAopCount: draft.mepcAopCount,
    });
  };

  const handleReset = () => {
    onReset(selectedState);
  };

  return (
    <section className="panel attendance-aop-panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">AOP Budget Setup</p>
          <h3>State-wise HK / MEPC AOP Count</h3>
          <p>Manual demo layer for {formatMonthLabel(month)}. Later this can move into store budget tables.</p>
        </div>
        <span className={`attendance-aop-panel__status ${hasManualOverride ? "is-custom" : ""}`}>
          {hasManualOverride ? "Manual override active" : "Using default AOP"}
        </span>
      </div>

      <div className="attendance-aop-editor">
        <label>
          <span>State</span>
          <select value={selectedState} onChange={(event) => setSelectedState(event.target.value)}>
            {!stateOptions.length ? <option value={selectedState}>No AOP states</option> : null}
            {stateOptions.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>HK AOP Count</span>
          <input
            type="number"
            step="0.01"
            value={draft.hkAopCount}
            onChange={(event) => handleDraftChange("hkAopCount", event.target.value)}
            placeholder="HK count"
          />
        </label>

        <label>
          <span>MEPC AOP Count</span>
          <input
            type="number"
            step="0.01"
            value={draft.mepcAopCount}
            onChange={(event) => handleDraftChange("mepcAopCount", event.target.value)}
            placeholder="MEPC count"
          />
        </label>

        <div className="attendance-aop-editor__actions">
          <button type="button" className="primary-button" onClick={handleSave} disabled={!stateOptions.length}>
            Save AOP
          </button>
          <button type="button" className="ghost-button" onClick={handleReset} disabled={!hasManualOverride}>
            Reset State
          </button>
        </div>
      </div>

      <div className="attendance-aop-strip">
        {aopRows.map((row) => (
          <button
            key={row.state}
            type="button"
            className={`attendance-aop-chip ${row.state === selectedState ? "is-active" : ""}`}
            onClick={() => setSelectedState(row.state)}
          >
            <strong>{row.state}</strong>
            <span>HK {formatNumber(row.hkAopCount)} | MEPC {formatNumber(row.mepcAopCount)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AttendanceMatrix({ title, rows, month, selectedDate, availableDates = [], onDateChange = null, showExportActions = true }) {
  const totalRow = rows.find((row) => row.state === "Grand Total");
  const showDateControl = typeof onDateChange === "function";
  const hasDates = availableDates.length > 0;

  return (
    <section className="panel attendance-panel">
      <div className="panel__header">
        <div>
          <h3>{title}</h3>
          <p>State-wise attendance summary with AOP comparison</p>
        </div>
        <div className="panel__actions attendance-panel__actions">
          {showDateControl ? (
            <label className="inline-select attendance-inline-select">
              <span>Attendance Date</span>
              <select value={selectedDate || ""} onChange={(event) => onDateChange(event.target.value)} disabled={!hasDates}>
                {!hasDates ? <option value="">No dates available</option> : null}
                {availableDates.map((date) => (
                  <option key={date} value={date}>
                    {date}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showExportActions ? (
            <>
              <button
                type="button"
                className="excel-button"
                onClick={() => exportAttendanceSummaryToExcel(rows, title, month, selectedDate)}
                disabled={!rows.length}
              >
                Export Excel
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => exportAttendanceSummaryToPdf(rows, title, month, selectedDate)}
                disabled={!rows.length}
              >
                Export PDF
              </button>
            </>
          ) : null}
        </div>
      </div>

      {totalRow ? (
        <div className="attendance-snapshot">
          <div className="attendance-snapshot__item">
            <span>Cumulative Attendance</span>
            <strong>{formatPercent(totalRow.cumulativePct)}</strong>
          </div>
          <div className="attendance-snapshot__item">
            <span>HK Attendance</span>
            <strong>{formatPercent(totalRow.hkPct)}</strong>
          </div>
          <div className="attendance-snapshot__item">
            <span>MEPC Attendance</span>
            <strong>{formatPercent(totalRow.mepcPct)}</strong>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="empty-state">
          <strong>No attendance rows are available for this range.</strong>
          <p>Upload the raw attendance workbook together with the store allocation file to generate this summary.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table attendance-table">
            <thead>
              <tr>
                <th>State</th>
                <th>HK</th>
                <th>MEPC</th>
                <th>Grand Total</th>
                <th>MEPC AOP Count</th>
                <th>MEPC AOP Mandays</th>
                <th>HK AOP Count</th>
                <th>HK AOP Mandays</th>
                <th>MEPC %</th>
                <th>HK %</th>
                <th>Cumulative %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.state} className={row.state === "Grand Total" ? "attendance-table__total" : ""}>
                  <td>{row.state}</td>
                  <td>{formatNumber(row.hkMandays)}</td>
                  <td>{formatNumber(row.mepcMandays)}</td>
                  <td>{formatNumber(row.grandTotal)}</td>
                  <td>{formatNumber(row.mepcAopCount)}</td>
                  <td>{formatNumber(row.mepcAopMandays)}</td>
                  <td>{formatNumber(row.hkAopCount)}</td>
                  <td>{formatNumber(row.hkAopMandays)}</td>
                  <td className="attendance-table__pct attendance-table__pct--amber">{formatPercent(row.mepcPct)}</td>
                  <td className="attendance-table__pct attendance-table__pct--green">{formatPercent(row.hkPct)}</td>
                  <td className="attendance-table__pct attendance-table__pct--olive">{formatPercent(row.cumulativePct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function AttendanceSummaryPanel({
  availableDates,
  aopRows,
  manualAopOverrides,
  selectedDate,
  onDateChange,
  onAopSave,
  onAopReset,
  dayRows,
  monthToDateRows,
  month,
}) {
  return (
    <>
      <AopUpdatePanel
        month={month}
        aopRows={aopRows}
        manualAopOverrides={manualAopOverrides}
        onSave={onAopSave}
        onReset={onAopReset}
      />
      <AttendanceMatrix
        title="Selected Day Attendance Summary"
        rows={dayRows}
        month={month}
        selectedDate={selectedDate}
        availableDates={availableDates}
        onDateChange={onDateChange}
        showExportActions
      />
      <AttendanceMatrix
        title="Month-to-Date Attendance Summary"
        rows={monthToDateRows}
        month={month}
        selectedDate={selectedDate}
        showExportActions={false}
      />
    </>
  );
}
