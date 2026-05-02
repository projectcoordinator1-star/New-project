export async function ensureFaultUpdatesSchema(pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      create table if not exists qpms.fault_status_updates (
        ticket_number text primary key,
        status_note text,
        updated_at timestamptz not null default now()
      )
    `);

    // Check if the raw table exists before trying to update the view
    const tableCheck = await client.query(`
      select 1 from information_schema.tables 
      where table_schema = 'qpms_raw' 
      and table_name = 'IFMS Dashboard.xlsx - Fault Report'
    `);

    if (tableCheck.rows.length > 0) {
      await client.query(`
        create or replace view qpms_app.fault_report as
        select
          faults."Ticket Number" as ticket_number,
          faults."Created At" as created_at,
          coalesce(
            qpms_app.month_from_text(faults."Month"),
            qpms_app.month_from_text(faults."Created At"),
            case
              when fault_import.imported_date is not null and qpms_app.to_numeric_safe(faults."Ageing") is not null
                then to_char((fault_import.imported_date - (qpms_app.to_numeric_safe(faults."Ageing")::integer * interval '1 day'))::date, 'YYYY-MM')
              else null
            end,
            fault_import.import_month
          ) as month_key,
          faults."Store ID" as store_id,
          faults."Store Name" as store_name,
          coalesce(faults."State__2", faults."State") as state_group,
          faults."Address City" as city,
          faults."Status" as status,
          faults."Order Type" as order_type,
          faults."Criticality" as criticality,
          faults."Ageing" as ageing_text,
          qpms_app.to_numeric_safe(faults."Ageing") as ageing_days,
          faults."Breached Flag" as breached_flag,
          faults."Category" as category,
          faults."Sub Category" as sub_category,
          faults."Issue Type" as issue_type,
          faults."Issue Title" as issue_title,
          faults."Manager Name" as manager_name,
          faults."AFM Name" as afm_name,
          faults."MEPC Name" as mepc_name,
          faults."HK Supervisor Name" as hk_supervisor_name,
          faults."Format" as format_name,
          faults."Ageing(Days)" as ageing_bucket,
          fault_import.imported_date as report_date,
          fault_import.imported_date as as_of_date,
          fault_import.imported_at as imported_at,
          coalesce(updates.status_note, faults."Status__2") as status_note
        from qpms_raw."IFMS Dashboard.xlsx - Fault Report" faults
        left join qpms.fault_status_updates updates on updates.ticket_number = faults."Ticket Number"
        left join lateral (
          select
            imported_at,
            imported_at::date as imported_date,
            to_char(imported_at::date, 'YYYY-MM') as import_month
          from qpms_import.import_batch
          where source_name = 'IFMS Dashboard' or file_name = 'IFMS Dashboard.xlsx'
          order by imported_at desc
          limit 1
        ) fault_import on true;
      `);
    }
  } finally {
    client.release();
  }
}

export async function updateFaultStatus(pool, ticketNumber, statusNote) {
  const result = await pool.query(
    `
    insert into qpms.fault_status_updates (ticket_number, status_note, updated_at)
    values ($1, $2, now())
    on conflict (ticket_number)
    do update set
      status_note = excluded.status_note,
      updated_at = now()
    returning *
    `,
    [ticketNumber, statusNote]
  );
  return result.rows[0];
}
