# QPMS Local DB Read API

Run the API server:

```powershell
npm.cmd run db:server
```

Base URL:

```text
http://localhost:8787
```

## Health

```text
GET /api/health
```

## Dashboard Bootstrap

Returns report catalog, synced row counts, and latest import details.

```text
GET /api/dashboard/bootstrap
```

## Report Catalog

Returns available report keys and supported filters.

```text
GET /api/reports
```

## Report Rows

```text
GET /api/reports/:reportKey
```

Supported report keys:

- `stores`
- `attendance`
- `attendance-summary`
- `faults`
- `ol`
- `cmpm`
- `thermography`
- `deep-cleaning`
- `manpower`
- `data-sync-health`

Common query parameters:

- `limit=500`
- `offset=0`
- `q=search text`

Example:

```text
GET /api/reports/attendance?state=TN&limit=100
GET /api/reports/faults?status=Open&q=leakage
GET /api/reports/ol?storeId=9653
GET /api/reports/cmpm?state=TN
```

## Filter Options

Returns dropdown values for a report's supported filters.

```text
GET /api/reports/:reportKey/options
```

Example:

```text
GET /api/reports/attendance/options
GET /api/reports/faults/options
GET /api/reports/ol/options
```

## Notes

- The API reads only from whitelisted `qpms_app` views.
- The browser cannot send arbitrary table names or SQL.
- Returned rows are capped by `limit`, with a maximum of `5000` rows per request.
