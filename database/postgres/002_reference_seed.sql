insert into qpms.team_master (team_code, team_name, team_scope)
values
  ('GROUND', 'Ground Team', 'Can upload and update field execution stages.'),
  ('MIS', 'MIS Team', 'Can validate, enrich, and submit operational and quotation data.'),
  ('OPS_FIN', 'Operations & Finance', 'Can complete commercial and finance stages.'),
  ('MGMT', 'Management', 'Read-only control tower access.')
on conflict (team_code) do update
set team_name = excluded.team_name,
    team_scope = excluded.team_scope;

insert into qpms.role_master (role_code, role_name, role_scope)
values
  ('SUPERVISOR', 'Supervisor', 'Field upload and line-item drafting'),
  ('MIS_EXEC', 'MIS Executive', 'Review, correction, and attendance/report processing'),
  ('TN_HEAD', 'TN Head', 'Approval and client communication'),
  ('FINANCE_EXEC', 'Finance Executive', 'Funds and invoice flow'),
  ('MANAGEMENT', 'Management', 'Read-only monitoring')
on conflict (role_code) do update
set role_name = excluded.role_name,
    role_scope = excluded.role_scope;

insert into qpms.workflow_stage_master (stage_code, stage_order, stage_name, owning_team_code, is_terminal)
values
  ('DRAFT_PO', 1, 'Draft PO', 'GROUND', false),
  ('WIP', 2, 'WIP', 'GROUND', false),
  ('WORK_COMPLETED', 3, 'Work Completed', 'GROUND', false),
  ('DOC_PENDING', 4, 'Work Completed Doc Pending', 'MIS', false),
  ('AFM_PENDING', 5, 'AFM Pending', 'MIS', false),
  ('CERT_SHARED', 6, 'Certification done- Document shared to Commercial for JMS', 'MIS', false),
  ('JMS_IN_PROGRESS', 7, 'JMS In progress', 'MIS', false),
  ('INVOICE_PROCESSED', 8, 'Invoice Processed', 'OPS_FIN', false),
  ('PAYMENT_RECEIVED', 9, 'Payment Received From client', 'OPS_FIN', true),
  ('PO_DELETED', 10, 'PO Deleted', 'OPS_FIN', true),
  ('NEED_TO_DELETE', 11, 'Need To Delete', 'OPS_FIN', true)
on conflict (stage_code) do update
set stage_order = excluded.stage_order,
    stage_name = excluded.stage_name,
    owning_team_code = excluded.owning_team_code,
    is_terminal = excluded.is_terminal;

insert into qpms.attendance_status_map (raw_status, normalized_status, attendance_value, remarks)
values
  ('A', 'ABSENT', 0, 'Absent'),
  ('NO-SHOW', 'ABSENT', 0, 'No show'),
  ('T', 'ABSENT', 0, 'Temporary absent'),
  ('H', 'ABSENT', 0, 'Holiday / zero credit as per current rule'),
  ('H-P', 'PRESENT', 1, 'Half presence variant treated as present in current rule'),
  ('P', 'PRESENT', 1, 'Present'),
  ('W', 'PRESENT', 1, 'Week off credit'),
  ('WO', 'PRESENT', 1, 'Week off credit'),
  ('WO-P', 'PRESENT', 1, 'Week off present'),
  ('HD', 'HALF_DAY', 0.5, 'Half day'),
  ('H-HD', 'HALF_DAY', 0.5, 'Half day variant')
on conflict (raw_status) do update
set normalized_status = excluded.normalized_status,
    attendance_value = excluded.attendance_value,
    remarks = excluded.remarks;

insert into qpms.uom_master (uom_code, uom_name, quantity_mode)
values
  ('CCM', 'cubic cm', 'DECIMAL'),
  ('CUM', 'Cubic Meter', 'DECIMAL'),
  ('EA', 'each', 'INTEGER'),
  ('FT', 'feet', 'DECIMAL'),
  ('FT2', 'sq feet', 'DECIMAL'),
  ('HR', 'hours', 'DECIMAL'),
  ('KG', 'kg', 'DECIMAL'),
  ('L', 'liter', 'DECIMAL'),
  ('LS', 'lumpsum', 'FIXED_ONE'),
  ('LTRS', 'liters', 'DECIMAL'),
  ('M', 'meter', 'DECIMAL'),
  ('M2', 'sq meter', 'DECIMAL'),
  ('M3', 'Cubic Meter', 'DECIMAL'),
  ('MDY', 'mandays', 'DECIMAL'),
  ('MON', 'monthly', 'DECIMAL'),
  ('MT', 'Metric Ton', 'DECIMAL'),
  ('NOS', 'No', 'INTEGER'),
  ('PAC', 'Packet', 'INTEGER'),
  ('RFT', 'running ft', 'DECIMAL'),
  ('RMT', 'running meter', 'DECIMAL'),
  ('SET', 'Set', 'INTEGER'),
  ('SQM', 'Sq Meter', 'DECIMAL'),
  ('ST', 'Set', 'INTEGER'),
  ('TRP', 'Trip', 'INTEGER')
on conflict (uom_code) do update
set uom_name = excluded.uom_name,
    quantity_mode = excluded.quantity_mode;
