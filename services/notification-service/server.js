const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const db = require("../shared/database");
const auth = require("../shared/auth");
const queue = require("../shared/queue");
const email = require("./email");
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
    provider_message_id TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_event_id TEXT;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
  ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
  CREATE UNIQUE INDEX IF NOT EXISTS notifications_source_event_id_idx
    ON notifications (source_event_id) WHERE source_event_id IS NOT NULL;
`;

function notificationFromRow(row) {
  return {
    id: row.id,
    channel: row.channel,
    message: row.message,
    status: row.status,
    sourceEventId: row.source_event_id,
    providerMessageId: row.provider_message_id,
    sentAt: row.sent_at
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
    const inserted = await db.query(
      `INSERT INTO notifications (id, channel, message, status, source_event_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING
       RETURNING id, status`,
      [notification.id, notification.channel, notification.message, notification.status, notification.sourceEventId]
    );
    if (inserted.rowCount === 0) {
      const existing = await db.query(
        "SELECT id, status FROM notifications WHERE source_event_id = $1",
        [notification.sourceEventId]
      );
      if (existing.rows[0]?.status === "SENT") {
        console.log(JSON.stringify({ service, message: "duplicate payment event ignored", sourceEventId: event.id }));
        return;
      }
      notification.id = existing.rows[0]?.id || notification.id;
    }
  }

  if (email.enabled) {
    try {
      const providerMessageId = await email.sendPaymentApproved(detail);
      notification.status = "SENT";
      if (db.enabled) {
        await db.query(
          `UPDATE notifications
           SET status = 'SENT', provider_message_id = $2, sent_at = NOW()
           WHERE id = $1`,
          [notification.id, providerMessageId]
        );
      }
      console.log(JSON.stringify({ service, message: "email sent", sourceEventId: event.id, providerMessageId }));
    } catch (error) {
      if (db.enabled) {
        await db.query("UPDATE notifications SET status = 'FAILED' WHERE id = $1", [notification.id]);
      }
      throw error;
    }
  }
  console.log(JSON.stringify({ service, message: "payment event processed", sourceEventId: event.id, status: notification.status }));
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
        messaging: queue.health(),
        email: email.health()
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
        `SELECT id, channel, message, status, source_event_id, provider_message_id, sent_at
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
      messaging: queue.enabled,
      email: email.enabled
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
