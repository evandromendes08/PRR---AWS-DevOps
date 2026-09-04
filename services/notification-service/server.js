const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const db = require("../shared/database");
const auth = require("../shared/auth");
const queue = require("../shared/queue");
const { json, body, apiPath } = require("../shared/http");

const port = Number(process.env.PORT || 3000);
const service = "notification-service";

const schema = `
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
    source_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_event_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_event_id_idx
    ON notifications (source_event_id) WHERE source_event_id IS NOT NULL;
`;

function notificationFromRow(row) {
  return {
    id: row.id,
    channel: row.channel,
    message: row.message,
    status: row.status,
    sourceEventId: row.source_event_id
  };
}

async function handlePaymentApproved(event) {
  if (event["detail-type"] !== "PaymentApproved") return;
  const detail = event.detail || {};
  const notification = {
    id: `not-${randomUUID()}`,
    channel: "email",
    status: "QUEUED",
    message: `Pagamento ${detail.paymentId || ""} aprovado para a inscrição ${detail.registrationId || ""}`,
    sourceEventId: event.id
  };

  if (db.enabled) {
    await db.query(
      `INSERT INTO notifications (id, channel, message, status, source_event_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING`,
      [notification.id, notification.channel, notification.message, notification.status, notification.sourceEventId]
    );
  }
  console.log(JSON.stringify({ service, message: "payment event processed", sourceEventId: event.id }));
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

    if (req.method === "POST" && path === "/notifications") {
      const input = await body(req);
      const notification = {
        id: `not-${randomUUID()}`,
        channel: String(input.channel || "email"),
        status: "QUEUED",
        message: String(input.message || "Notificação de demonstração")
      };
      if (db.enabled) {
        await db.query(
          "INSERT INTO notifications (id, channel, message, status) VALUES ($1, $2, $3, $4)",
          [notification.id, notification.channel, notification.message, notification.status]
        );
      }
      return json(res, 202, notification);
    }

    if (req.method === "GET" && path === "/notifications") {
      if (!db.enabled) return json(res, 200, { items: [] });
      const result = await db.query(
        `SELECT id, channel, message, status, source_event_id
         FROM notifications ORDER BY created_at`
      );
      return json(res, 200, { items: result.rows.map(notificationFromRow) });
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
