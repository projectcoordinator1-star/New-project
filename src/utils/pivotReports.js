import { buildReportCatalog } from "../config/reportCatalog";
import { formatDisplayValue, roundNumber } from "./formatters";

function unique(values) {
  return [...new Set(values)];
}

function titleCase(value) {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function inferFieldType(rows, key) {
  const values = rows.map((row) => row[key]).filter((value) => value !== null && value !== undefined && value !== "");

  if (!values.length) {
    return "text";
  }

  const numeric = values.every((value) => Number.isFinite(Number(value)));
  if (numeric) {
    return "number";
  }

  const isoDate = values.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value)));
  if (isoDate) {
    return "date";
  }

  return "text";
}

function inferAggregation(field) {
  const label = String(field.label).toLowerCase();
  if (label.includes("%") || label.includes("pct") || label.includes("readiness") || label.includes("throughput")) {
    return "avg";
  }

  return "sum";
}

function buildFields(report) {
  const labelsByKey = new Map((report.tableColumns || []).map((column) => [column.key, column.label]));
  const columnsByKey = new Map((report.tableColumns || []).map((column) => [column.key, column]));
  const keys = unique(
    [
      ...(report.tableColumns || []).map((column) => column.key),
      ...report.rows.flatMap((row) => Object.keys(row)),
    ].filter((key) => !["beforeTone", "afterTone", "note"].includes(key)),
  );

  return keys.map((key) => {
    const column = columnsByKey.get(key);
    const type = column?.measure || column?.type === "number" ? "number" : inferFieldType(report.rows, key);
    const label = labelsByKey.get(key) || titleCase(key);
    return {
      id: key,
      key,
      label,
      type,
      aggregation: type === "number" ? inferAggregation({ label }) : null,
    };
  });
}

function buildDefaultLayout(fields) {
  const dimensions = fields.filter((field) => field.type !== "number");
  const measures = fields.filter((field) => field.type === "number");
  const preferredRow =
    dimensions.find((field) => ["state", "storeName", "site", "team", "source", "supervisor"].includes(field.id)) ||
    dimensions[0] ||
    null;
  const preferredColumn =
    dimensions.find((field) =>
      field.id !== preferredRow?.id &&
      ["class", "rawStatus", "workflowStage", "pmStatus", "cmTask", "status", "shift", "priority", "phase"].includes(field.id),
    ) ||
    dimensions.find((field) => field.id !== preferredRow?.id) ||
    null;
  const preferredFilter = dimensions.find(
    (field) =>
      ![preferredRow?.id, preferredColumn?.id].includes(field.id) &&
      ["month", "storeName", "project", "supervisor", "team"].includes(field.id),
  );

  return {
    filters: preferredFilter ? [preferredFilter.id] : [],
    rows: preferredRow ? [preferredRow.id] : [],
    columns: preferredColumn ? [preferredColumn.id] : [],
    values: measures[0] ? [measures[0].id] : [],
  };
}

function buildFilterDefaults(fields, layout, rows) {
  return Object.fromEntries(
    layout.filters.map((fieldId) => {
      const options = unique(rows.map((row) => row[fieldId]).filter(Boolean));
      return [fieldId, options[0] ? "All" : ""];
    }),
  );
}

function getFieldOptions(rows, fieldId) {
  return ["All", ...unique(rows.map((row) => row[fieldId]).filter(Boolean))];
}

function getLayoutFieldIds(layout) {
  return [...layout.filters, ...layout.rows, ...layout.columns, ...layout.values];
}

function moveFieldToZone(layout, fieldId, zoneId, fieldMap) {
  const field = fieldMap.get(fieldId);
  if (!field) {
    return layout;
  }

  if (zoneId === "values" && field.type !== "number") {
    return layout;
  }

  if ((zoneId === "rows" || zoneId === "columns" || zoneId === "filters") && field.type === "number") {
    return layout;
  }

  const next = {
    filters: layout.filters.filter((id) => id !== fieldId),
    rows: layout.rows.filter((id) => id !== fieldId),
    columns: layout.columns.filter((id) => id !== fieldId),
    values: layout.values.filter((id) => id !== fieldId),
  };

  next[zoneId] = [...next[zoneId], fieldId];
  return next;
}

function removeFieldFromLayout(layout, fieldId) {
  return {
    filters: layout.filters.filter((id) => id !== fieldId),
    rows: layout.rows.filter((id) => id !== fieldId),
    columns: layout.columns.filter((id) => id !== fieldId),
    values: layout.values.filter((id) => id !== fieldId),
  };
}

