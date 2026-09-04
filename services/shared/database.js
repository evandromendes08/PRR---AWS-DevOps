const { Pool } = require("pg");

const enabled = process.env.DB_ENABLED === "true";

const pool = enabled
  ? new Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "events",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: Number(process.env.DB_POOL_SIZE || 5),
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
    })
  : null;

async function query(text, params = []) {
  if (!pool) throw new Error("Database is disabled");
  return pool.query(text, params);
}

async function transaction(callback) {
  if (!pool) throw new Error("Database is disabled");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function initialize(sql) {
  if (pool) await pool.query(sql);
}

async function health() {
  if (!pool) return { enabled: false, status: "disabled" };
  await pool.query("SELECT 1");
  return { enabled: true, status: "ok" };
}

async function close() {
  if (pool) await pool.end();
}

module.exports = { enabled, query, transaction, initialize, health, close };
