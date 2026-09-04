const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const db = require("../shared/database");
const auth = require("../shared/auth");
const queue = require("../shared/queue");
const { json, body, apiPath } = require("../shared/http");

const port = Number(process.env.PORT || 3000);
const service = "registration-service";
const registrations = [];

const schema = `
  CREATE TABLE IF NOT EXISTS registrations (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    participant TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

function registrationFromRow(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    participant: row.participant,
    status: row.status
  };
}

async function handlePaymentApproved(event) {
  if (event["detail-type"] !== "PaymentApproved") return;
  const registrationId = event.detail?.registrationId;
  if (!registrationId) throw new Error("PaymentApproved event is missing registrationId");

  if (db.enabled) {
    await db.query(
      "UPDATE registrations SET status = 'PAID' WHERE id = $1",
      [registrationId]
    );
  } else {
    const registration = registrations.find(item => item.id === registrationId);
    if (registration) registration.status = "PAID";
  }
  console.log(JSON.stringify({ service, message: "payment event processed", registrationId }));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = apiPath(url.pathname);

  if (path === "/health") {
    try {
      return json(res, 200, {
        service,
        status: "ok",
        database: await db.health(),
        messaging: queue.health()
      });
    } catch {
      return json(res, 503, { service, status: "unhealthy", database: { enabled: true, status: "error" } });
    }
  }

  try {
    await auth.authenticate(req);

    if (req.method === "POST" && path === "/registrations") {
      const input = await body(req);
      const registration = {
        id: `reg-${randomUUID()}`,
        eventId: String(input.eventId || "evt-001"),
        participant: String(input.participant || "Participante Demo"),
        status: "PENDING_PAYMENT"
      };
      if (db.enabled) {
        await db.query(
          "INSERT INTO registrations (id, event_id, participant, status) VALUES ($1, $2, $3, $4)",
          [registration.id, registration.eventId, registration.participant, registration.status]
        );
      } else {
        registrations.push(registration);
      }
      return json(res, 201, registration);
    }

    if (req.method === "GET" && path === "/registrations") {
      if (!db.enabled) return json(res, 200, { items: registrations });
      const result = await db.query(
        "SELECT id, event_id, participant, status FROM registrations ORDER BY created_at"
      );
      return json(res, 200, { items: result.rows.map(registrationFromRow) });
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
  void queue.consume(handlePaymentApproved);
  server.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({
      service,
      message: "listening",
      port,
      database: db.enabled,
      messaging: queue.enabled
    }));
  });
}

async function shutdown() {
  queue.stop();
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
