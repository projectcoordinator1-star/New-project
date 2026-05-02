create schema if not exists qpms_app;

create or replace function qpms_app.to_numeric_safe(value text)
returns numeric
language sql
immutable
as $$
  select case
    when regexp_replace(coalesce(value, ''), '[^0-9.\-]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
      then regexp_replace(coalesce(value, ''), '[^0-9.\-]', '', 'g')::numeric
    else null
  end
$$;

create or replace function qpms_app.date_from_text(value text)
returns date
language sql
immutable
as $$
  select case
    when coalesce(value, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then substring(value from 1 for 10)::date
    when coalesce(value, '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}$'
      then to_date(value, 'MM/DD/YY')
    when coalesce(value, '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
      then to_date(value, 'MM/DD/YYYY')
    when coalesce(value, '') ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}'
      then to_date(substring(value from 1 for 10), 'DD-MM-YYYY')
    when coalesce(value, '') ~ '^[A-Za-z]{3}-[0-9]{4}$'
      then to_date('01-' || value, 'DD-Mon-YYYY')
    else null
  end
$$;

create or replace function qpms_app.month_from_text(value text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(value, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then substring(value from 1 for 7)
    when qpms_app.date_from_text(value) is not null
      then to_char(qpms_app.date_from_text(value), 'YYYY-MM')
    else null
  end
$$;

create or replace view qpms_app.store_master as
select distinct on (store_id)
  store_id,
  store_name,
  state_group,
  location,
  format_name,
  source_table
from (
  select
    nullif(trim("Site Code"), '') as store_id,
    nullif(trim("Site Name"), '') as store_name,
    nullif(trim("STATE"), '') as state_group,
    nullif(trim("STATE"), '') as location,
    nullif(trim("Category"), '') as format_name,
    'M-here BASE' as source_table
  from qpms_raw."IFMS Dashboard.xlsx - M-here BASE"
  union all
  select
    nullif(trim("Store ID"), '') as store_id,
    nullif(trim("Store Name"), '') as store_name,
    coalesce(nullif(trim("State__2"), ''), nullif(trim("State"), '')) as state_group,
    coalesce(nullif(trim("Address City"), ''), nullif(trim("State"), '')) as location,
    nullif(trim("Format"), '') as format_name,
    'Fault Report' as source_table
  from qpms_raw."IFMS Dashboard.xlsx - Fault Report"
  union all
  select
    nullif(trim("Store code"), '') as store_id,
    nullif(trim("Store Name"), '') as store_name,
    nullif(trim("State"), '') as state_group,
    nullif(trim("State"), '') as location,
    nullif(trim("Format"), '') as format_name,
    'CMPM' as source_table
  from qpms_raw."IFMS Dashboard.xlsx - CMPM"
  union all
  select
    nullif(trim("Store code"), '') as store_id,
    nullif(trim("Store Name"), '') as store_name,
    nullif(trim("State"), '') as state_group,
    nullif(trim("State"), '') as location,
    null as format_name,
    'Thermography' as source_table
  from qpms_raw."IFMS Dashboard.xlsx - Thermography"
  union all
  select
    nullif(trim("Store code"), '') as store_id,
    nullif(trim("Store Name"), '') as store_name,
    nullif(trim("State"), '') as state_group,
    nullif(trim("State"), '') as location,
    null as format_name,
    'Deep cleaning Activity' as source_table
  from qpms_raw."IFMS Dashboard.xlsx - Deep cleaning Activity"
  union all
  select
    nullif(trim("Store code"), '') as store_id,
    nullif(trim("Store code"), '') as store_name,
    nullif(trim("State"), '') as state_group,
    nullif(trim("State"), '') as location,
    null as format_name,
    'Split Server' as source_table
  from qpms_raw."IFMS Dashboard.xlsx - Split Server"
) stores
where store_id is not null
order by store_id, store_name nulls last;

create or replace view qpms_app.attendance_raw as
select
  "EP No" as ep_no,
  "EP Name" as employee_name,
  "Manager Name" as manager_name,
  "Manager EC No" as manager_code,
  "Site Code" as store_id,
  "Site Name" as store_name,
  "STATE" as state_group,
  "Class" as class_code,
  "Att. Date" as attendance_date,
  qpms_app.month_from_text("Att. Date") as month_key,
  "Att. Status" as raw_status,
  coalesce(qpms_app.to_numeric_safe("Att. Status"), 0) as attendance_value,
  "In Time" as in_time,
  "Out Time" as out_time,
  "Man Hours" as man_hours
from qpms_raw."IFMS Dashboard.xlsx - M-here BASE";

create or replace view qpms_app.attendance_summary_state as
select
  month_key,
  state_group,
  class_code,
  count(*) as row_count,
  sum(attendance_value) as mandays
from qpms_app.attendance_raw
where month_key is not null
group by month_key, state_group, class_code;

create or replace view qpms_app.attendance_store_month_summary as
select
  store_id,
  store_name,
  state_group,
  month_key,
  count(*) as total_rows,
  sum(case when attendance_value > 0 then 1 else 0 end) as present_rows,
  count(distinct ep_no) as employee_count,
  sum(attendance_value) as mandays
from qpms_app.attendance_raw
where month_key is not null
group by store_id, store_name, state_group, month_key;

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
  from qpms_import.import_sheet
  where raw_table_name = 'IFMS Dashboard.xlsx - Fault Report'
  order by imported_at desc
  limit 1
) fault_import on true;

create or replace view qpms_app.ol_split_server as
select
  concat_ws('-', nullif("PO Number", ''), nullif("Item", '')) as ol_item_key,
  "Server" as server,
  "WBS Element" as wbs_element,
  "PO Date" as po_date,
  qpms_app.month_from_text("PO Date") as month_key,
  "Delivery Date" as delivery_date,
  "Company" as company,
  "Vendor" as vendor_code,
  "Vendor Name" as vendor_name,
  "PO Number" as po_number,
  "Item" as item_no,
  "Site" as site,
  "Store code" as store_id,
  "State" as state_group,
  "Article" as article,
  "Article Description" as article_description,
  "HSN/SAC Code" as hsn_sac_code,
  "UOM" as uom,
  "DLV.CMPL.IND" as delivery_complete_indicator,
  "Release Indicator" as release_indicator,
  "Doc Type" as doc_type,
  qpms_app.to_numeric_safe("Price") as price,
  qpms_app.to_numeric_safe("Quantity") as quantity,
  qpms_app.to_numeric_safe("Gross Amount") as gross_amount,
  qpms_app.to_numeric_safe("GRN Value") as grn_value,
  qpms_app.to_numeric_safe("IV Value") as invoice_value,
  "Remark" as remark,
  "Aditional Remark" as additional_remark,
  "Setoff Status" as setoff_status
from qpms_raw."IFMS Dashboard.xlsx - Split Server";

create or replace view qpms_app.ol_store_month_summary as
select
  store_id,
  store_name,
  state_group,
  month_key,
  sum(case when is_closed_stage then 0 else 1 end)::int as open_jobs,
  sum(
    case
      when is_closed_stage or po_date_value is null or current_date - po_date_value <= 30 then 0
      else 1
    end
  )::int as overdue_jobs,
  to_char(max(po_date_value), 'YYYY-MM-DD') as last_raised_date
from (
  select
    store_id,
    site as store_name,
    state_group,
    month_key,
    qpms_app.date_from_text(po_date) as po_date_value,
    case
      when stage_text like '%NEED TO DELETE%' or stage_text like '%PO TO BE DELETE%' then true
      when stage_text like '%PO DELETED%' then true
      when stage_text like '%PAYMENT RECEIVED%' then true
      else false
    end as is_closed_stage
  from (
    select
      store_id,
      site,
      state_group,
      month_key,
      po_date,
      concat_ws(
        ' | ',
        nullif(upper(coalesce(remark, '')), ''),
        nullif(upper(coalesce(additional_remark, '')), ''),
        nullif(upper(coalesce(setoff_status, '')), '')
      ) as stage_text
    from qpms_app.ol_split_server
  ) ol_rows
) grouped_rows
where store_id is not null
  and month_key is not null
group by store_id, store_name, state_group, month_key;

create or replace view qpms_app.cmpm_report as
select
  "S.No" as serial_no,
  "State" as state_group,
  "Store code" as store_id,
  "Store Name" as store_name,
  "Format" as format_name,
  "CM Task" as cm_task,
  "PM Status" as pm_status,
  "Remarks" as remarks,
  case when upper(coalesce("CM Task", '')) like '%COMPLETED%' then 1 else 0 end as cm_completed,
  case when upper(coalesce("PM Status", '')) like '%COMPLETED%' then 1 else 0 end as pm_completed,
  case when coalesce("CM Task", '') <> '' and upper(coalesce("CM Task", '')) not like '%COMPLETED%' then 1 else 0 end as cm_pending,
  case when coalesce("PM Status", '') <> '' and upper(coalesce("PM Status", '')) not like '%COMPLETED%' then 1 else 0 end as pm_pending,
  1 as record_count
from qpms_raw."IFMS Dashboard.xlsx - CMPM";

create or replace view qpms_app.thermography_report as
select
  "S.No" as serial_no,
  "State" as state_group,
  "Store code" as store_id,
  "Store Name" as store_name,
  "Schedule date" as schedule_date,
  "Completion date" as completion_date,
  "Report Status" as report_status,
  "Report Shared Date" as report_shared_date,
  case
    when upper(coalesce("Completion date", '')) like '%COMPLETED%' or nullif("Report Shared Date", '') is not null then 'Inspected'
    else 'Not Inspected'
  end as inspection_status
from qpms_raw."IFMS Dashboard.xlsx - Thermography";

create or replace view qpms_app.deep_cleaning_report as
select
  "S.No" as serial_no,
  "State" as state_group,
  "Store code" as store_id,
  "Store Name" as store_name,
  "Frequency" as frequency,
  "Schedule date" as schedule_date,
  "Completion date" as completion_date,
  "Remark" as remark,
  case when nullif("Completion date", '') is not null then 'Completed' else 'Pending' end as cleaning_status
from qpms_raw."IFMS Dashboard.xlsx - Deep cleaning Activity";

create or replace view qpms_app.manpower_vacancy as
select
  "S.No" as serial_no,
  "State" as state_group,
  "Store code" as store_id,
  "Position" as position_name,
  qpms_app.to_numeric_safe("Vacant Count") as vacant_count,
  "Vacant from" as vacant_from,
  "Remark" as remark
from qpms_raw."IFMS Dashboard.xlsx - Manpower Vacancy";

create or replace view qpms_app.data_sync_health as
select
  b.import_batch_id,
  b.source_name,
  b.file_name,
  b.sheet_count,
  b.row_count,
  b.imported_at,
  s.raw_table_name,
  s.sheet_name,
  s.row_count as sheet_row_count,
  s.column_count
from qpms_import.import_batch b
left join qpms_import.import_sheet s on s.import_batch_id = b.import_batch_id;