function applyFilters(rows, filterValues) {
  return rows.filter((row) =>
    Object.entries(filterValues).every(([fieldId, value]) => {
      if (!value || value === "All") {
        return true;
      }

      return row[fieldId] === value;
    }),
  );
}

function buildKey(row, fields) {
  if (!fields.length) {
    return "__all__";
  }

  return fields.map((field) => String(row[field] ?? "Blank")).join("||");
}

function buildLabel(row, fields, fieldMap) {
  if (!fields.length) {
    return [{ key: "__all__", label: "All Records" }];
  }

  return fields.map((fieldId) => ({
    key: fieldId,
    label: formatDisplayValue(row[fieldId], { fallback: "Blank" }),
    title: fieldMap.get(fieldId)?.label || titleCase(fieldId),
  }));
}

function aggregateValue(rows, field) {
  if (!rows.length) {
    return 0;
  }

  const numericValues = rows.map((row) => Number(row[field.id] || 0));
  const total = numericValues.reduce((sum, value) => sum + value, 0);

  return field.aggregation === "avg" ? total / numericValues.length : total;
}

function formatMetric(value, field) {
  const rounded = roundNumber(value);
  return field.aggregation === "avg" || String(field.label).includes("%") ? `${formatDisplayValue(rounded)}${String(field.label).includes("%") ? "" : ""}` : formatDisplayValue(rounded);
}

function buildCellPayload(sourceRows, valueFields) {
  return valueFields.map((field) => {
    const numeric = aggregateValue(sourceRows, field);
    return {
      key: field.id,
      label: field.label,
      value: roundNumber(numeric),
      display: String(field.label).includes("%") ? `${formatDisplayValue(roundNumber(numeric))}%` : formatDisplayValue(roundNumber(numeric)),
    };
  });
}

function buildPivotTable(rows, layout, fieldMap) {
  const rowFields = layout.rows;
  const columnFields = layout.columns;
  const valueFields = layout.values.map((fieldId) => fieldMap.get(fieldId)).filter(Boolean);

  if (!valueFields.length) {
    return {
      rowFields: rowFields.map((fieldId) => fieldMap.get(fieldId)).filter(Boolean),
      columnGroups: [],
      rows: [],
      grandTotals: [],
      exportColumns: [],
      exportRows: [],
    };
  }

  const rowGroups = new Map();
  const columnGroups = new Map();

  rows.forEach((row) => {
    const rowKey = buildKey(row, rowFields);
    const columnKey = buildKey(row, columnFields);

    if (!rowGroups.has(rowKey)) {
      rowGroups.set(rowKey, {
        key: rowKey,
        labels: buildLabel(row, rowFields, fieldMap),
        cells: new Map(),
        sourceRows: [],
      });
    }

    if (!columnGroups.has(columnKey)) {
      columnGroups.set(columnKey, {
        key: columnKey,
        labels: buildLabel(row, columnFields, fieldMap),
        sourceRows: [],
      });
    }

    const rowGroup = rowGroups.get(rowKey);
    rowGroup.sourceRows.push(row);

    if (!rowGroup.cells.has(columnKey)) {
      rowGroup.cells.set(columnKey, []);
    }

    rowGroup.cells.get(columnKey).push(row);
    columnGroups.get(columnKey).sourceRows.push(row);
  });

  const orderedColumnGroups = Array.from(columnGroups.values()).sort((left, right) =>
    left.labels.map((label) => label.label).join(" ").localeCompare(right.labels.map((label) => label.label).join(" ")),
  );

  const orderedRowGroups = Array.from(rowGroups.values()).sort((left, right) =>
    left.labels.map((label) => label.label).join(" ").localeCompare(right.labels.map((label) => label.label).join(" ")),
  );

  const pivotRows = orderedRowGroups.map((rowGroup) => {
    const cells = orderedColumnGroups.map((columnGroup) => {
      const sourceRows = rowGroup.cells.get(columnGroup.key) || [];
      return {
        key: `${rowGroup.key}-${columnGroup.key}`,
        values: buildCellPayload(sourceRows, valueFields),
      };
    });

    return {
      key: rowGroup.key,
      labels: rowGroup.labels,
      cells,
      totals: buildCellPayload(rowGroup.sourceRows, valueFields),
    };
  });

  const grandTotals = buildCellPayload(rows, valueFields);
  const exportColumns = [
    ...rowFields.map((fieldId) => ({ key: fieldId, label: fieldMap.get(fieldId)?.label || titleCase(fieldId) })),
    ...orderedColumnGroups.map((columnGroup) => ({
      key: columnGroup.key,
      label: columnGroup.labels.map((label) => label.label).join(" / "),
    })),
    { key: "__total__", label: "Grand Total" },
  ];

  const exportRows = pivotRows.map((rowGroup) => {
    const rowObject = Object.fromEntries(rowGroup.labels.map((label) => [label.key, label.label]));

    orderedColumnGroups.forEach((columnGroup, index) => {
      rowObject[columnGroup.key] = rowGroup.cells[index].values.map((value) => value.display).join(" | ");
    });

    rowObject.__total__ = rowGroup.totals.map((value) => value.display).join(" | ");
    return rowObject;
  });

  if (orderedColumnGroups.length) {
    const totalRow = Object.fromEntries(rowFields.map((fieldId, index) => [fieldId, index === 0 ? "Grand Total" : ""]));
    orderedColumnGroups.forEach((columnGroup) => {
      totalRow[columnGroup.key] = buildCellPayload(columnGroup.sourceRows, valueFields)
        .map((value) => value.display)
        .join(" | ");
    });
    totalRow.__total__ = grandTotals.map((value) => value.display).join(" | ");
    exportRows.push(totalRow);
  }

  return {
    rowFields: rowFields.map((fieldId) => fieldMap.get(fieldId)).filter(Boolean),
    columnGroups: orderedColumnGroups,
    rows: pivotRows,
    grandTotals,
    exportColumns,
    exportRows,
    valueFields,
  };
}

