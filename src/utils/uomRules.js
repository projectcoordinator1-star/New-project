function normalizeUom(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

const INTEGER_ONLY_UOMS = new Set(["EA", "NOS", "SET", "PAC", "ST", "TRP"]);
const FIXED_QUANTITY_UOMS = new Set(["LS"]);

const UOM_REFERENCE = {
  CCM: "cubic cm",
  CUM: "Cubic Meter",
  EA: "each",
  FT: "feet",
  FT2: "sq feet",
  HR: "hours",
  KG: "kg",
  L: "liter",
  LS: "lumpsum",
  LTRS: "liters",
  M: "meter",
  M2: "sq meter",
  M3: "Cubic Meter",
  MDY: "mandays",
  MON: "monthly",
  MT: "Metric Ton",
  NOS: "No",
  PAC: "Packet",
  RFT: "running ft",
  RMT: "running meter",
  SET: "Set",
  SQM: "Sq Meter",
  ST: "ST",
  TRP: "Trip",
};

function buildHelperMessage(code, fullForm, quantityMode) {
  const label = fullForm ? `${code} (${fullForm})` : code || "this unit";

  if (quantityMode === "fixed") {
    return `${label} is treated as a lumpsum item, so quantity stays at 1 by default.`;
  }

  if (quantityMode === "integer") {
    return `${label} is count-based, so use whole-number quantity only.`;
  }

  return `${label} supports measured quantity, so decimal values are allowed.`;
}

export function getUomRule(value) {
  const code = normalizeUom(value);
  const fullForm = UOM_REFERENCE[code] || code;
  const quantityMode = FIXED_QUANTITY_UOMS.has(code)
    ? "fixed"
    : INTEGER_ONLY_UOMS.has(code)
      ? "integer"
      : "decimal";

  return {
    code,
    fullForm,
    quantityMode,
    step: quantityMode === "decimal" ? "0.01" : "1",
    min: quantityMode === "fixed" ? "1" : "0",
    defaultQuantity: quantityMode === "fixed" ? "1" : "1",
    helper: buildHelperMessage(code, fullForm, quantityMode),
  };
}

export function formatUomLabel(value) {
  const rule = getUomRule(value);
  return rule.code && rule.fullForm && rule.code !== rule.fullForm
    ? `${rule.code} · ${rule.fullForm}`
    : rule.code || "--";
}

export function sanitizeQuantityValue(value, uom) {
  const rule = getUomRule(uom);

  if (rule.quantityMode === "fixed") {
    return "1";
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  const numeric = Number(text);
  if (!Number.isFinite(numeric)) {
    return "";
  }

  const safeValue = Math.max(numeric, Number(rule.min));
  if (rule.quantityMode === "integer") {
    return String(Math.round(safeValue));
  }

  return String(safeValue);
}
