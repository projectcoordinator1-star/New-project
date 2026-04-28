import XLSX from "xlsx";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../env.js";
import { createPool } from "./rawImport.js";

function clean(value) {
  return String(value ?? "").trim();
}

function readStoreMasterRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }).map((row) => ({
    store_code: clean(row.store_code),
    state: clean(row.state),
    server: clean(row.server),
    business: clean(row.business),
    status: clean(row.status),
  }));

  const usableRows = rows.filter((row) => row.store_code);
  const duplicateCodes = [...usableRows.reduce((map, row) => map.set(row.store_code, (map.get(row.store_code) || 0) + 1), new Map())]
    .filter(([, count]) => count > 1)
    .map(([storeCode]) => storeCode);

  if (duplicateCodes.length) {
    throw new Error(`Duplicate store_code values found: ${duplicateCodes.slice(0, 20).join(", ")}`);
  }

  return usableRows;
}

export async function importStoreMaster(filePath) {
  const rows = readStoreMasterRows(filePath);
  const pool = createPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("create schema if not exists qpms_master");
    await client.query(`
      create table if not exists qpms_master.stores (
        store_code text primary key,
        state text not null,
        server text,
        business text,
        status text
      )
    `);
    await client.query("truncate table qpms_master.stores");

    for (const row of rows) {
      await client.query(
        `
          insert into qpms_master.stores (store_code, state, server, business, status)
          values ($1, $2, $3, $4, $5)
        `,
        [row.store_code, row.state, row.server, row.business, row.status],
      );
    }

    await client.query("commit");

    const [countResult, stateResult] = await Promise.all([
      pool.query("select count(*)::int as rows, count(distinct store_code)::int as unique_store_codes from qpms_master.stores"),
      pool.query("select state, count(*)::int as stores from qpms_master.stores group by state order by state"),
    ]);

    return {
      ok: true,
      imported: countResult.rows[0],
      byState: stateResult.rows,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  loadLocalEnv();
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: node server/db/importStoreMaster.js <path-to-store_master.xlsx>");
    process.exit(1);
  }

  importStoreMaster(filePath)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exit(1);
    });
}