export function buildPivotReportCatalog(dataSource, month) {
  return buildReportCatalog(dataSource, month).map((report) => {
    const fields = buildFields(report);
    const layout = buildDefaultLayout(fields);
    const fieldMap = new Map(fields.map((field) => [field.id, field]));

    return {
      ...report,
      fields,
      fieldMap,
      defaultLayout: layout,
      defaultFilterValues: buildFilterDefaults(fields, layout, report.rows),
    };
  });
}

export function buildPivotPreview(report, layout, filterValues) {
  const filteredRows = applyFilters(report.rows, filterValues);
  const pivotTable = buildPivotTable(filteredRows, layout, report.fieldMap);
  const filterSummary = layout.filters
    .map((fieldId) => {
      const value = filterValues[fieldId];
      if (!value || value === "All") {
        return null;
      }

      return {
        label: report.fieldMap.get(fieldId)?.label || titleCase(fieldId),
        value,
      };
    })
    .filter(Boolean);

  const firstValueField = pivotTable.valueFields[0];
  const chartItems = pivotTable.rows.slice(0, 6).map((row) => ({
    label: row.labels.map((label) => label.label).join(" / "),
    value: row.totals[0]?.value || 0,
    tone: row.totals[0]?.value > 0 ? "blue" : "amber",
  }));

  const summaryCards = [
    { label: "Records", value: filteredRows.length, note: "Rows used in preview", tone: "blue" },
    { label: "Row Groups", value: pivotTable.rows.length, note: "Pivot row buckets", tone: "green" },
    { label: "Column Groups", value: Math.max(pivotTable.columnGroups.length, 1), note: "Pivot column buckets", tone: "amber" },
    {
      label: firstValueField ? firstValueField.label : "Values",
      value: pivotTable.grandTotals[0]?.display || "0",
      note: firstValueField ? `${firstValueField.aggregation?.toUpperCase()} across preview` : "Add a numeric field to Values",
      tone: "purple",
    },
  ];

  return {
    title: `${report.name} Pivot Builder`,
    subtitle: `Excel-style pivot preview for ${report.name}. Drag fields into shelves and export the resulting matrix.`,
    filterSummary,
    summaryCards,
    chart: chartItems.length
      ? {
          type: "bar",
          title: firstValueField ? `${firstValueField.label} by Row Group` : "Pivot Preview",
          subtitle: "Top row groups from the current pivot layout",
          items: chartItems,
        }
      : null,
    table: {
      columns: pivotTable.exportColumns,
      rows: pivotTable.exportRows,
    },
    pivotTable,
    beforeAfter:
      report.id === "deep-cleaning"
        ? {
            title: "Before / After Preview",
            subtitle: "Still available for Deep Cleaning so the future PPT flow stays supported.",
            items: filteredRows.slice(0, 4),
          }
        : null,
    exportOptions: report.exportOptions,
  };
}

export function countActivePivotFilters(layout, filterValues) {
  return layout.filters.reduce((count, fieldId) => {
    const value = filterValues[fieldId];
    return value && value !== "All" ? count + 1 : count;
  }, 0);
}

export function getFieldOptionsForFilter(report, fieldId) {
  return getFieldOptions(report.rows, fieldId);
}

export { moveFieldToZone, removeFieldFromLayout, getLayoutFieldIds };
