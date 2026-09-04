const { CognitoJwtVerifier } = require("aws-jwt-verify");

const enabled = String(process.env.AUTH_ENABLED || "false").toLowerCase() === "true";
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID;

if (enabled && (!userPoolId || !clientId)) {
  throw new Error("Cognito authentication is enabled but its configuration is incomplete");
}

const verifier = enabled
  ? CognitoJwtVerifier.create({ userPoolId, tokenUse: "access", clientId })
  : null;

function unauthorized() {
  const error = new Error("A valid Cognito access token is required");
  error.statusCode = 401;
  return error;
}

async function authenticate(req) {
  if (!enabled) return { sub: "local-development", username: "local-development" };

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw unauthorized();

  try {
    const payload = await verifier.verify(match[1]);
    return {
      sub: payload.sub,
      username: payload.username || payload["cognito:username"] || payload.sub
    };
  } catch {
    throw unauthorized();
  }
}

module.exports = { enabled, authenticate };
