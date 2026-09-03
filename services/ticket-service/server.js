const http = require("node:http");
const { URL } = require("node:url");

const port = Number(process.env.PORT || 3000);
const service = process.env.SERVICE_NAME || "ticket-service";

const state = {
  events: [
    { id: "evt-001", name: "AWS DevOps Experience", city: "Brasília", available: 100 }
  ],
  tickets: { "evt-001": { available: 100, sold: 0 } },
  registrations: [],
  payments: []
};

function json(res, status, payload) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-allow-methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => data += chunk);
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/health") return json(res, 200, { service, status: "ok" });

  try {
    if (service === "event-service" && req.method === "GET" && url.pathname === "/events") {
      return json(res, 200, { items: state.events });
    }

    if (service === "event-service" && req.method === "POST" && url.pathname === "/events") {
      const input = await body(req);
      const event = { id: `evt-${Date.now()}`, name: input.name || "Novo evento", city: input.city || "Brasília", available: Number(input.available || 50) };
      state.events.push(event);
      state.tickets[event.id] = { available: event.available, sold: 0 };
      return json(res, 201, event);
    }

    if (service === "ticket-service" && req.method === "GET" && url.pathname === "/tickets/availability") {
      const eventId = url.searchParams.get("eventId") || "evt-001";
      return json(res, 200, { eventId, ...(state.tickets[eventId] || { available: 0, sold: 0 }) });
    }

    if (service === "ticket-service" && req.method === "POST" && url.pathname === "/tickets/reserve") {
      const input = await body(req);
      const eventId = input.eventId || "evt-001";
      const quantity = Math.max(1, Number(input.quantity || 1));
      const stock = state.tickets[eventId];
      if (!stock || stock.available < quantity) return json(res, 409, { error: "Ingressos indisponíveis" });
      stock.available -= quantity; stock.sold += quantity;
      return json(res, 201, { reservationId: `res-${Date.now()}`, eventId, quantity, status: "RESERVED" });
    }

    if (service === "registration-service" && req.method === "POST" && url.pathname === "/registrations") {
      const input = await body(req);
      const registration = { id: `reg-${Date.now()}`, eventId: input.eventId || "evt-001", participant: input.participant || "Participante Demo", status: "PENDING_PAYMENT" };
      state.registrations.push(registration);
      return json(res, 201, registration);
    }

    if (service === "registration-service" && req.method === "GET" && url.pathname === "/registrations") {
      return json(res, 200, { items: state.registrations });
    }

    if (service === "payment-service" && req.method === "POST" && url.pathname === "/payments") {
      const input = await body(req);
      const approved = input.approve !== false;
      const payment = { id: `pay-${Date.now()}`, registrationId: input.registrationId || "reg-demo", amount: Number(input.amount || 100), status: approved ? "APPROVED" : "DECLINED" };
      state.payments.push(payment);
      return json(res, 201, payment);
    }

    if (service === "notification-service" && req.method === "POST" && url.pathname === "/notifications") {
      const input = await body(req);
      return json(res, 202, { id: `not-${Date.now()}`, channel: input.channel || "email", status: "QUEUED", message: input.message || "Notificação de demonstração" });
    }

    return json(res, 404, { error: "Route not found", service, path: url.pathname });
  } catch (err) {
    return json(res, 400, { error: "Invalid request", detail: err.message });
  }
});

server.listen(port, "0.0.0.0", () => console.log(`${service} listening on ${port}`));
