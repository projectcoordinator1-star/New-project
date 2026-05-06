create schema if not exists qpms;
create extension if not exists citext;

create sequence if not exists qpms.it_hardware_ticket_number_seq;

create table if not exists qpms.it_employee (
  employee_id text primary key,
  full_name text not null,
  email citext not null unique,
  department text not null default 'Unassigned',
  designation text,
  office_location text,
  role_code text not null default 'EMPLOYEE' check (role_code in ('EMPLOYEE', 'IT', 'ADMIN', 'HR')),
  manager_email citext,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qpms.it_asset (
  asset_id text primary key,
  asset_tag text not null unique,
  category text not null,
  brand text,
  model text,
  serial_number text unique,
  asset_status text not null default 'Available' check (
    asset_status in ('Available', 'Reserved', 'Issued', 'In Use', 'Repair', 'Warranty', 'Retired', 'Lost')
  ),
  assigned_to_email citext,
  warranty_end date,
  purchase_date date,
  asset_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qpms.it_hardware_ticket (
  ticket_id bigserial primary key,
  ticket_number text not null unique,
  ticket_type text not null check (
    ticket_type in (
      'New Hardware Request',
      'Hardware Issued',
      'Hardware Return',
      'Repair Request',
      'Replacement Request',
      'Lost/Damaged Hardware',
      'Warranty Service'
    )
  ),
  ticket_status text not null default 'Requested' check (
    ticket_status in ('Requested', 'Approved', 'Issued', 'In Use', 'Repair Pending', 'Returned', 'Closed', 'Rejected')
  ),
  resolution_status text not null default 'Open',
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Urgent')),
  employee_id text references qpms.it_employee(employee_id),
  employee_name text not null,
  employee_email citext not null,
  department text,
  designation text,
  hardware_category text not null,
  asset_id text references qpms.it_asset(asset_id),
  subject text not null,
  description text not null,
  business_justification text,
  needed_by date,
  assigned_to_email citext,
  resolution_note text,
  created_by_email citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

create index if not exists idx_it_hardware_ticket_employee on qpms.it_hardware_ticket (employee_email);
create index if not exists idx_it_hardware_ticket_status on qpms.it_hardware_ticket (ticket_status);
create index if not exists idx_it_hardware_ticket_type on qpms.it_hardware_ticket (ticket_type);

create table if not exists qpms.it_ticket_audit_log (
  audit_id bigserial primary key,
  ticket_number text not null,
  action_name text not null,
  actor_email citext,
  details text,
  created_at timestamptz not null default now()
);

create table if not exists qpms.it_email_notification (
  email_id bigserial primary key,
  ticket_number text not null,
  event_type text not null,
  to_label text not null,
  cc_label text,
  email_status text not null default 'Queued',
  provider_response jsonb,
  created_at timestamptz not null default now()
);

create table if not exists qpms.it_employee_import_batch (
  import_batch_id bigserial primary key,
  imported_by_email citext,
  imported_count integer not null default 0,
  rejected_count integer not null default 0,
  source_name text not null default 'CSV',
  created_at timestamptz not null default now()
);

insert into qpms.it_employee (
  employee_id,
  full_name,
  email,
  department,
  designation,
  office_location,
  role_code,
  manager_email
)
values
  ('EMP-1001', 'Ananya Rao', 'ananya.rao@demo.qpms.local', 'Operations', 'Operations Executive', 'Chennai HQ', 'EMPLOYEE', 'meera.iyer@demo.qpms.local'),
  ('EMP-1002', 'Rahul Menon', 'rahul.menon@demo.qpms.local', 'Finance', 'Finance Analyst', 'Bengaluru Office', 'EMPLOYEE', 'meera.iyer@demo.qpms.local'),
  ('EMP-1003', 'Priya Nair', 'priya.nair@demo.qpms.local', 'Human Resources', 'HR Manager', 'Chennai HQ', 'HR', null),
  ('IT-2001', 'Karthik Srinivasan', 'karthik.srinivasan@demo.qpms.local', 'Information Technology', 'IT Support Lead', 'Chennai HQ', 'IT', 'admin.user@demo.qpms.local'),
  ('ADM-9001', 'Admin User', 'admin.user@demo.qpms.local', 'Management', 'System Administrator', 'Head Office', 'ADMIN', null)
on conflict (employee_id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  department = excluded.department,
  designation = excluded.designation,
  office_location = excluded.office_location,
  role_code = excluded.role_code,
  manager_email = excluded.manager_email,
  updated_at = now();

insert into qpms.it_asset (
  asset_id,
  asset_tag,
  category,
  brand,
  model,
  serial_number,
  asset_status,
  assigned_to_email,
  warranty_end,
  purchase_date,
  asset_location
)
values
  ('AST-LAP-001', 'QPMS-LAP-001', 'Laptop', 'Dell', 'Latitude 5440', 'DL5440QPMS001', 'In Use', 'ananya.rao@demo.qpms.local', '2027-08-15', '2024-08-15', 'Chennai HQ'),
  ('AST-LAP-002', 'QPMS-LAP-002', 'Laptop', 'HP', 'EliteBook 840', 'HP840QPMS002', 'Available', null, '2027-04-20', '2024-04-20', 'IT Store'),
  ('AST-MON-004', 'QPMS-MON-004', 'Monitor', 'LG', '24MP60G', 'LG24QPMS004', 'Available', null, '2026-12-01', '2023-12-01', 'IT Store'),
  ('AST-HEAD-008', 'QPMS-HEAD-008', 'Headset', 'Jabra', 'Evolve 20', 'JB20QPMS008', 'Repair', 'rahul.menon@demo.qpms.local', '2026-09-10', '2024-09-10', 'Bengaluru Office')
on conflict (asset_id) do update set
  asset_tag = excluded.asset_tag,
  category = excluded.category,
  brand = excluded.brand,
  model = excluded.model,
  serial_number = excluded.serial_number,
  asset_status = excluded.asset_status,
  assigned_to_email = excluded.assigned_to_email,
  warranty_end = excluded.warranty_end,
  purchase_date = excluded.purchase_date,
  asset_location = excluded.asset_location,
  updated_at = now();

insert into qpms.it_hardware_ticket (
  ticket_number,
  ticket_type,
  ticket_status,
  resolution_status,
  priority,
  employee_id,
  employee_name,
  employee_email,
  department,
  designation,
  hardware_category,
  asset_id,
  subject,
  description,
  business_justification,
  needed_by,
  assigned_to_email,
  resolution_note,
  created_by_email,
  created_at,
  updated_at
)
values
  (
    'HW-2026-0001',
    'New Hardware Request',
    'Requested',
    'Open',
    'High',
    'EMP-1002',
    'Rahul Menon',
    'rahul.menon@demo.qpms.local',
    'Finance',
    'Finance Analyst',
    'Laptop',
    null,
    'Laptop required for finance audit work',
    'Current shared desktop is not enough for audit field visits and spreadsheet review.',
    'Month-end audit team needs a portable device for client and store visits.',
    '2026-05-12',
    'karthik.srinivasan@demo.qpms.local',
    null,
    'rahul.menon@demo.qpms.local',
    '2026-05-03 09:20:00+00',
    '2026-05-03 09:20:00+00'
  ),
  (
    'HW-2026-0002',
    'Repair Request',
    'Repair Pending',
    'Open',
    'Medium',
    'EMP-1001',
    'Ananya Rao',
    'ananya.rao@demo.qpms.local',
    'Operations',
    'Operations Executive',
    'Laptop',
    'AST-LAP-001',
    'Laptop battery drains quickly',
    'Battery backup is below one hour and the device shuts down during reviews.',
    'Daily dashboard review calls require reliable laptop availability.',
    '2026-05-08',
    'karthik.srinivasan@demo.qpms.local',
    'Vendor warranty check initiated.',
    'ananya.rao@demo.qpms.local',
    '2026-05-02 10:45:00+00',
    '2026-05-04 11:30:00+00'
  )
on conflict (ticket_number) do nothing;
