function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseRate(value) {
  const numeric = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function normalizeServiceRow(row, index) {
  const item = {
    id: `${cleanText(row["Final Service code"] || row["OLD SERVICE CODES"] || row["Short Text"])}-${index}`,
    oldServiceCode: cleanText(row["OLD SERVICE CODES"]),
    newServiceCode: cleanText(row["New Service code"]),
    finalServiceCode: cleanText(row["Final Service code"]),
    hsn: cleanText(row.HSN),
    shortText: cleanText(row["Short Text"]),
    longText: cleanText(row["Long Text"]),
    uom: cleanText(row.UOM),
    benchmarkRate: parseRate(row["RRL Benchmark Rates"]),
    approvedBrand: cleanText(row["Approved Make/Brand"]),
    category: cleanText(row.Category) || "Uncategorized",
    remarks: cleanText(row.Remarks),
  };

  item.searchText = normalizeText(
    [
      item.oldServiceCode,
      item.newServiceCode,
      item.finalServiceCode,
      item.shortText,
      item.longText,
      item.category,
      item.uom,
      item.hsn,
    ].join(" "),
  );
  item.searchTokens = tokenize(item.searchText);

  return item;
}

function scoreItem(item, normalizedQuery, queryTokens) {
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;
  const shortText = normalizeText(item.shortText);
  const longText = normalizeText(item.longText);
  const category = normalizeText(item.category);
  const finalCode = normalizeText(item.finalServiceCode);
  const oldCode = normalizeText(item.oldServiceCode);

  if ([finalCode, oldCode].includes(normalizedQuery)) {
    score += 240;
  }

  if (finalCode.startsWith(normalizedQuery) || oldCode.startsWith(normalizedQuery)) {
    score += 160;
  }

  if (shortText.startsWith(normalizedQuery)) {
    score += 140;
  } else if (shortText.includes(normalizedQuery)) {
    score += 100;
  }

  if (longText.includes(normalizedQuery)) {
    score += 40;
  }

  if (category.includes(normalizedQuery)) {
    score += 28;
  }

  queryTokens.forEach((token) => {
    if (shortText.includes(token)) {
      score += 35;
    }

    if (longText.includes(token)) {
      score += 14;
    }

    if (category.includes(token)) {
      score += 10;
    }

    if (item.searchTokens.includes(token)) {
      score += 5;
    }
  });

  return score;
}

export async function parseServiceMasterWorkbook(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const items = rows
    .map((row, index) => normalizeServiceRow(row, index))
    .filter((item) => item.shortText || item.finalServiceCode || item.oldServiceCode);

  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right),
  );
  const distinctHsn = [...new Set(items.map((item) => item.hsn).filter(Boolean))];

  return {
    fileName: file.name,
    sheetName,
    items,
    summary: {
      totalItems: items.length,
      totalCategories: categories.length,
      totalHsnCodes: distinctHsn.length,
      categories,
    },
  };
}

export function searchServiceMaster(items, query, category = "All", limit = 8) {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(normalizedQuery);
  const scopedItems = category === "All" ? items : items.filter((item) => item.category === category);

  if (!normalizedQuery) {
    return scopedItems.slice(0, limit);
  }

  return scopedItems
    .map((item) => ({
      item,
      score: scoreItem(item, normalizedQuery, queryTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.item.shortText.localeCompare(right.item.shortText);
    })
    .slice(0, limit)
    .map((entry) => entry.item);
}
