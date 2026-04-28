const DEFAULT_LOCALE = "en-US";
const numericPattern = /^-?\d+(\.\d+)?$/;

export function roundNumber(value, decimals = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  const factor = 10 ** decimals;
  const rounded = Math.round((numeric + Number.EPSILON) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatNumber(value, options = {}) {
  const { minimumFractionDigits = 0, maximumFractionDigits = 2, fallback = "0" } = options;
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return roundNumber(numeric, maximumFractionDigits).toLocaleString(DEFAULT_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping: false,
  });
}

export function formatPercent(value, options = {}) {
  return `${formatNumber(value, { fallback: "0", ...options })}%`;
}

export function formatDisplayValue(value, options = {}) {
  if (typeof value === "number") {
    return formatNumber(value, options);
  }

  if (typeof value === "string" && numericPattern.test(value.trim())) {
    return formatNumber(Number(value), options);
  }

  return value ?? options.fallback ?? "--";
}
