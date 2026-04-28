export const OPERATIONAL_STATE_ORDER = ["AP-1", "AP-2", "KL", "KN", "TG", "TN"];

function cleanStateText(value) {
  return String(value || "").trim();
}

export function normalizeOperationalState(value, fallback = "Unknown") {
  const text = cleanStateText(value);
  const compact = text.toUpperCase().replace(/[\s_]+/g, "").replace(/-/g, "");

  if (!compact) {
    return fallback;
  }

  if (compact === "AP1" || compact === "ANDHRAPRADESH1") {
    return "AP-1";
  }

  if (compact === "AP2" || compact === "ANDHRAPRADESH2") {
    return "AP-2";
  }

  if (["PY", "TN", "TAMILNADU", "TAMILNADU1", "TAMIL"].includes(compact) || compact.includes("TAMILNADU")) {
    return "TN";
  }

  if (["KL", "KL1", "KERALA", "KERALA1"].includes(compact)) {
    return "KL";
  }

  if (["KN", "KN1", "KN3", "KARNATAKA", "KARNATAKA1", "KARNATAKA3"].includes(compact)) {
    return "KN";
  }

  if (["TG", "TELANGANA", "TELANGANA1"].includes(compact) || compact.includes("TELANGANA")) {
    return "TG";
  }

  return text || fallback;
}

export function isOperationalState(value) {
  return OPERATIONAL_STATE_ORDER.includes(normalizeOperationalState(value));
}

export function sortOperationalStates(states) {
  return [...states].sort((left, right) => {
    const leftIndex = OPERATIONAL_STATE_ORDER.indexOf(left);
    const rightIndex = OPERATIONAL_STATE_ORDER.indexOf(right);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}
