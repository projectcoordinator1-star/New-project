const VALID_STATES = new Set(["AP-1", "AP-2", "KL", "KN", "TG", "TN"]);
const VALID_STATUSES = new Set(["Active", "Inactive"]);

function clean(value) {
  return String(value ?? "").trim();
}

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function normalizeStatus(value) {
  const text = clean(value).toLowerCase();
  return text === "inactive" || text === "deactivated" ? "Inactive" : "Active";
}

function normalizeStorePayload(payload = {}) {
  const store = {
    store_code: clean(payload.storeCode || payload.store_code),
    state: clean(payload.state).toUpperCase(),
    server: clean(payload.server),
    business: clean(payload.business),
    status: normalizeStatus(payload.status),
  };

  if (!store.store_code) {
    throw badRequest("Store code is required.");
  }

  if (!VALID_STATES.has(store.state)) {
    throw badRequest(`State must be one of: ${[...VALID_STATES].join(", ")}.`);
  }

  if (!VALID_STATUSES.has(store.status)) {
    throw badRequest("Status must be Active or Inactive.");
  }

  return store;
}

async function ensureStoreTable(pool) {
  await pool.query("create schema if not exists qpms_master");
  await pool.query(`
    create table if not exists qpms_master.stores (
      store_code text primary key,
      state text not null,
      server text,
      business text,
      status text
    )
  `);
}

export async function createMasterStore(pool, payload) {
  await ensureStoreTable(pool);
  const store = normalizeStorePayload(payload);

  try {
    const result = await pool.query(
      `
        insert into qpms_master.stores (store_code, state, server, business, status)
        values ($1, $2, $3, $4, $5)
        returning store_code, state, server, business, status
      `,
      [store.store_code, store.state, store.server, store.business, store.status],
    );

    return {
      ok: true,
      store: result.rows[0],
    };
  } catch (error) {
    if (error.code === "23505") {
      const duplicateError = new Error(`Store code ${store.store_code} already exists.`);
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
}

export async function updateMasterStoreStatus(pool, storeCode, payload) {
  await ensureStoreTable(pool);
  const normalizedStoreCode = clean(storeCode);
  const rawStatus = clean(payload?.status);
  const status = rawStatus ? normalizeStatus(rawStatus) : "";

  if (!normalizedStoreCode) {
    throw badRequest("Store code is required.");
  }

  if (!status || !VALID_STATUSES.has(status)) {
    throw badRequest("Status must be Active or Inactive.");
  }

  const result = await pool.query(
    `
      update qpms_master.stores
      set status = $2
      where store_code = $1
      returning store_code, state, server, business, status
    `,
    [normalizedStoreCode, status],
  );

  if (!result.rows.length) {
    const notFoundError = new Error(`Store code ${normalizedStoreCode} was not found.`);
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return {
    ok: true,
    store: result.rows[0],
  };
}
