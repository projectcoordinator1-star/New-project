const DB_API_BASE_URL = "http://localhost:8787";

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeHeader(value, index) {
  return cleanText(value) || `Column ${index + 1}`;
}

function uniquifyHeaders(headers) {
  const seen = new Map();

  return headers.map((header) => {
    const count = (seen.get(header) || 0) + 1;
    seen.set(header, count);

    return count === 1 ? header : `${header}__${count}`;
  });
}

function getHeaderRowIndex(sheetName) {
  const normalized = cleanText(sheetName).toUpperCase();
  if (["THERMOGRAPHY", "DEEP CLEANING ACTIVITY", "MANPOWER VACANCY", "CMPM"].includes(normalized)) {
    return 1;
  }

  return 0;
}

function matrixToRows(matrix, headerRowIndex = 0) {
  const headerRow = matrix[headerRowIndex] || [];
  const headers = uniquifyHeaders(headerRow.map(normalizeHeader));
  const rows = matrix
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((value) => cleanText(value)))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));

  return { headers, rows };
}

async function readWorkbookPayload(file, sourceName) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  return {
    sourceName,
    workbookName: file.name,
    sheets: workbook.SheetNames.map((sheetName) => {
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false });
      const { headers, rows } = matrixToRows(matrix, getHeaderRowIndex(sheetName));
      return {
        sheetName,
        headers,
        rows,
      };
    }),
  };
}

export async function syncFilesToRawDatabase(filesByKey) {
  const entries = Object.entries(filesByKey).filter(([, file]) => file);
  const results = [];

  for (const [sourceName, file] of entries) {
    const payload = await readWorkbookPayload(file, sourceName);
    const response = await fetch(`${DB_API_BASE_URL}/api/raw-import`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Could not sync ${file.name} to database.`);
    }

    results.push(result);
  }

  return results;
}
