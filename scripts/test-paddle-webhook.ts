import { createHmac } from "crypto";

/**
 * Hand-crafts a signed Paddle webhook request and posts it twice to confirm
 * signature verification, upsert logic, and idempotency (second call should
 * be a no-op "duplicate" response, not a duplicate DB row). No live Paddle
 * sandbox account needed — see plan Section 9, step 9.
 *
 * Usage: PADDLE_WEBHOOK_SECRET=test-secret npm run test:paddle-webhook
 */

const secret = process.env.PADDLE_WEBHOOK_SECRET ?? "test-secret";
const url = process.env.WEBHOOK_URL ?? "http://localhost:3000/api/webhooks/paddle";

const payload = {
  event_id: `evt_test_${Date.now()}`,
  event_type: "subscription.created",
  data: {
    id: "sub_test_001",
    customer_id: "ctm_test_001",
    customer_email: "test-buyer@example.com",
    status: "active",
    currency_code: "USD",
    recurring_amount_cents: 4900,
    billing_interval: "month",
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
};

function sign(rawBody: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

async function send(rawBody: string, label: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Paddle-Signature": sign(rawBody) },
    body: rawBody,
  });
  console.log(`[${label}] status=${res.status} body=${await res.text()}`);
}

async function main() {
  const rawBody = JSON.stringify(payload);
  await send(rawBody, "first delivery");
  await send(rawBody, "duplicate delivery (should be idempotent)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
