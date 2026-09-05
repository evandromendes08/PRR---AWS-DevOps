const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");

const enabled = String(process.env.SES_ENABLED || "false").toLowerCase() === "true";
const region = process.env.AWS_REGION || "us-east-1";
const fromAddress = process.env.SES_FROM_EMAIL;
const toAddresses = String(process.env.SES_TO_EMAIL || "")
  .split(",")
  .map(address => address.trim())
  .filter(Boolean);

if (enabled && (!fromAddress || toAddresses.length === 0)) {
  throw new Error("SES is enabled but SES_FROM_EMAIL or SES_TO_EMAIL is missing");
}

const client = enabled ? new SESv2Client({ region }) : null;

function buildEmailContent(detail) {
  const paymentId = String(detail.paymentId || "não informado");
  const registrationId = String(detail.registrationId || "não informada");
  const amount = Number(detail.amount);
  const formattedAmount = Number.isFinite(amount)
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount)
    : "não informado";

  return {
    subject: "Pagamento aprovado",
    body: [
      "Seu pagamento foi aprovado.",
      `Pagamento: ${paymentId}`,
      `Inscrição: ${registrationId}`,
      `Valor: ${formattedAmount}`
    ].join("\n")
  };
}

async function sendPaymentApproved(detail) {
  if (!enabled) return null;
  const content = buildEmailContent(detail);

  const result = await client.send(new SendEmailCommand({
    FromEmailAddress: fromAddress,
    Destination: { ToAddresses: toAddresses },
    Content: {
      Simple: {
        Subject: { Data: content.subject, Charset: "UTF-8" },
        Body: {
          Text: {
            Data: content.body,
            Charset: "UTF-8"
          }
        }
      }
    }
  }));

  return result.MessageId;
}

function health() {
  return {
    enabled,
    status: enabled ? "configured" : "disabled"
  };
}

module.exports = { buildEmailContent, enabled, health, sendPaymentApproved };
