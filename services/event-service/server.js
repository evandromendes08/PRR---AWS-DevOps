const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const db = require("../shared/database");
const auth = require("../shared/auth");
const { json, body, apiPath } = require("../shared/http");

const port = Number(process.env.PORT || 3000);
const service = "event-service";
const events = [
  { id: "evt-001", name: "AWS DevOps Experience", city: "Brasília", available: 100 }
];

const schema = `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    available INTEGER NOT NULL CHECK (available >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS tickets (
    event_id TEXT PRIMARY KEY,
    available INTEGER NOT NULL CHECK (available >= 0),
    sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0)
  );
  INSERT INTO events (id, name, city, available)
  VALUES ('evt-001', 'AWS DevOps Experience', 'Brasília', 100)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO tickets (event_id, available, sold)
  VALUES ('evt-001', 100, 0)
  ON CONFLICT (event_id) DO NOTHING;
`;

function eventFromRow(row) {
  return { id: row.id, name: row.name, city: row.city, available: row.available };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = apiPath(url.pathname);

  if (path === "/health") {
    try {
      return json(res, 200, { service, status: "ok", database: await db.health() });
    } catch {
      return json(res, 503, { service, status: "unhealthy", database: { enabled: true, status: "error" } });
    }
  }

  try {
    await auth.authenticate(req);

    if (req.method === "GET" && path === "/events") {
      if (!db.enabled) return json(res, 200, { items: events });
      const result = await db.query("SELECT id, name, city, available FROM events ORDER BY created_at");
      return json(res, 200, { items: result.rows.map(eventFromRow) });
    }

    if (req.method === "POST" && path === "/events") {
      const input = await body(req);
      const available = Number(input.available ?? 50);
      if (!Number.isInteger(available) || available < 0) {
        return json(res, 422, { error: "available must be a non-negative integer" });
      }
      const event = {
        id: `evt-${randomUUID()}`,
        name: String(input.name || "Novo evento"),
        city: String(input.city || "Brasília"),
        available
      };

      if (db.enabled) {
        await db.transaction(async client => {
          await client.query(
            "INSERT INTO events (id, name, city, available) VALUES ($1, $2, $3, $4)",
            [event.id, event.name, event.city, event.available]
          );
          await client.query(
            "INSERT INTO tickets (event_id, available, sold) VALUES ($1, $2, 0)",
            [event.id, event.available]
          );
        });
      } else {
        events.push(event);
      }
      return json(res, 201, event);
    }

    return json(res, 404, { error: "Route not found", service, path: url.pathname });
  } catch (error) {
    console.error(JSON.stringify({ service, error: error.message, path: url.pathname }));
    const status = error.statusCode || 500;
    return json(res, status, { error: status === 500 ? "Internal server error" : error.message });
  }
});

async function start() {
  await db.initialize(schema);
  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ service, message: "listening", port, database: db.enabled }));
  });
}

async function shutdown() {
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
start().catch(error => {
  console.error(JSON.stringify({ service, error: error.message, message: "startup failed" }));
  process.exit(1);
});
