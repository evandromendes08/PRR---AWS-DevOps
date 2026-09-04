const {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient
} = require("@aws-sdk/client-sqs");

const enabled = String(process.env.MESSAGING_ENABLED || "false").toLowerCase() === "true";
const queueUrl = process.env.SQS_QUEUE_URL;
const region = process.env.AWS_REGION || "us-east-1";

if (enabled && !queueUrl) {
  throw new Error("SQS consumption is enabled but SQS_QUEUE_URL is missing");
}

const client = enabled ? new SQSClient({ region }) : null;
const controller = new AbortController();
let running = false;
let processed = 0;
let lastError = null;

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function consume(handler) {
  if (!enabled || running) return;
  running = true;

  while (running) {
    try {
      const result = await client.send(new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 30
      }), { abortSignal: controller.signal });

      for (const message of result.Messages || []) {
        const event = JSON.parse(message.Body);
        await handler(event);
        await client.send(new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle
        }));
        processed += 1;
      }
      lastError = null;
    } catch (error) {
      if (!running || error.name === "AbortError") break;
      lastError = error.message;
      console.error(JSON.stringify({ component: "sqs-consumer", error: error.message }));
      await wait(1000);
    }
  }
}

function stop() {
  running = false;
  controller.abort();
}

function health() {
  return {
    enabled,
    status: !enabled ? "disabled" : lastError ? "degraded" : "ok",
    processed
  };
}

module.exports = { enabled, consume, stop, health };
