const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const db = require("../shared/database");
const auth = require("../shared/auth");
const { json, body, apiPath } = require("../shared/http");

const port = Number(process.env.PORT || 3000);
const service = "ticket-service";
const tickets = { "evt-001": { available: 100, sold: 0 } };

const schema = `
  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    available INTEGER NOT NULL CHECK (available >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE events ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
  CREATE TABLE IF NOT EXISTS tickets (
    event_id TEXT PRIMARY KEY,
    available INTEGER NOT NULL CHECK (available >= 0),
    sold INTEGER NOT NULL DEFAULT 0 CHECK (sold >= 0)
  );
  INSERT INTO tickets (event_id, available, sold)
  VALUES ('evt-001', 100, 0)
  ON CONFLICT (event_id) DO NOTHING;
`;

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

    if (req.method === "GET" && path === "/tickets/availability") {
      const eventId = url.searchParams.get("eventId") || "evt-001";
      if (!db.enabled) {
        return json(res, 200, { eventId, ...(tickets[eventId] || { available: 0, sold: 0 }) });
      }
      const result = await db.query(
        `SELECT tickets.available, tickets.sold, COALESCE(events.active, FALSE) AS active
           FROM tickets
           LEFT JOIN events ON events.id = tickets.event_id
          WHERE tickets.event_id = $1`,
        [eventId]
      );
      return json(res, 200, { eventId, ...(result.rows[0] || { available: 0, sold: 0, active: false }) });
    }

    if (req.method === "POST" && path === "/tickets/reserve") {
      const input = await body(req);
      const eventId = String(input.eventId || "evt-001");
      const quantity = Number(input.quantity ?? 1);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return json(res, 422, { error: "quantity must be a positive integer" });
      }

      if (db.enabled) {
        const reservationResult = await db.transaction(async client => {
          const current = await client.query(
            `SELECT tickets.available, events.active
               FROM tickets
               JOIN events ON events.id = tickets.event_id
              WHERE tickets.event_id = $1
              FOR UPDATE OF tickets`,
            [eventId]
          );
          if (!current.rows[0]) return "unavailable";
          if (!current.rows[0].active) return "inactive";
          if (current.rows[0].available < quantity) return "unavailable";
          await client.query(
            "UPDATE tickets SET available = available - $1, sold = sold + $1 WHERE event_id = $2",
            [quantity, eventId]
          );
          return "reserved";
        });
        if (reservationResult === "inactive") return json(res, 409, { error: "Evento inativo" });
        if (reservationResult !== "reserved") return json(res, 409, { error: "Ingressos indisponíveis" });
      } else {
        const stock = tickets[eventId];
        if (!stock || stock.available < quantity) {
          return json(res, 409, { error: "Ingressos indisponíveis" });
        }
        stock.available -= quantity;
        stock.sold += quantity;
      }

      return json(res, 201, {
        reservationId: `res-${randomUUID()}`,
        eventId,
        quantity,
        status: "RESERVED"
      });
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
