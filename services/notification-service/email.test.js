const test = require("node:test");
const assert = require("node:assert/strict");
const email = require("./email");

test("SES stays disabled in local development", () => {
  assert.deepEqual(email.health(), { enabled: false, status: "disabled" });
});

test("payment email contains the domain identifiers and formatted amount", () => {
  const content = email.buildEmailContent({
    paymentId: "pay-123",
    registrationId: "reg-456",
    amount: 75
  });

  assert.equal(content.subject, "Pagamento aprovado");
  assert.match(content.body, /pay-123/);
  assert.match(content.body, /reg-456/);
  assert.match(content.body, /75,00/);
});
