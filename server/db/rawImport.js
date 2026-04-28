import pg from "pg";

const { Pool } = pg;

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function cleanIdentifier(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function uniquifyHeaders(headers) {
  const seen = new Map();

  return headers.map((header) => {
    const count = (seen.get(header) || 0) + 1;
    seen.set(header, count);

    return count === 1 ? header : `${header}__${count}`;
  });
}

function createTableName(workbookName, sheetName) {
  return `${workbookName || "Workbook"} - ${sheetName || "Sheet"}`
    .replace(/\.(xlsx|xls|csv)$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function normalizeRows(rows = [], headers = []) {
  return rows.map((row) =>
    Object.fromEntries(
      headers.map((header) => [
        header,
        row?.[header] === undefined || row?.[header] === null ? "" : String(row[header]),
      ]),
    ),
  );
}

export function createPool() {
  return new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || "qpms_dashboard",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD,
    max: 4,
  });
}

export async function ensureImportSchemas(client) {
  await client.query("create schema if not exists qpms_raw");
  await client.query("create schema if not exists qpms_import");

  await client.query(`
    create table if not exists qpms_import.import_batch (
      import_batch_id bigserial primary key,
      batch_code text not null unique,
      source_name text not null,
      file_name text not null,
      sheet_count integer not null default 0,
      row_count integer not null default 0,
      imported_at timestamptz not null default now()
    )
  `);

  await client.query(`
    create table if not exists qpms_import.import_sheet (
      import_sheet_id bigserial primary key,
      import_batch_id bigint not null references qpms_import.import_batch(import_batch_id) on delete cascade,
      raw_table_name text not null,
      sheet_name text not null,
      row_count integer not null default 0,
      column_count integer not null default 0,
      imported_at timestamptz not null default now()
    )
  `);
}

async function recreateRawTable(client, tableName, headers) {
  const tableRef = `qpms_raw.${quoteIdentifier(tableName)}`;
  const columnSql = headers.map((header) => `${quoteIdentifier(header)} text`).join(", ");

  await client.query(`drop table if exists ${tableRef}`);

  await client.query(`
    create table ${tableRef} (
      ${columnSql}
    )
  `);

  return tableRef;
}

async function insertRows(client, tableRef, headers, rows) {
  const normalizedRows = normalizeRows(rows, headers);

  if (!normalizedRows.length) {
    return 0;
  }

  const columnsSql = headers.map(quoteIdentifier).join(", ");
  let inserted = 0;

  for (const row of normalizedRows) {
    const values = headers.map((header) => row[header]);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

    await client.query(
      `insert into ${tableRef} (${columnsSql}) values (${placeholders})`,
      values,
    );

    inserted += 1;
  }

  return inserted;
}

export async function importWorkbookToRawDb(pool, payload) {
  const workbookName = cleanIdentifier(payload.workbookName, "Workbook");
  const sourceName = cleanIdentifier(payload.sourceName, workbookName);
  const sheets = Array.isArray(payload.sheets) ? payload.sheets : [];
  const batchCode = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const client = await pool.connect();

  try {
    await client.query("begin");
    await ensureImportSchemas(client);

    const totalRows = sheets.reduce(
      (sum, sheet) => sum + (Array.isArray(sheet.rows) ? sheet.rows.length : 0),
      0,
    );

    const batchResult = await client.query(
      `
        insert into qpms_import.import_batch (batch_code, source_name, file_name, sheet_count, row_count)
        values ($1, $2, $3, $4, $5)
        returning import_batch_id
      `,
      [batchCode, sourceName, workbookName, sheets.length, totalRows],
    );

    const importBatchId = batchResult.rows[0].import_batch_id;
    const importedSheets = [];

    for (const sheet of sheets) {
      const sheetName = cleanIdentifier(sheet.sheetName, "Sheet");

      const headers = uniquifyHeaders(
        (sheet.headers || []).map((header, index) =>
          cleanIdentifier(header, `Column ${index + 1}`),
        ),
      );

      const tableName = createTableName(workbookName, sheetName);

      if (!headers.length) {
        importedSheets.push({
          sheetName,
          tableName,
          rows: 0,
          columns: 0,
          skipped: true,
        });
        continue;
      }

      const tableRef = await recreateRawTable(client, tableName, headers);
      const insertedRows = await insertRows(client, tableRef, headers, sheet.rows || []);

      await client.query(
        `
          insert into qpms_import.import_sheet (import_batch_id, raw_table_name, sheet_name, row_count, column_count)
          values ($1, $2, $3, $4, $5)
        `,
        [importBatchId, tableName, sheetName, insertedRows, headers.length],
      );

      importedSheets.push({
        sheetName,
        tableName: `qpms_raw.${tableName}`,
        rows: insertedRows,
        columns: headers.length,
        mode: "replace",
      });
    }

    await client.query("commit");

    return {
      ok: true,
      importBatchId,
      sourceName,
      workbookName,
      mode: "replace",
      sheets: importedSheets,
      totalRows: importedSheets.reduce((sum, sheet) => sum + sheet.rows, 0),
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}