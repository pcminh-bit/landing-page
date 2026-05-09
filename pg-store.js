let sqlSingleton = null;

function getSql() {
  if (!process.env.DATABASE_URL) return null;
  if (!sqlSingleton) {
    const { neon } = require("@neondatabase/serverless");
    sqlSingleton = neon(process.env.DATABASE_URL);
  }
  return sqlSingleton;
}

function emptySnapshot() {
  return { products: [], customers: [], orders: [] };
}

let schemaPromise = null;

function ensurePgSchema(sql) {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS landing_app_snapshot (
          id SMALLINT PRIMARY KEY DEFAULT 1,
          snapshot JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT landing_app_single CHECK (id = 1)
        )
      `;
      const seed = JSON.stringify(emptySnapshot());
      await sql`
        INSERT INTO landing_app_snapshot (id, snapshot)
        VALUES (1, CAST(${seed} AS JSONB))
        ON CONFLICT (id) DO NOTHING
      `;
    })();
  }
  return schemaPromise;
}

async function loadSnapshot(sql) {
  await ensurePgSchema(sql);
  const rows = await sql`SELECT snapshot FROM landing_app_snapshot WHERE id = 1`;
  const snap = rows[0]?.snapshot;
  if (!snap || typeof snap !== "object") return emptySnapshot();
  if (!Array.isArray(snap.products)) snap.products = [];
  if (!Array.isArray(snap.customers)) snap.customers = [];
  if (!Array.isArray(snap.orders)) snap.orders = [];
  return snap;
}

async function saveSnapshot(sql, snapshot) {
  const json = JSON.stringify(snapshot);
  await sql`
    UPDATE landing_app_snapshot
    SET snapshot = CAST(${json} AS JSONB),
        updated_at = now()
    WHERE id = 1
  `;
}

function nextId(items) {
  if (!items.length) return 1;
  return Math.max(...items.map((row) => Number(row.id) || 0)) + 1;
}

function nowSqliteStyle() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

module.exports = {
  usePostgresStore: Boolean(process.env.DATABASE_URL),
  getSql,
  ensurePgSchema,
  loadSnapshot,
  saveSnapshot,
  emptySnapshot,
  nextId,
  nowSqliteStyle,
};
