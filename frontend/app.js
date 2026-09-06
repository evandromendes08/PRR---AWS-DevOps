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
  checkNotification: document.querySelector("#check-notification")
};

const flow = {
  events: [], selectedEvent: null, reservation: null,
  registration: null, payment: null, notification: null
};
let toastTimer;

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
  Object.assign(flow, { events: [], selectedEvent: null, reservation: null, registration: null, payment: null, notification: null });
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
  if (!flow.events.length) {
    const empty = addText(elements.eventList, "div", "Nenhum evento cadastrado. Crie o primeiro evento para iniciar a demonstração.", "empty-state");
    empty.style.gridColumn = "1 / -1";
    return;
  }
  flow.events.forEach(event => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `event-card${flow.selectedEvent?.id === event.id ? " selected" : ""}`;
    button.setAttribute("aria-pressed", String(flow.selectedEvent?.id === event.id));
    button.addEventListener("click", () => selectEvent(event));
    addText(button, "strong", event.name);
    addText(button, "small", event.city);
    const meta = document.createElement("span");
    meta.className = "event-meta";
    addText(meta, "small", `ID ${String(event.id).slice(0, 8)}`);
    addText(meta, "span", `${event.available} ingressos`, "capacity");
    button.append(meta);
    elements.eventList.append(button);
  });
}

async function loadEvents({ silent = false } = {}) {
  const button = document.querySelector("#reload-events");
  setBusy(button, true, "Carregando…");
  try {
    const result = await api("/events");
    flow.events = Array.isArray(result.items) ? result.items : [];
    renderEvents();
    showTechnical(result);
    if (!silent) notify(`${flow.events.length} evento(s) carregado(s).`);
  } catch (error) {
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
  updateSteps();
  await loadAvailability();
}

async function loadAvailability() {
  if (!flow.selectedEvent) return;
  try {
    const result = await api(`/tickets/availability?eventId=${encodeURIComponent(flow.selectedEvent.id)}`);
    elements.availableCount.textContent = result.available;
    elements.soldCount.textContent = result.sold;
    elements.availability.hidden = false;
    document.querySelector("#ticket-quantity").max = Math.max(Number(result.available) || 1, 1);
    showTechnical(result);
  } catch (error) {
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
    }
    const notification = notifications.items?.find(item => String(item.message).includes(flow.registration.id));
    if (notification) {
      flow.notification = notification;
      showResult(elements.notificationResult, notification.status === "SENT" ? "E-mail entregue ao provedor" : "Notificação processada", notification.message, notification.status);
    }
  }
  showTechnical({ registrations, notifications });
  updateSteps();
  if (notifyResult) notify(flow.notification ? "Notificação localizada." : "O processamento assíncrono ainda está em andamento.");
  return Boolean(flow.registration?.status === "PAID" && flow.notification?.status === "SENT");
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
  const username = document.querySelector("#confirmation-username").value.trim();
  if (!username) return notify("Informe o usuário para reenviar o código.", "error");
  setBusy(event.currentTarget, true, "Reenviando…");
  try {
    await cognito("ResendConfirmationCode", { ClientId: config.cognitoClientId, Username: username });
    notify("Novo código enviado. Verifique também Spam e Promoções.");
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(event.currentTarget, false); }
});

document.querySelector("#event-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Criando…");
  try {
    const created = await post("/events", {
      name: document.querySelector("#event-name").value.trim(),
      city: document.querySelector("#event-city").value.trim(),
      available: Number(document.querySelector("#event-capacity").value)
    });
    event.currentTarget.reset();
    document.querySelector("#event-capacity").value = 50;
    flow.events.push(created);
    await selectEvent(created);
    notify("Evento criado e selecionado.");
    showTechnical(created);
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(button, false); }
});

elements.ticketForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Reservando…");
  try {
    flow.reservation = await post("/tickets/reserve", {
      eventId: flow.selectedEvent.id,
      quantity: Number(document.querySelector("#ticket-quantity").value)
    });
    showResult(elements.reservationResult, `${flow.reservation.quantity} ingresso(s) reservado(s)`, `Reserva ${flow.reservation.reservationId}`, flow.reservation.status);
    elements.participantName.disabled = false;
    elements.registrationForm.querySelector("button").disabled = false;
    updateSteps();
    await loadAvailability();
    notify("Reserva confirmada. Agora informe o participante.");
    elements.participantName.focus();
  } catch (error) {
    showResult(elements.reservationResult, "Não foi possível reservar", error.message, "error");
    notify(error.message, "error");
  } finally { setBusy(button, false); }
});

elements.registrationForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Registrando…");
  try {
    flow.registration = await post("/registrations", {
      eventId: flow.selectedEvent.id,
      participant: elements.participantName.value.trim()
    });
    showResult(elements.registrationResult, flow.registration.participant, `Inscrição ${flow.registration.id}`, flow.registration.status);
    elements.paymentAmount.disabled = false;
    elements.paymentForm.querySelector("button").disabled = false;
    updateSteps();
    notify("Inscrição criada. Prossiga para o pagamento.");
    elements.paymentAmount.focus();
    showTechnical(flow.registration);
  } catch (error) {
    showResult(elements.registrationResult, "Falha na inscrição", error.message, "error");
    notify(error.message, "error");
  } finally { setBusy(button, false); }
});

elements.paymentForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  setBusy(button, true, "Aprovando…");
  try {
    flow.payment = await post("/payments", {
      registrationId: flow.registration.id,
      amount: Number(elements.paymentAmount.value),
      approve: true
    });
    showResult(elements.paymentResult, `Pagamento ${flow.payment.status.toLowerCase()}`, `ID ${flow.payment.id} · Evento publicado: ${flow.payment.eventPublished ? "sim" : "não"}`, flow.payment.status);
    elements.checkNotification.disabled = false;
    updateSteps();
    notify("Pagamento aprovado. Acompanhando o processamento assíncrono…");
    showTechnical(flow.payment);
    await pollBusinessStatus();
  } catch (error) {
    showResult(elements.paymentResult, "Falha no pagamento", error.message, "error");
    notify(error.message, "error");
  } finally { setBusy(button, false); }
});

document.querySelector("#reload-events").addEventListener("click", () => loadEvents());
document.querySelector("#refresh-all").addEventListener("click", async event => {
  setBusy(event.currentTarget, true, "Atualizando…");
  try {
    await loadEvents({ silent: true });
    if (flow.selectedEvent) await loadAvailability();
    if (flow.registration) await loadBusinessStatus();
    notify("Dados atualizados.");
  } catch (error) { notify(error.message, "error"); }
  finally { setBusy(event.currentTarget, false); }
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
