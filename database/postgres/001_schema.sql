create schema if not exists qpms;
create extension if not exists citext;

create table if not exists qpms.team_master (
  team_id bigserial primary key,
  team_code text not null unique,
  team_name text not null,
  team_scope text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qpms.role_master (
  role_id bigserial primary key,
  role_code text not null unique,
  role_name text not null,
  role_scope text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qpms.app_user (
  user_id bigserial primary key,
  employee_code text unique,
  full_name text not null,
  email citext unique,
  mobile_no text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists qpms.user_role_assignment (
  user_role_assignment_id bigserial primary key,
  user_id bigint not null references qpms.app_user(user_id),
  team_id bigint not null references qpms.team_master(team_id),
  role_id bigint not null references qpms.role_master(role_id),
  effective_from date not null default current_date,
  effective_to date,
  unique (user_id, team_id, role_id, effective_from)
);

create table if not exists qpms.store_master (
  store_id text primary key,
  legacy_store_code text,
  server_code text,
  store_name text not null,
  location text,
  city text,
  region text,
  state_group text,
  format_name text,
  category_name text,
  company_code text,
  vendor_name text,
  hk_aop_count numeric(12, 2) not null default 0,
  mepc_aop_count numeric(12, 2) not null default 0,
  opened_date date,
  closed_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_store_master_region on qpms.store_master (region);
create index if not exists idx_store_master_state_group on qpms.store_master (state_group);

create table if not exists qpms.party_master (
  party_id bigserial primary key,
  party_type text not null check (party_type in ('VENDOR', 'BILL_TO', 'SHIP_TO', 'CLIENT')),
  party_name text not null,
  gstin text,
  state_name text,
  address_line text,
  contact_person text,
  mobile_no text,
  email_address text,
  created_at timestamptz not null default now()
);

create table if not exists qpms.store_party_link (
  store_party_link_id bigserial primary key,
  store_id text not null references qpms.store_master(store_id),
  bill_to_party_id bigint references qpms.party_master(party_id),
  ship_to_party_id bigint references qpms.party_master(party_id),
  vendor_party_id bigint references qpms.party_master(party_id),
  effective_from date not null default current_date,
  effective_to date,
  unique (store_id, effective_from)
);

create table if not exists qpms.manager_master (
  manager_id bigserial primary key,
  manager_code text unique,
  manager_name text not null,
  designation text,
  region text,
  state_group text,
  email citext,
  mobile_no text,
  created_at timestamptz not null default now()
);

create table if not exists qpms.employee_master (
  employee_id bigserial primary key,
  ep_no text not null unique,
  employee_name text not null,
  class_code text not null check (class_code in ('HK', 'MEPC', 'OTHER')),
  manager_id bigint references qpms.manager_master(manager_id),
  default_store_id text references qpms.store_master(store_id),
  state_group text,
  region text,
  joining_date date,
  relieving_date date,
  employment_status text not null default 'ACTIVE' check (employment_status in ('ACTIVE', 'INACTIVE', 'EXITED')),
  created_at timestamptz not null default now()
);

create table if not exists qpms.employee_store_assignment (
  employee_store_assignment_id bigserial primary key,
  employee_id bigint not null references qpms.employee_master(employee_id),
  store_id text not null references qpms.store_master(store_id),
  manager_id bigint references qpms.manager_master(manager_id),
  effective_from date not null,
  effective_to date,
  is_primary boolean not null default true,
  unique (employee_id, store_id, effective_from)
);

create table if not exists qpms.import_batch (
  import_batch_id bigserial primary key,
  batch_code text not null unique,
  source_type text not null check (
    source_type in ('STORE_ALLOCATION', 'ATTENDANCE_RAW', 'OVERALL_PENDING', 'IFMS_DASHBOARD', 'SERVICE_MASTER', 'MANUAL')
  ),
  batch_status text not null default 'RECEIVED' check (
    batch_status in ('RECEIVED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED')
  ),
  source_reference text,
  uploaded_by_user_id bigint references qpms.app_user(user_id),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  remarks text
);

create table if not exists qpms.import_file (
  import_file_id bigserial primary key,
  import_batch_id bigint not null references qpms.import_batch(import_batch_id) on delete cascade,
  file_name text not null,
  sheet_name text,
  row_count integer not null default 0,
  stored_path text,
  checksum_text text,
  processed_status text not null default 'PENDING' check (processed_status in ('PENDING', 'LOADED', 'FAILED')),
  created_at timestamptz not null default now()
);

create table if not exists qpms.import_row_issue (
  import_row_issue_id bigserial primary key,
  import_batch_id bigint not null references qpms.import_batch(import_batch_id) on delete cascade,
  source_sheet_name text,
  source_row_number integer,
  severity text not null check (severity in ('INFO', 'WARNING', 'ERROR')),
  issue_code text not null,
  issue_message text not null,
  raw_payload jsonb
);

create table if not exists qpms.attendance_status_map (
  raw_status text primary key,
  normalized_status text not null,
  attendance_value numeric(4, 2) not null,
  remarks text
);

create table if not exists qpms.attendance_raw_entry (
  attendance_raw_entry_id bigserial primary key,
  import_batch_id bigint references qpms.import_batch(import_batch_id),
  source_file_name text,
  source_sheet_name text,
  source_row_number integer,
  attendance_date date not null,
  ep_no text not null,
  employee_name text,
  site_code text,
  class_code text,
  raw_status text not null,
  raw_payload jsonb
);

create index if not exists idx_attendance_raw_entry_ep_date on qpms.attendance_raw_entry (ep_no, attendance_date);

create table if not exists qpms.attendance_processed_entry (
  attendance_processed_entry_id bigserial primary key,
  attendance_raw_entry_id bigint unique references qpms.attendance_raw_entry(attendance_raw_entry_id) on delete cascade,
  employee_id bigint references qpms.employee_master(employee_id),
  store_id text not null references qpms.store_master(store_id),
  manager_id bigint references qpms.manager_master(manager_id),
  attendance_date date not null,
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  class_code text not null,
  normalized_status text not null,
  attendance_value numeric(4, 2) not null,
  state_group text,
  region text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_processed_store_month on qpms.attendance_processed_entry (store_id, month_key);
create index if not exists idx_attendance_processed_state_date on qpms.attendance_processed_entry (state_group, attendance_date);

create table if not exists qpms.workflow_stage_master (
  stage_code text primary key,
  stage_order integer not null unique,
  stage_name text not null unique,
  owning_team_code text not null,
  is_terminal boolean not null default false
);

create table if not exists qpms.workflow_item (
  workflow_item_id bigserial primary key,
  workflow_type text not null check (workflow_type in ('FAULT', 'OL')),
  external_ticket_no text not null,
  store_id text not null references qpms.store_master(store_id),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  issue_title text not null,
  category text,
  sub_category text,
  current_stage_code text not null references qpms.workflow_stage_master(stage_code),
  current_status text,
  criticality text,
  breached_flag boolean not null default false,
  ageing_days integer not null default 0,
  source_system text not null default 'MANUAL',
  source_import_batch_id bigint references qpms.import_batch(import_batch_id),
  created_on date,
  closed_on date,
  assigned_to_user_id bigint references qpms.app_user(user_id),
  last_status_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_type, external_ticket_no)
);

create index if not exists idx_workflow_item_type_stage on qpms.workflow_item (workflow_type, current_stage_code);
create index if not exists idx_workflow_item_store_month on qpms.workflow_item (store_id, month_key);

create table if not exists qpms.workflow_status_history (
  workflow_status_history_id bigserial primary key,
  workflow_item_id bigint not null references qpms.workflow_item(workflow_item_id) on delete cascade,
  from_stage_code text references qpms.workflow_stage_master(stage_code),
  to_stage_code text not null references qpms.workflow_stage_master(stage_code),
  changed_by_user_id bigint references qpms.app_user(user_id),
  changed_by_team_code text,
  changed_at timestamptz not null default now(),
  status_note text
);

create table if not exists qpms.workflow_note (
  workflow_note_id bigserial primary key,
  workflow_item_id bigint not null references qpms.workflow_item(workflow_item_id) on delete cascade,
  note_scope text not null check (note_scope in ('FAULT_REMARK', 'MIS_NOTE', 'OPERATIONS_NOTE', 'FINANCE_NOTE', 'GENERAL')),
  note_text text not null,
  created_by_user_id bigint references qpms.app_user(user_id),
  created_at timestamptz not null default now()
);

create table if not exists qpms.thermography_inspection (
  thermography_inspection_id bigserial primary key,
  store_id text not null references qpms.store_master(store_id),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  schedule_date date,
  completion_date date,
  report_shared_date date,
  inspection_status text not null check (inspection_status in ('INSPECTED', 'NOT_INSPECTED')),
  days_pending integer not null default 0,
  source_import_batch_id bigint references qpms.import_batch(import_batch_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_thermography_store_month on qpms.thermography_inspection (store_id, month_key);

create table if not exists qpms.deep_cleaning_activity (
  deep_cleaning_activity_id bigserial primary key,
  store_id text not null references qpms.store_master(store_id),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  schedule_date date,
  completion_date date,
  activity_status text not null check (activity_status in ('COMPLETED', 'PENDING')),
  before_image_path text,
  after_image_path text,
  remarks text,
  source_import_batch_id bigint references qpms.import_batch(import_batch_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_cleaning_store_month on qpms.deep_cleaning_activity (store_id, month_key);

create table if not exists qpms.manpower_snapshot (
  manpower_snapshot_id bigserial primary key,
  store_id text not null references qpms.store_master(store_id),
  month_key text not null check (month_key ~ '^\d{4}-\d{2}$'),
  required_count numeric(12, 2) not null default 0,
  deployed_count numeric(12, 2) not null default 0,
  vacancy_count numeric(12, 2) not null default 0,
  source_import_batch_id bigint references qpms.import_batch(import_batch_id),
  created_at timestamptz not null default now(),
  unique (store_id, month_key)
);

create table if not exists qpms.uom_master (
  uom_code text primary key,
  uom_name text not null,
  quantity_mode text not null check (quantity_mode in ('INTEGER', 'DECIMAL', 'FIXED_ONE'))
);

create table if not exists qpms.service_master (
  service_master_id bigserial primary key,
  arc_no text,
  arc_line_no text,
  old_service_code text,
  new_service_code text,
  final_service_code text not null unique,
  hsn_sac text,
  short_text text not null,
  sap_description text not null,
  long_text text,
  uom_code text references qpms.uom_master(uom_code),
  rrl_benchmark_rate numeric(14, 2) not null default 0,
  approved_make_brand text,
  category_name text,
  remarks text,
  is_active boolean not null default true,
  source_import_batch_id bigint references qpms.import_batch(import_batch_id),
  created_at timestamptz not null default now()
);

create index if not exists idx_service_master_category on qpms.service_master (category_name);
create index if not exists idx_service_master_short_text on qpms.service_master using gin (to_tsvector('simple', coalesce(short_text, '') || ' ' || coalesce(long_text, '')));

create table if not exists qpms.quotation_header (
  quotation_id bigserial primary key,
  quotation_no text not null unique,
  quotation_date date not null,
  fm_fault_no text,
  fm_fault_date date,
  store_id text references qpms.store_master(store_id),
  vendor_party_id bigint references qpms.party_master(party_id),
  bill_to_party_id bigint references qpms.party_master(party_id),
  ship_to_party_id bigint references qpms.party_master(party_id),
  subject_line text not null,
  category_name text,
  total_base_amount numeric(14, 2) not null default 0,
  total_gst_amount numeric(14, 2) not null default 0,
  total_amount numeric(14, 2) not null default 0,
  total_amount_words text,
  payment_terms text,
  warranty_terms text,
  validity_days integer,
  quotation_status text not null default 'DRAFT' check (
    quotation_status in ('DRAFT', 'MIS_REVIEW', 'TN_HEAD_REVIEW', 'SENT_TO_CLIENT', 'CLIENT_APPROVED', 'FINANCE_PENDING', 'FUNDS_RAISED', 'WORK_STARTED', 'CLOSED')
  ),
  created_by_user_id bigint references qpms.app_user(user_id),
  approved_by_user_id bigint references qpms.app_user(user_id),
  sent_to_client_at timestamptz,
  client_approved_at timestamptz,
  finance_released_at timestamptz,
  work_started_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qpms.quotation_line (
  quotation_line_id bigserial primary key,
  quotation_id bigint not null references qpms.quotation_header(quotation_id) on delete cascade,
  line_no integer not null,
  service_master_id bigint references qpms.service_master(service_master_id),
  arc_no text,
  arc_line_no text,
  hsn_sac text,
  article_service_code text,
  short_text text not null,
  sap_description text not null,
  approved_make_brand text,
  model_text text,
  quantity numeric(14, 3) not null default 1,
  uom_code text references qpms.uom_master(uom_code),
  rate_amount numeric(14, 2) not null default 0,
  management_fee_pct numeric(7, 2) not null default 0,
  base_amount numeric(14, 2) not null default 0,
  gst_rate numeric(7, 2) not null default 18,
  sgst_amount numeric(14, 2) not null default 0,
  cgst_amount numeric(14, 2) not null default 0,
  igst_amount numeric(14, 2) not null default 0,
  total_gst_amount numeric(14, 2) not null default 0,
  total_including_amount numeric(14, 2) not null default 0,
  line_remark text,
  additional_remark text,
  unique (quotation_id, line_no)
);

create table if not exists qpms.quotation_status_history (
  quotation_status_history_id bigserial primary key,
  quotation_id bigint not null references qpms.quotation_header(quotation_id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by_user_id bigint references qpms.app_user(user_id),
  changed_at timestamptz not null default now(),
  comment_text text
);
