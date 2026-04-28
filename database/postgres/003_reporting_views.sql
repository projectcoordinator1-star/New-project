create or replace view qpms.v_attendance_daily_summary as
select
  attendance_date,
  month_key,
  state_group,
  class_code,
  count(*) as employee_rows,
  sum(attendance_value) as mandays
from qpms.attendance_processed_entry
group by attendance_date, month_key, state_group, class_code;

create or replace view qpms.v_attendance_month_to_date_summary as
select
  month_key,
  state_group,
  sum(case when class_code = 'HK' then attendance_value else 0 end) as hk_mandays,
  sum(case when class_code = 'MEPC' then attendance_value else 0 end) as mepc_mandays,
  sum(attendance_value) as total_mandays
from qpms.attendance_processed_entry
group by month_key, state_group;

create or replace view qpms.v_workflow_stage_ageing as
select
  workflow_type,
  month_key,
  current_stage_code,
  count(*) as item_count,
  sum(case when breached_flag then 1 else 0 end) as breached_count,
  avg(ageing_days)::numeric(12, 2) as avg_ageing_days,
  max(ageing_days) as max_ageing_days
from qpms.workflow_item
group by workflow_type, month_key, current_stage_code;

create or replace view qpms.v_store_unified_snapshot as
with latest_attendance as (
  select distinct on (store_id)
    store_id,
    month_key,
    count(*) as attendance_rows,
    sum(attendance_value)::numeric(12, 2) as total_attendance_value
  from qpms.attendance_processed_entry
  group by store_id, month_key
  order by store_id, month_key desc
),
latest_manpower as (
  select distinct on (store_id)
    store_id,
    month_key,
    required_count,
    deployed_count,
    vacancy_count
  from qpms.manpower_snapshot
  order by store_id, month_key desc
),
latest_thermography as (
  select distinct on (store_id)
    store_id,
    month_key,
    inspection_status,
    days_pending
  from qpms.thermography_inspection
  order by store_id, month_key desc
),
latest_cleaning as (
  select distinct on (store_id)
    store_id,
    month_key,
    activity_status,
    completion_date
  from qpms.deep_cleaning_activity
  order by store_id, month_key desc
),
workflow_rollup as (
  select
    store_id,
    sum(case when workflow_type = 'FAULT' then 1 else 0 end) as total_faults,
    sum(case when workflow_type = 'FAULT' and breached_flag then 1 else 0 end) as breached_faults,
    sum(case when workflow_type = 'OL' then 1 else 0 end) as total_ol_jobs,
    sum(case when workflow_type = 'OL' and breached_flag then 1 else 0 end) as breached_ol_jobs
  from qpms.workflow_item
  group by store_id
)
select
  s.store_id,
  s.store_name,
  s.location,
  s.city,
  s.region,
  s.state_group,
  s.format_name,
  s.company_code,
  s.hk_aop_count,
  s.mepc_aop_count,
  coalesce(a.month_key, m.month_key, t.month_key, c.month_key) as latest_month_key,
  coalesce(a.attendance_rows, 0) as attendance_rows,
  coalesce(a.total_attendance_value, 0) as total_attendance_value,
  coalesce(w.total_faults, 0) as total_faults,
  coalesce(w.breached_faults, 0) as breached_faults,
  coalesce(w.total_ol_jobs, 0) as total_ol_jobs,
  coalesce(w.breached_ol_jobs, 0) as breached_ol_jobs,
  coalesce(m.required_count, 0) as required_count,
  coalesce(m.deployed_count, 0) as deployed_count,
  coalesce(m.vacancy_count, 0) as vacancy_count,
  t.inspection_status,
  t.days_pending as thermography_days_pending,
  c.activity_status as latest_cleaning_status,
  c.completion_date as latest_cleaning_completion_date
from qpms.store_master s
left join latest_attendance a on a.store_id = s.store_id
left join latest_manpower m on m.store_id = s.store_id
left join latest_thermography t on t.store_id = s.store_id
left join latest_cleaning c on c.store_id = s.store_id
left join workflow_rollup w on w.store_id = s.store_id;

create or replace view qpms.v_data_sync_health as
select
  b.import_batch_id,
  b.batch_code,
  b.source_type,
  b.batch_status,
  b.received_at,
  b.processed_at,
  round(extract(epoch from (now() - coalesce(b.processed_at, b.received_at))) / 3600.0, 2) as freshness_hours,
  count(f.import_file_id) as file_count,
  coalesce(sum(case when f.processed_status = 'FAILED' then 1 else 0 end), 0) as failed_file_count,
  coalesce(count(i.import_row_issue_id), 0) as issue_count
from qpms.import_batch b
left join qpms.import_file f on f.import_batch_id = b.import_batch_id
left join qpms.import_row_issue i on i.import_batch_id = b.import_batch_id
group by
  b.import_batch_id,
  b.batch_code,
  b.source_type,
  b.batch_status,
  b.received_at,
  b.processed_at;
