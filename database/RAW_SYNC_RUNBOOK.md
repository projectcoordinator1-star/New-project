# Raw Excel Sync Runbook

The first database phase stores Excel data exactly as received.

## Database

- Database: `qpms_dashboard`
- Raw Excel schema: `qpms_raw`
- Import log schema: `qpms_import`
- Future reporting schema: `qpms_app`

## How raw tables are created

When Data Sync sends an Excel workbook to the DB API, each sheet becomes one raw table:

```text
qpms_raw."<Workbook Name> - <Sheet Name>"
```

The table columns keep the Excel headers exactly as received.

Example:

```text
qpms_raw."IFMS Dashboard - Split Server"
```

Columns stay like:

```text
"S. No"
"Server"
"WBS Element"
"PO Date"
"Delivery Date"
"Store code"
```

## How to run the DB API

Create `.env.local` from `.env.example` and keep the PostgreSQL password only on your machine.

Then run:

```powershell
npm.cmd run db:server
```

The API runs on:

```text
http://localhost:8787
```

Health check:

```text
http://localhost:8787/api/health
```

## How to use in the app

1. Start the DB API.
2. Start the Vite app.
3. Go to `Data Sync`.
4. Upload any source files.
5. Click `Sync Raw Files to DB`.
6. Raw tables are created in `qpms_raw`.
7. Import batches are logged in `qpms_import`.

## Current scope

This phase saves raw Excel data to PostgreSQL and exposes clean reporting views in `qpms_app`.

Run this view migration after syncing raw files:

```powershell
node --input-type=module -e "import fs from 'node:fs/promises'; import pg from 'pg'; const sql = await fs.readFile('database/postgres/004_qpms_app_raw_views.sql', 'utf8'); const client = new pg.Client({ host: 'localhost', port: 5432, database: 'qpms_dashboard', user: 'postgres', password: process.env.PGPASSWORD }); await client.connect(); await client.query(sql); await client.end();"
```

Main reporting views:

```text
qpms_app.store_master
qpms_app.attendance_raw
qpms_app.attendance_summary_state
qpms_app.fault_report
qpms_app.ol_split_server
qpms_app.cmpm_report
qpms_app.thermography_report
qpms_app.deep_cleaning_report
qpms_app.manpower_vacancy
qpms_app.data_sync_health
```

The dashboard still uses the current in-browser transformed data until the next phase, where we will read report data back from these `qpms_app` views through API endpoints.
