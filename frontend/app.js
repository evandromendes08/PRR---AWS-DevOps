const config = window.APP_CONFIG;
const tokenKey = "event-management-access-token";
const usernameKey = "event-management-username";

const elements = {
  loginPanel: document.querySelector("#login-panel"),
  sessionPanel: document.querySelector("#session-panel"),
  loginForm: document.querySelector("#login-form"),
  signupForm: document.querySelector("#signup-form"),
  confirmationForm: document.querySelector("#confirmation-form"),
  confirmationDetails: document.querySelector("#confirmation-details"),
  currentUser: document.querySelector("#current-user"),
  status: document.querySelector("#status"),
  output: document.querySelector("#out"),
  eventList: document.querySelector("#event-list"),
  toggleInactiveEvents: document.querySelector("#toggle-inactive-events"),
  selectedEvent: document.querySelector("#selected-event"),
  availability: document.querySelector("#availability"),
  availableCount: document.querySelector("#available-count"),
  soldCount: document.querySelector("#sold-count"),
  ticketForm: document.querySelector("#ticket-form"),
  registrationForm: document.querySelector("#registration-form"),
  paymentForm: document.querySelector("#payment-form"),
  participantName: document.querySelector("#participant-name"),
  paymentAmount: document.querySelector("#payment-amount"),
  reservationResult: document.querySelector("#reservation-result"),
  registrationResult: document.querySelector("#registration-result"),
  paymentResult: document.querySelector("#payment-result"),
  notificationResult: document.querySelector("#notification-result"),
  checkNotification: document.querySelector("#check-notification"),
  journeyTimeline: document.querySelector("#journey-timeline"),
  journeyCounter: document.querySelector("#journey-counter")
};

const flow = {
  events: [], selectedEvent: null, reservation: null,
  registration: null, payment: null, notification: null, showInactive: false
};
let toastTimer;
const journey = { entries: new Map() };

function notify(message, type = "info") {
  clearTimeout(toastTimer);
  elements.status.textContent = message;
  elements.status.classList.toggle("error", type === "error");
  elements.status.hidden = false;
  toastTimer = setTimeout(() => { elements.status.hidden = true; }, 6500);
}

function showTechnical(data) {
  elements.output.textContent = JSON.stringify(data, null, 2);
}

function setBusy(button, busy, busyLabel) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.label) {
    button.textContent = button.dataset.label;
  }
  button.disabled = busy;
}

function addText(parent, tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function formatJourneyTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(date);
}

function setEngineState(nodes = [], state) {
  nodes.forEach(name => {
    const node = document.querySelector(`[data-engine="${name}"]`);
    if (!node) return;
    node.classList.remove("running", "complete", "error");
    if (state) node.classList.add(state);
  });
}

function renderJourney() {
  elements.journeyTimeline.replaceChildren();
  const entries = [...journey.entries.values()];
  elements.journeyCounter.textContent = `${entries.length} ${entries.length === 1 ? "evento" : "eventos"}`;
  if (!entries.length) {
    addText(elements.journeyTimeline, "li", "Aguardando uma ação para iniciar o rastreamento.", "journey-empty");
    return;
  }

  entries.forEach(entry => {
    const item = document.createElement("li");
    item.className = `journey-event ${entry.state}`;
    addText(item, "time", formatJourneyTime(entry.timestamp), "journey-time");
    const marker = document.createElement("span");
    marker.className = "journey-marker";
    marker.setAttribute("aria-hidden", "true");
    item.append(marker);
    const copy = document.createElement("div");
    copy.className = "journey-copy";
    addText(copy, "strong", entry.title);
    if (entry.detail) addText(copy, "span", entry.detail);
    addText(copy, "span", entry.service, "journey-service");
    item.append(copy);
    addText(item, "span", entry.duration || (entry.state === "running" ? "processando" : ""), "journey-duration");
    elements.journeyTimeline.append(item);
  });
  elements.journeyTimeline.scrollTop = elements.journeyTimeline.scrollHeight;
}

