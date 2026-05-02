create schema if not exists qpms;

create schema if not exists qpms_master;

create table if not exists qpms_master.stores (
  store_code text primary key,
  state text not null,
  server text,
  business text,
  status text
);

do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'qpms' and c.relname = 'store_master' and c.relkind = 'v'
  ) then
    execute '
      create or replace view qpms.store_master as
      select
        store_code as store_id,
        null::text as legacy_store_code,
        server as server_code,
        coalesce(nullif(business, ''''), store_code) as store_name,
        server as location,
        server as city,
        state as region,
        state as state_group,
        null::text as format_name,
        null::text as category_name,
        null::text as company_code,
        null::text as vendor_name,
        0::numeric as hk_aop_count,
        0::numeric as mepc_aop_count,
        null::date as opened_date,
        null::date as closed_date,
        coalesce(nullif(status, ''''), ''Active'') <> ''Inactive'' as is_active
      from qpms_master.stores
    ';
  elsif not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'qpms' and c.relname = 'store_master'
  ) then
    execute '
      create view qpms.store_master as
      select
        store_code as store_id,
        null::text as legacy_store_code,
        server as server_code,
        coalesce(nullif(business, ''''), store_code) as store_name,
        server as location,
        server as city,
        state as region,
        state as state_group,
        null::text as format_name,
        null::text as category_name,
        null::text as company_code,
        null::text as vendor_name,
        0::numeric as hk_aop_count,
        0::numeric as mepc_aop_count,
        null::date as opened_date,
        null::date as closed_date,
        coalesce(nullif(status, ''''), ''Active'') <> ''Inactive'' as is_active
      from qpms_master.stores
    ';
  end if;
end
$$;

create table if not exists qpms.technical_training_evidence (
  evidence_id bigserial primary key,
  state_name text not null,
  field_office text not null,
  store_id text,
  store_name text not null,
  title text not null,
  remarks text,
  image_path text,
  image_paths text[] not null default '{}',
  uploaded_at timestamptz not null default now(),
  uploaded_by_user_id bigint
);

alter table qpms.technical_training_evidence
  add column if not exists image_path text;

alter table qpms.technical_training_evidence
  add column if not exists image_paths text[] not null default '{}';

alter table qpms.technical_training_evidence
  alter column image_path drop not null;

update qpms.technical_training_evidence
set image_paths = array[image_path]
where image_path is not null
  and cardinality(coalesce(image_paths, '{}'::text[])) = 0;

create index if not exists idx_training_evidence_state on qpms.technical_training_evidence (state_name);
create index if not exists idx_training_evidence_field_office on qpms.technical_training_evidence (field_office);
create index if not exists idx_training_evidence_store on qpms.technical_training_evidence (store_id);
