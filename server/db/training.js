const SCHEMA = "qpms";
const TABLE = "technical_training_evidence";
const MAX_TRAINING_IMAGES = 5;

let schemaReadyPromise = null;

export function ensureTrainingSchema(pool) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      create schema if not exists ${SCHEMA};

      create table if not exists ${SCHEMA}.${TABLE} (
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
          where n.nspname = '${SCHEMA}' and c.relname = 'store_master' and c.relkind = 'v'
        ) then
          execute '
            create or replace view ${SCHEMA}.store_master as
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
          where n.nspname = '${SCHEMA}' and c.relname = 'store_master'
        ) then
          execute '
            create view ${SCHEMA}.store_master as
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

      alter table ${SCHEMA}.${TABLE}
        add column if not exists image_path text;

      alter table ${SCHEMA}.${TABLE}
        add column if not exists image_paths text[] not null default '{}';

      alter table ${SCHEMA}.${TABLE}
        add column if not exists uploaded_by_user_id bigint;

      alter table ${SCHEMA}.${TABLE}
        alter column image_path drop not null;

      update ${SCHEMA}.${TABLE}
      set image_paths = array[image_path]
      where image_path is not null
        and cardinality(coalesce(image_paths, '{}'::text[])) = 0;

      create index if not exists idx_training_evidence_state on ${SCHEMA}.${TABLE} (state_name);
      create index if not exists idx_training_evidence_field_office on ${SCHEMA}.${TABLE} (field_office);
      create index if not exists idx_training_evidence_store on ${SCHEMA}.${TABLE} (store_id);
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
}

export async function fetchTrainingEvidence(pool, searchParams) {
  await ensureTrainingSchema(pool);

  const state = searchParams.get("state");
  const fieldOffice = searchParams.get("fieldOffice");
  const storeId = searchParams.get("storeId");

  const clauses = [];
  const values = [];

  if (state && state !== "All") {
    values.push(state);
    clauses.push(`state_name = $${values.length}`);
  }

  if (fieldOffice && fieldOffice !== "All") {
    values.push(fieldOffice);
    clauses.push(`field_office = $${values.length}`);
  }

  if (storeId && storeId !== "All") {
    values.push(storeId);
    clauses.push(`store_id = $${values.length}`);
  }

  const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const query = `
    select 
      evidence_id,
      state_name,
      field_office,
      store_id,
      store_name,
      title,
      remarks,
      coalesce(image_path, image_paths[1]) as image_path,
      case
        when cardinality(coalesce(image_paths, '{}'::text[])) > 0 then image_paths
        when image_path is not null then array[image_path]
        else '{}'::text[]
      end as image_paths,
      uploaded_at
    from ${SCHEMA}.${TABLE}
    ${whereSql}
    order by uploaded_at desc
  `;

  const result = await pool.query(query, values);
  return {
    ok: true,
    data: result.rows,
  };
}

export async function fetchTrainingFormOptions(pool) {
  await ensureTrainingSchema(pool);

  const query = `
    select 
      store_code as store_id,
      coalesce(nullif(business, ''), store_code) as store_name,
      server as location,
      server as city,
      state as region,
      state as state_name,
      null::text as format_name,
      server as server_code,
      status
    from qpms_master.stores
    where coalesce(nullif(status, ''), 'Active') <> 'Inactive'
    order by state nulls last, store_code
  `;
  const result = await pool.query(query);
  return {
    ok: true,
    data: result.rows,
  };
}

export async function createTrainingEvidence(pool, payload) {
  await ensureTrainingSchema(pool);

  const { stateName, fieldOffice, storeId, storeName, title, remarks } = payload;
  const imagePaths = Array.isArray(payload.imagePaths)
    ? payload.imagePaths.filter(Boolean).slice(0, MAX_TRAINING_IMAGES)
    : [payload.imagePath].filter(Boolean);

  if (imagePaths.length === 0) {
    throw new Error("At least one training image is required");
  }

  const query = `
    insert into ${SCHEMA}.${TABLE} (
      state_name,
      field_office,
      store_id,
      store_name,
      title,
      remarks,
      image_path,
      image_paths
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
    returning evidence_id, uploaded_at
  `;

  const values = [stateName, fieldOffice, storeId, storeName, title, remarks, imagePaths[0], imagePaths];
  const result = await pool.query(query, values);

  return {
    ok: true,
    evidenceId: result.rows[0].evidence_id,
    uploadedAt: result.rows[0].uploaded_at,
  };
}

export async function deleteTrainingEvidence(pool, evidenceId) {
  await ensureTrainingSchema(pool);

  const query = `
    delete from ${SCHEMA}.${TABLE}
    where evidence_id = $1
    returning image_path, image_paths
  `;

  const result = await pool.query(query, [evidenceId]);

  if (result.rowCount === 0) {
    throw new Error("Evidence not found");
  }

  return {
    ok: true,
    imagePath: result.rows[0].image_path,
    imagePaths:
      result.rows[0].image_paths && result.rows[0].image_paths.length > 0
        ? result.rows[0].image_paths
        : [result.rows[0].image_path].filter(Boolean),
  };
}