function startJourney(id, title, service, detail, nodes = []) {
  journey.entries.delete(id);
  journey.entries.set(id, {
    id, title, service, detail, nodes, state: "running",
    timestamp: new Date(), startedAt: performance.now(), duration: ""
  });
  setEngineState(nodes, "running");
  renderJourney();
  return id;
}

function finishJourney(id, detail, state = "complete") {
  const entry = journey.entries.get(id);
  if (!entry) return;
  entry.state = state;
  if (detail) entry.detail = detail;
  entry.duration = `${Math.max(Math.round(performance.now() - entry.startedAt), 1)} ms`;
  setEngineState(entry.nodes, state);
  renderJourney();
}

function recordJourney(id, title, service, detail, nodes = []) {
  startJourney(id, title, service, detail, nodes);
  finishJourney(id, detail);
}

function failJourney(id, error) {
  finishJourney(id, error.message || String(error), "error");
}

function hasJourney(id) {
  return journey.entries.has(id);
}

function resetJourney() {
  journey.entries.clear();
  document.querySelectorAll(".engine-node").forEach(node => node.classList.remove("running", "complete", "error"));
  renderJourney();
}

function showResult(target, title, detail, state) {
  target.replaceChildren();
  target.hidden = false;
  target.className = `result-box${state === "error" ? " error" : ""}`;
  addText(target, "strong", title);
  if (detail) addText(target, "span", detail);
  if (state && state !== "error") addText(target, "span", state, "status-pill");
}

function updateSteps() {
  const progress = flow.notification ? 5 : flow.payment ? 4 : flow.registration ? 3 : flow.reservation ? 2 : flow.selectedEvent ? 1 : 0;
  document.querySelectorAll(".step").forEach((step, index) => {
    step.classList.toggle("complete", index < progress);
    step.classList.toggle("active", index === progress && progress < 5);
    step.querySelector("span").textContent = index < progress ? "✓" : String(index + 1);
  });
}

function resetFlow() {
  Object.assign(flow, { events: [], selectedEvent: null, reservation: null, registration: null, payment: null, notification: null, showInactive: false });
  elements.eventList.replaceChildren();
  elements.selectedEvent.className = "empty-state";
  elements.selectedEvent.textContent = "Selecione um evento para continuar.";
  elements.availability.hidden = true;
  elements.ticketForm.hidden = true;
  elements.ticketForm.reset();
  elements.registrationForm.reset();
  elements.paymentForm.reset();
  elements.participantName.disabled = true;
  elements.registrationForm.querySelector("button").disabled = true;
  elements.paymentAmount.disabled = true;
  elements.paymentForm.querySelector("button").disabled = true;
  elements.checkNotification.disabled = true;
  [elements.reservationResult, elements.registrationResult, elements.paymentResult].forEach(item => {
    item.hidden = true;
    item.replaceChildren();
  });
  elements.notificationResult.className = "empty-state";
  elements.notificationResult.textContent = "A notificação será processada após a aprovação do pagamento.";
  resetJourney();
  updateSteps();
}

function setSession(token, username) {
  if (token) {
    sessionStorage.setItem(tokenKey, token);
    sessionStorage.setItem(usernameKey, username);
  } else {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(usernameKey);
    resetFlow();
  }
  const authenticated = Boolean(token);
  elements.loginPanel.hidden = authenticated;
  elements.sessionPanel.hidden = !authenticated;
  elements.currentUser.textContent = authenticated ? username : "";
}

