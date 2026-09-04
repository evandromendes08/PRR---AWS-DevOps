const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { URL } = require("node:url");
const db = require("../shared/database");
const { json, body, apiPath } = require("../shared/http");

const port = Number(process.env.PORT || 3000);
const service = "payment-service";
const payments = [];

const schema = `
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    registration_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'DECLINED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
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
    if (req.method === "POST" && path === "/payments") {
      const input = await body(req);
      const amount = Number(input.amount ?? 100);
      if (!Number.isFinite(amount) || amount < 0) {
        return json(res, 422, { error: "amount must be a non-negative number" });
      }
      const payment = {
        id: `pay-${randomUUID()}`,
        registrationId: String(input.registrationId || "reg-demo"),
        amount,
        status: input.approve !== false ? "APPROVED" : "DECLINED"
      };
      if (db.enabled) {
        await db.query(
          "INSERT INTO payments (id, registration_id, amount, status) VALUES ($1, $2, $3, $4)",
          [payment.id, payment.registrationId, payment.amount, payment.status]
        );
      } else {
        payments.push(payment);
      }
      return json(res, 201, payment);
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
