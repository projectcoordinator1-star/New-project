const SCHEMA = "qpms";
const TABLE = "deep_cleaning_evidence";
const MAX_DEEP_CLEANING_IMAGES = 5;

let schemaReadyPromise = null;

export function ensureDeepCleaningEvidenceSchema(pool) {
  if (!schemaReadyPromise) {
    schemaReadyPromise = pool.query(`
      create schema if not exists ${SCHEMA};

      create table if not exists ${SCHEMA}.${TABLE} (
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

      create index if not exists idx_deep_cleaning_evidence_store on ${SCHEMA}.${TABLE} (store_id);
      create index if not exists idx_deep_cleaning_evidence_month on ${SCHEMA}.${TABLE} (month_key);
      create index if not exists idx_deep_cleaning_evidence_state on ${SCHEMA}.${TABLE} (state_name);
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
}

export async function fetchDeepCleaningEvidence(pool, searchParams) {
  await ensureDeepCleaningEvidenceSchema(pool);

  const month = searchParams.get("month");
  const storeId = searchParams.get("storeId");
  const state = searchParams.get("state");

  const clauses = [];
  const values = [];

  if (month && month !== "ALL_MONTHS" && month !== "All") {
    values.push(month);
    clauses.push(`month_key = $${values.length}`);
  }

  if (storeId && storeId !== "All") {
    values.push(storeId);
    clauses.push(`store_id = $${values.length}`);
  }

  if (state && state !== "All") {
    values.push(state);
    clauses.push(`state_name = $${values.length}`);
  }

  const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const result = await pool.query(
    `
      select
        evidence_id,
        store_id,
        store_name,
        state_name,
        location,
        month_key,
        before_image_paths,
        after_image_paths,
        remarks,
        uploaded_at
      from ${SCHEMA}.${TABLE}
      ${whereSql}
      order by uploaded_at desc
    `,
    values,
  );

  return {
    ok: true,
    data: result.rows,
  };
}

export async function createDeepCleaningEvidence(pool, payload) {
  await ensureDeepCleaningEvidenceSchema(pool);

  const beforeImagePaths = Array.isArray(payload.beforeImagePaths)
    ? payload.beforeImagePaths.filter(Boolean).slice(0, MAX_DEEP_CLEANING_IMAGES)
    : [];
  const afterImagePaths = Array.isArray(payload.afterImagePaths)
    ? payload.afterImagePaths.filter(Boolean).slice(0, MAX_DEEP_CLEANING_IMAGES)
    : [];

  if (beforeImagePaths.length === 0 || afterImagePaths.length === 0) {
    const error = new Error("Please upload at least one before image and one after image");
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
      insert into ${SCHEMA}.${TABLE} (
        store_id,
        store_name,
        state_name,
        location,
        month_key,
        before_image_paths,
        after_image_paths,
        remarks
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning evidence_id, uploaded_at
    `,
    [
      payload.storeId,
      payload.storeName,
      payload.stateName,
      payload.location,
      payload.monthKey,
      beforeImagePaths,
      afterImagePaths,
      payload.remarks || "",
    ],
  );

  return {
    ok: true,
    evidenceId: result.rows[0].evidence_id,
    uploadedAt: result.rows[0].uploaded_at,
  };
}

export async function deleteDeepCleaningEvidence(pool, evidenceId) {
  await ensureDeepCleaningEvidenceSchema(pool);

  const result = await pool.query(
    `
      delete from ${SCHEMA}.${TABLE}
      where evidence_id = $1
      returning before_image_paths, after_image_paths
    `,
    [evidenceId],
  );

  if (result.rowCount === 0) {
    const error = new Error("Deep cleaning evidence not found");
    error.statusCode = 404;
    throw error;
  }

  return {
    ok: true,
    imagePaths: [...(result.rows[0].before_image_paths || []), ...(result.rows[0].after_image_paths || [])],
  };
}
