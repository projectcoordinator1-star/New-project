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

create or replace function qpms_app.month_from_text(value text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(value, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
      then substring(value from 1 for 7)
    when coalesce(value, '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{2}$'
      then to_char(to_date(value, 'MM/DD/YY'), 'YYYY-MM')
    when coalesce(value, '') ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
      then to_char(to_date(value, 'MM/DD/YYYY'), 'YYYY-MM')
    when coalesce(value, '') ~ '^[0-9]{2}-[0-9]{2}-[0-9]{4}'
      then to_char(to_date(substring(value from 1 for 10), 'DD-MM-YYYY'), 'YYYY-MM')
    when coalesce(value, '') ~ '^[A-Za-z]{3}-[0-9]{4}$'
      then to_char(to_date('01-' || value, 'DD-Mon-YYYY'), 'YYYY-MM')
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

create or replace view qpms_app.fault_report as
select
  "Ticket Number" as ticket_number,
  "Created At" as created_at,
  coalesce(qpms_app.month_from_text("Month"), qpms_app.month_from_text("Created At")) as month_key,
  "Store ID" as store_id,
  "Store Name" as store_name,
  coalesce("State__2", "State") as state_group,
  "Address City" as city,
  "Status" as status,
  "Order Type" as order_type,
  "Criticality" as criticality,
  "Ageing" as ageing_text,
  qpms_app.to_numeric_safe("Ageing") as ageing_days,
  "Breached Flag" as breached_flag,
  "Category" as category,
  "Sub Category" as sub_category,
  "Issue Type" as issue_type,
  "Issue Title" as issue_title,
  "Manager Name" as manager_name,
  "AFM Name" as afm_name,
  "MEPC Name" as mepc_name,
  "HK Supervisor Name" as hk_supervisor_name,
  "Format" as format_name,
  "Ageing(Days)" as ageing_bucket
from qpms_raw."IFMS Dashboard.xlsx - Fault Report";

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
