create schema if not exists qpms;

create table if not exists qpms.deep_cleaning_evidence (
  evidence_id bigserial primary key,
  store_id text not null,
  store_name text not null,
  state_name text,
  location text,
  month_key text,
  before_image_paths text[] not null default '{}',
  after_image_paths text[] not null default '{}',
  remarks text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_deep_cleaning_evidence_store on qpms.deep_cleaning_evidence (store_id);
create index if not exists idx_deep_cleaning_evidence_month on qpms.deep_cleaning_evidence (month_key);
create index if not exists idx_deep_cleaning_evidence_state on qpms.deep_cleaning_evidence (state_name);
