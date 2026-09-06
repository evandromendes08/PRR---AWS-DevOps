const config = window.APP_CONFIG;
const tokenKey = "event-management-access-token";
const usernameKey = "event-management-username";

const loginPanel = document.querySelector("#login-panel");
const sessionPanel = document.querySelector("#session-panel");
const loginForm = document.querySelector("#login-form");
const signupForm = document.querySelector("#signup-form");
const confirmationForm = document.querySelector("#confirmation-form");
const confirmationDetails = document.querySelector("#confirmation-details");
const status = document.querySelector("#status");
const output = document.querySelector("#out");
const currentUser = document.querySelector("#current-user");

function setSession(token, username) {
  if (token) {
    sessionStorage.setItem(tokenKey, token);
    sessionStorage.setItem(usernameKey, username);
  } else {
    sessionStorage.removeItem(tokenKey);
    sessionStorage.removeItem(usernameKey);
  }
  const authenticated = Boolean(token);
  loginPanel.hidden = authenticated;
  sessionPanel.hidden = !authenticated;
  currentUser.textContent = authenticated ? username : "";
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

async function api(path) {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    headers: { authorization: `Bearer ${sessionStorage.getItem(tokenKey) || ""}` }
  });
  const result = await response.json();
  if (response.status === 401) setSession(null, null);
  if (!response.ok) throw new Error(result.error || "Falha ao consultar a API");
  return result;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  status.textContent = "Autenticando…";
  try {
    const username = document.querySelector("#username").value.trim();
    const password = document.querySelector("#password").value;
    const result = await cognito("InitiateAuth", {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: config.cognitoClientId,
      AuthParameters: { USERNAME: username, PASSWORD: password }
    });
    if (!result.AuthenticationResult?.AccessToken) {
      throw new Error("O usuário exige uma etapa adicional de autenticação");
    }
    setSession(result.AuthenticationResult.AccessToken, username);
    loginForm.reset();
    status.textContent = "Login realizado com sucesso.";
  } catch (error) {
    status.textContent = error.message;
  }
});

signupForm.addEventListener("submit", async event => {
  event.preventDefault();
  status.textContent = "Criando conta…";
  try {
    const username = document.querySelector("#signup-username").value.trim();
    const email = document.querySelector("#signup-email").value.trim();
    const password = document.querySelector("#signup-password").value;
    const result = await cognito("SignUp", {
      ClientId: config.cognitoClientId,
      Username: username,
      Password: password,
      UserAttributes: [{ Name: "email", Value: email }]
    });
    if (result.UserConfirmed) {
      status.textContent = "Conta criada. Faça login.";
    } else {
      document.querySelector("#confirmation-username").value = username;
      confirmationDetails.open = true;
      status.textContent = "Conta criada. Informe o código enviado por e-mail.";
    }
    signupForm.reset();
  } catch (error) {
    status.textContent = error.message;
  }
});

confirmationForm.addEventListener("submit", async event => {
  event.preventDefault();
  status.textContent = "Confirmando conta…";
  try {
    await cognito("ConfirmSignUp", {
      ClientId: config.cognitoClientId,
      Username: document.querySelector("#confirmation-username").value.trim(),
      ConfirmationCode: document.querySelector("#confirmation-code").value.trim()
    });
    confirmationForm.reset();
    confirmationDetails.open = false;
    status.textContent = "Conta confirmada. Faça login.";
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#resend-code").addEventListener("click", async () => {
  const username = document.querySelector("#confirmation-username").value.trim();
  if (!username) {
    status.textContent = "Informe o usuário para reenviar o código.";
    return;
  }

  status.textContent = "Reenviando código…";
  try {
    await cognito("ResendConfirmationCode", {
      ClientId: config.cognitoClientId,
      Username: username
    });
    status.textContent = "Novo código enviado. Verifique também Spam e Promoções.";
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#load").addEventListener("click", async () => {
  status.textContent = "Carregando eventos…";
  try {
    output.textContent = JSON.stringify(await api("/events"), null, 2);
    status.textContent = "Eventos carregados.";
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector("#logout").addEventListener("click", () => {
  setSession(null, null);
  output.textContent = "Faça login para consultar a API.";
  status.textContent = "Sessão encerrada.";
});

setSession(sessionStorage.getItem(tokenKey), sessionStorage.getItem(usernameKey));