async function cognito(action, payload) {
  const response = await fetch(`https://cognito-idp.${config.awsRegion}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${action}`
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Falha na autenticação");
  return result;
}

async function api(path, options = {}) {
  const headers = { authorization: `Bearer ${sessionStorage.getItem(tokenKey) || ""}` };
  if (options.body) headers["content-type"] = "application/json";
  const response = await fetch(`${config.apiBaseUrl}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (response.status === 401) {
    setSession(null, null);
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  if (!response.ok) throw new Error(result.error || result.message || `Falha na API (${response.status})`);
  return result;
}

function post(path, body) {
  return api(path, { method: "POST", body: JSON.stringify(body) });
}

function renderEvents() {
  elements.eventList.replaceChildren();
  const inactiveCount = flow.events.filter(event => event.active === false).length;
  elements.toggleInactiveEvents.hidden = inactiveCount === 0;
  elements.toggleInactiveEvents.textContent = flow.showInactive ? "Ocultar inativos" : `Mostrar inativos (${inactiveCount})`;
  const visibleEvents = flow.showInactive ? flow.events : flow.events.filter(event => event.active !== false);

  if (!visibleEvents.length) {
    const message = flow.events.length
      ? "Nenhum evento ativo. Mostre os inativos para reativar um evento."
      : "Nenhum evento cadastrado. Crie o primeiro evento para iniciar a demonstração.";
    const empty = addText(elements.eventList, "div", message, "empty-state");
    empty.style.gridColumn = "1 / -1";
    return;
  }
  visibleEvents.forEach(event => {
    const active = event.active !== false;
    const card = document.createElement("article");
    card.className = `event-card${flow.selectedEvent?.id === event.id ? " selected" : ""}${active ? "" : " inactive"}`;

    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "event-select";
    selectButton.disabled = !active;
    selectButton.setAttribute("aria-pressed", String(flow.selectedEvent?.id === event.id));
    selectButton.setAttribute("aria-label", active ? `Selecionar ${event.name}` : `${event.name}, evento inativo`);
    selectButton.addEventListener("click", () => selectEvent(event));
    addText(selectButton, "strong", event.name);
    addText(selectButton, "small", event.city);
    const meta = document.createElement("span");
    meta.className = "event-meta";
    addText(meta, "small", `ID ${String(event.id).slice(0, 8)}`);
    addText(meta, "span", `${event.available} ingressos`, "capacity");
    selectButton.append(meta);

    const footer = document.createElement("footer");
    footer.className = "event-card-footer";
    addText(footer, "span", active ? "ATIVO" : "INATIVO", `event-state ${active ? "active" : "inactive"}`);
    const statusButton = addText(footer, "button", active ? "Desativar" : "Reativar", "event-status-action");
    statusButton.type = "button";
    statusButton.setAttribute("aria-label", `${active ? "Desativar" : "Reativar"} evento ${event.name}`);
    statusButton.addEventListener("click", () => setEventStatus(event, !active, statusButton));

    card.append(selectButton, footer);
    elements.eventList.append(card);
  });
}

function clearSelectedEvent() {
  Object.assign(flow, { selectedEvent: null, reservation: null, registration: null, payment: null, notification: null });
  elements.selectedEvent.className = "empty-state";
  elements.selectedEvent.textContent = "Selecione um evento para continuar.";
  elements.availability.hidden = true;
  elements.ticketForm.hidden = true;
  elements.ticketForm.reset();
  elements.registrationForm.reset();
  elements.paymentForm.reset();
  elements.participantName.disabled = true;
  elements.registrationForm.querySelector("button").disabled = true;
  elements.paymentAmount.disabled = true;
  elements.paymentForm.querySelector("button").disabled = true;
  elements.checkNotification.disabled = true;
  [elements.reservationResult, elements.registrationResult, elements.paymentResult].forEach(item => {
    item.hidden = true;
    item.replaceChildren();
  });
  elements.notificationResult.className = "empty-state";
  elements.notificationResult.textContent = "A notificação será processada após a aprovação do pagamento.";
  updateSteps();
}

async function setEventStatus(event, active, button) {
  const journeyId = `event-status-${event.id}`;
  const action = active ? "Reativando" : "Desativando";
  startJourney(journeyId, `${action} evento`, `event-service · POST /events/${event.id}/status`, `${event.name} → ${active ? "ATIVO" : "INATIVO"}`, ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  setBusy(button, true, active ? "Reativando…" : "Desativando…");
  try {
    const updated = await post(`/events/${encodeURIComponent(event.id)}/status`, { active });
    const index = flow.events.findIndex(item => item.id === updated.id);
    if (index >= 0) flow.events[index] = updated;
    if (!active && flow.selectedEvent?.id === updated.id) clearSelectedEvent();
    finishJourney(journeyId, `Evento ${updated.id} agora está ${active ? "ativo" : "inativo"}.`);
    renderEvents();
    showTechnical(updated);
    notify(active ? "Evento reativado e disponível para reservas." : "Evento desativado. Novas reservas foram bloqueadas.");
  } catch (error) {
    failJourney(journeyId, error);
    notify(error.message, "error");
  } finally {
    setBusy(button, false);
  }
}

async function loadEvents({ silent = false } = {}) {
  const button = document.querySelector("#reload-events");
  const journeyId = "events-load";
  startJourney(journeyId, "Consultando catálogo de eventos", "event-service · GET /events", "CloudFront encaminhando a chamada para o ALB.", ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  setBusy(button, true, "Carregando…");
  try {
    const result = await api("/events");
    flow.events = Array.isArray(result.items) ? result.items : [];
    renderEvents();
    showTechnical(result);
    finishJourney(journeyId, `${flow.events.length} evento(s) lido(s) do PostgreSQL.`);
    if (!silent) notify(`${flow.events.length} evento(s) carregado(s).`);
  } catch (error) {
    failJourney(journeyId, error);
    notify(error.message, "error");
    if (!flow.events.length) {
      elements.eventList.replaceChildren();
      addText(elements.eventList, "div", "Não foi possível carregar os eventos. Tente novamente.", "empty-state");
    }
  } finally {
    setBusy(button, false);
  }
}

async function selectEvent(event) {
  if (event.active === false) return notify("Reative o evento antes de selecioná-lo.", "error");
  Object.assign(flow, { selectedEvent: event, reservation: null, registration: null, payment: null, notification: null });
  renderEvents();
  elements.selectedEvent.className = "selected-summary";
  elements.selectedEvent.replaceChildren();
  addText(elements.selectedEvent, "strong", event.name);
  addText(elements.selectedEvent, "span", `${event.city} · ${event.id}`);
  elements.ticketForm.hidden = false;
  elements.reservationResult.hidden = true;
  elements.registrationResult.hidden = true;
  elements.paymentResult.hidden = true;
  elements.notificationResult.className = "empty-state";
  elements.notificationResult.textContent = "A notificação será processada após a aprovação do pagamento.";
  elements.participantName.disabled = true;
  elements.registrationForm.querySelector("button").disabled = true;
  elements.paymentAmount.disabled = true;
  elements.paymentForm.querySelector("button").disabled = true;
  elements.checkNotification.disabled = true;
  recordJourney("event-selected", "Evento selecionado na interface", "frontend", `${event.name} · ${event.city}`, ["frontend"]);
  updateSteps();
  await loadAvailability();
}

async function loadAvailability() {
  if (!flow.selectedEvent) return;
  const journeyId = "availability";
  startJourney(journeyId, "Consultando estoque de ingressos", "ticket-service · GET /tickets/availability", `eventId=${flow.selectedEvent.id}`, ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  try {
    const result = await api(`/tickets/availability?eventId=${encodeURIComponent(flow.selectedEvent.id)}`);
    elements.availableCount.textContent = result.available;
    elements.soldCount.textContent = result.sold;
    elements.availability.hidden = false;
    document.querySelector("#ticket-quantity").max = Math.max(Number(result.available) || 1, 1);
    showTechnical(result);
    finishJourney(journeyId, `${result.available} disponíveis · ${result.sold} reservados.`);
  } catch (error) {
    failJourney(journeyId, error);
    elements.availability.hidden = true;
    notify(error.message, "error");
  }
}

async function loadBusinessStatus({ notifyResult = false } = {}) {
  const [registrations, notifications] = await Promise.all([api("/registrations"), api("/notifications")]);
  if (flow.registration) {
    const updated = registrations.items?.find(item => item.id === flow.registration.id);
    if (updated) {
      flow.registration = updated;
      showResult(elements.registrationResult, updated.participant, `Inscrição ${updated.id}`, updated.status);
      if (updated.status === "PAID" && !hasJourney("registration-consumer")) {
        recordJourney(
          "registration-consumer",
          "Inscrição atualizada para PAID",
          "SQS → registration-service → RDS",
          `PaymentApproved consumido para ${updated.id}.`,
          ["sqs", "consumers", "rds"]
        );
      }
    }
    const notification = notifications.items?.find(item => String(item.message).includes(flow.registration.id));
    if (notification) {
      flow.notification = notification;
      showResult(elements.notificationResult, notification.status === "SENT" ? "E-mail entregue ao provedor" : "Notificação processada", notification.message, notification.status);
      if (!hasJourney("notification-consumer")) {
        recordJourney(
          "notification-consumer",
          "Notificação consumida da fila",
          "SQS → notification-service",
          notification.message,
          ["sqs", "consumers"]
        );
      }
      if (notification.status === "SENT" && !hasJourney("ses-delivery")) {
        recordJourney(
          "ses-delivery",
          "E-mail aceito pelo Amazon SES",
          "notification-service → Amazon SES",
          notification.providerMessageId ? `providerMessageId=${notification.providerMessageId}` : "Entrega registrada com status SENT.",
          ["ses"]
        );
      }
    }
  }
  showTechnical({ registrations, notifications });
  updateSteps();
  if (notifyResult) notify(flow.notification ? "Notificação localizada." : "O processamento assíncrono ainda está em andamento.");
  const completed = Boolean(flow.registration?.status === "PAID" && flow.notification?.status === "SENT");
  if (completed) {
    finishJourney("async-processing", "As duas filas foram processadas pelos consumidores.");
    if (!hasJourney("journey-complete")) {
      recordJourney("journey-complete", "Jornada concluída ponta a ponta", "EventFlow", "Evento → ingresso → inscrição → pagamento → e-mail.", ["frontend"]);
    }
  }
  return completed;
}

async function pollBusinessStatus() {
  elements.checkNotification.disabled = true;
  elements.notificationResult.className = "empty-state";
  elements.notificationResult.textContent = "EventBridge e SQS estão processando o pagamento…";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      if (await loadBusinessStatus()) {
        notify("Fluxo concluído. A inscrição foi paga e o e-mail enviado.");
        elements.checkNotification.disabled = false;
        return;
      }
    } catch (error) {
      if (attempt === 9) notify(error.message, "error");
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  elements.checkNotification.disabled = false;
  notify("O processamento continua em segundo plano. Use “Verificar processamento” novamente.");
}

elements.loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Autenticando…");
  try {
    const username = document.querySelector("#username").value.trim();
    const result = await cognito("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.cognitoClientId,
      AuthParameters: { USERNAME: username, PASSWORD: document.querySelector("#password").value }
    });
    if (!result.AuthenticationResult?.AccessToken) throw new Error("O usuário exige uma etapa adicional de autenticação");
    setSession(result.AuthenticationResult.AccessToken, username);
    recordJourney("authentication", "Sessão autenticada", "Amazon Cognito", `Access token emitido para ${username}.`, ["frontend"]);
    elements.loginForm.reset();
    notify("Login realizado com sucesso.");
    await loadEvents({ silent: true });
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(button, false); }
});

elements.signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Criando…");
  try {
    const username = document.querySelector("#signup-username").value.trim();
    const result = await cognito("SignUp", {
      ClientId: config.cognitoClientId,
      Username: username,
      Password: document.querySelector("#signup-password").value,
      UserAttributes: [{ Name: "email", Value: document.querySelector("#signup-email").value.trim() }]
    });
    if (result.UserConfirmed) notify("Conta criada. Faça login.");
    else {
      document.querySelector("#confirmation-username").value = username;
      elements.confirmationDetails.open = true;
      notify("Conta criada. Informe o código enviado por e-mail.");
    }
    elements.signupForm.reset();
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(button, false); }
});

elements.confirmationForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Confirmando…");
  try {
    await cognito("ConfirmSignUp", {
      ClientId: config.cognitoClientId,
      Username: document.querySelector("#confirmation-username").value.trim(),
      ConfirmationCode: document.querySelector("#confirmation-code").value.trim()
    });
    elements.confirmationForm.reset();
    elements.confirmationDetails.open = false;
    notify("Conta confirmada. Faça login.");
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(button, false); }
});

document.querySelector("#resend-code").addEventListener("click", async event => {
  const button = event.currentTarget;
  const username = document.querySelector("#confirmation-username").value.trim();
  if (!username) return notify("Informe o usuário para reenviar o código.", "error");
  setBusy(button, true, "Reenviando…");
  try {
    await cognito("ResendConfirmationCode", { ClientId: config.cognitoClientId, Username: username });
    notify("Novo código enviado. Verifique também Spam e Promoções.");
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(button, false); }
});

document.querySelector("#event-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const journeyId = "event-create";
  startJourney(journeyId, "Criando evento", "event-service · POST /events", "Enviando dados pela rota síncrona.", ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  setBusy(button, true, "Criando…");
  try {
    const created = await post("/events", {
      name: document.querySelector("#event-name").value.trim(),
      city: document.querySelector("#event-city").value.trim(),
      available: Number(document.querySelector("#event-capacity").value)
    });
    form.reset();
    document.querySelector("#event-capacity").value = 50;
    flow.events.push(created);
    await selectEvent(created);
    finishJourney(journeyId, `Evento ${created.id} persistido no PostgreSQL.`);
    notify("Evento criado e selecionado.");
    showTechnical(created);
  } catch (error) {
    failJourney(journeyId, error);
    notify(error.message, "error");
  }
  finally { setBusy(button, false); }
});

elements.ticketForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  const journeyId = "ticket-reserve";
  startJourney(journeyId, "Reservando ingresso", "ticket-service · POST /tickets/reserve", `eventId=${flow.selectedEvent.id}`, ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  setBusy(button, true, "Reservando…");
  try {
    flow.reservation = await post("/tickets/reserve", {
      eventId: flow.selectedEvent.id,
      quantity: Number(document.querySelector("#ticket-quantity").value)
    });
    finishJourney(journeyId, `Reserva ${flow.reservation.reservationId} confirmada com controle transacional de estoque.`);
    showResult(elements.reservationResult, `${flow.reservation.quantity} ingresso(s) reservado(s)`, `Reserva ${flow.reservation.reservationId}`, flow.reservation.status);
    elements.participantName.disabled = false;
    elements.registrationForm.querySelector("button").disabled = false;
    updateSteps();
    await loadAvailability();
    notify("Reserva confirmada. Agora informe o participante.");
    elements.participantName.focus();
  } catch (error) {
    failJourney(journeyId, error);
    showResult(elements.reservationResult, "Não foi possível reservar", error.message, "error");
    notify(error.message, "error");
  } finally { setBusy(button, false); }
});

elements.registrationForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  const journeyId = "registration-create";
  startJourney(journeyId, "Criando inscrição", "registration-service · POST /registrations", "Persistindo participante com status inicial PENDING_PAYMENT.", ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  setBusy(button, true, "Registrando…");
  try {
    flow.registration = await post("/registrations", {
      eventId: flow.selectedEvent.id,
      participant: elements.participantName.value.trim()
    });
    finishJourney(journeyId, `Inscrição ${flow.registration.id} criada como ${flow.registration.status}.`);
    showResult(elements.registrationResult, flow.registration.participant, `Inscrição ${flow.registration.id}`, flow.registration.status);
    elements.paymentAmount.disabled = false;
    elements.paymentForm.querySelector("button").disabled = false;
    updateSteps();
    notify("Inscrição criada. Prossiga para o pagamento.");
    elements.paymentAmount.focus();
    showTechnical(flow.registration);
  } catch (error) {
    failJourney(journeyId, error);
    showResult(elements.registrationResult, "Falha na inscrição", error.message, "error");
    notify(error.message, "error");
  } finally { setBusy(button, false); }
});

elements.paymentForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  const journeyId = "payment-create";
  startJourney(journeyId, "Processando pagamento", "payment-service · POST /payments", `registrationId=${flow.registration.id}`, ["frontend", "cloudfront", "alb", "ecs", "rds"]);
  setBusy(button, true, "Aprovando…");
  try {
    flow.payment = await post("/payments", {
      registrationId: flow.registration.id,
      amount: Number(elements.paymentAmount.value),
      approve: true
    });
    finishJourney(journeyId, `Pagamento ${flow.payment.id} persistido como ${flow.payment.status}.`);
    if (flow.payment.eventPublished) {
      recordJourney(
        "eventbridge-publish",
        "Evento PaymentApproved publicado",
        "payment-service → Amazon EventBridge",
        "O barramento confirmou a publicação do evento de domínio.",
        ["eventbridge"]
      );
      startJourney(
        "async-processing",
        "Processamento assíncrono em andamento",
        "EventBridge → duas filas SQS",
        "Aguardando registration-service e notification-service consumirem suas mensagens.",
        ["eventbridge", "sqs"]
      );
    }
    showResult(elements.paymentResult, `Pagamento ${flow.payment.status.toLowerCase()}`, `ID ${flow.payment.id} · Evento publicado: ${flow.payment.eventPublished ? "sim" : "não"}`, flow.payment.status);
    elements.checkNotification.disabled = false;
    updateSteps();
    notify("Pagamento aprovado. Acompanhando o processamento assíncrono…");
    showTechnical(flow.payment);
    await pollBusinessStatus();
  } catch (error) {
    failJourney(journeyId, error);
    showResult(elements.paymentResult, "Falha no pagamento", error.message, "error");
    notify(error.message, "error");
  } finally { setBusy(button, false); }
});

document.querySelector("#reload-events").addEventListener("click", () => loadEvents());
elements.toggleInactiveEvents.addEventListener("click", () => {
  flow.showInactive = !flow.showInactive;
  renderEvents();
});
document.querySelector("#clear-journey").addEventListener("click", () => {
  resetJourney();
  notify("Console da jornada limpo.");
});
document.querySelector("#refresh-all").addEventListener("click", async event => {
  const button = event.currentTarget;
  setBusy(button, true, "Atualizando…");
  try {
    await loadEvents({ silent: true });
    if (flow.selectedEvent) await loadAvailability();
    if (flow.registration) await loadBusinessStatus();
    notify("Dados atualizados.");
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(button, false); }
});

elements.checkNotification.addEventListener("click", async () => {
  try { await loadBusinessStatus({ notifyResult: true }); }
  catch (error) { notify(error.message, "error"); }
});

document.querySelector("#logout").addEventListener("click", () => {
  setSession(null, null);
  elements.output.textContent = "Aguardando uma operação.";
  notify("Sessão encerrada.");
});

const savedToken = sessionStorage.getItem(tokenKey);
setSession(savedToken, sessionStorage.getItem(usernameKey));
if (savedToken) loadEvents({ silent: true });
