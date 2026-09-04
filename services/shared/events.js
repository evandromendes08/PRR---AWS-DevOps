const { EventBridgeClient, PutEventsCommand } = require("@aws-sdk/client-eventbridge");

const enabled = String(process.env.MESSAGING_ENABLED || "false").toLowerCase() === "true";
const eventBusName = process.env.EVENT_BUS_NAME;
const region = process.env.AWS_REGION || "us-east-1";

if (enabled && !eventBusName) {
  throw new Error("EventBridge publishing is enabled but EVENT_BUS_NAME is missing");
}

const client = enabled ? new EventBridgeClient({ region }) : null;

async function publish({ source, detailType, detail }) {
  if (!enabled) return false;

  const result = await client.send(new PutEventsCommand({
    Entries: [{
      EventBusName: eventBusName,
      Source: source,
      DetailType: detailType,
      Detail: JSON.stringify(detail)
    }]
  }));

  if (result.FailedEntryCount) {
    const message = result.Entries?.find(entry => entry.ErrorMessage)?.ErrorMessage;
    throw new Error(message || "EventBridge rejected the domain event");
  }
  return true;
}

function health() {
  return { enabled, status: enabled ? "configured" : "disabled" };
}

module.exports = { enabled, publish, health };
