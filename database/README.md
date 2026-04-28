# QPMS Pilot Database Foundation

This folder is the starting point for the pilot-phase move away from Excel-as-runtime and toward a local PostgreSQL-backed system.

## What is included

- `postgres/001_schema.sql`
  Core pilot tables for master data, imports, attendance, workflow, service master, and quotations.
- `postgres/002_reference_seed.sql`
  Seed data for teams, roles, workflow stages, attendance status mappings, and UOM codes.
- `postgres/003_reporting_views.sql`
  Reporting views that match the current dashboard direction and reduce frontend calculation load later.

## Pilot architecture

For the pilot, the clean target is:

1. `PostgreSQL` as the source of truth
2. `Excel imports` only for bootstrap or bulk refresh
3. `React dashboard` reads prepared snapshots/APIs instead of rebuilding everything in the browser
4. `Spring Boot` can be added in front of the same schema when we are ready

## Import order

Start in this order so the downstream modules have clean lookups:

1. `store_master`
2. `manager_master`
3. `employee_master`
4. `employee_store_assignment`
5. `service_master`
6. `attendance_raw_entry` -> `attendance_processed_entry`
7. `workflow_item`
8. `thermography_inspection`
9. `deep_cleaning_activity`
10. `manpower_snapshot`
11. `quotation_header` / `quotation_line`

## Why this structure

- `Store / employee / manager` masters support your attendance mapping by `EP No`
- `workflow_item` covers both `Fault` and `OL` without forcing duplicate logic
- `service_master` supports the quotation and PO flow you are building
- `import_batch` and related tables give the TL an auditable data-sync story
- views such as `v_store_unified_snapshot` and `v_data_sync_health` support near-real-time management screens later

## Local PostgreSQL setup once installed

When PostgreSQL is installed locally, create the pilot DB and run:

```sql
\i database/postgres/001_schema.sql
\i database/postgres/002_reference_seed.sql
\i database/postgres/003_reporting_views.sql
```

Suggested local database name:

- `qpms_pilot`

Suggested first user:

- `postgres` during setup
- later create a dedicated app user such as `qpms_app`

## Frontend handoff

The React app now has a single ingress layer in:

- [dashboardGateway.js](</C:/Users/Vignesh/Documents/New project/src/services/dashboardGateway.js>)

That file separates:

- demo dataset session
- upload-driven workbook session
- future database/API session

So when we connect the pilot backend, we won't need to rewrite the whole dashboard controller again.
