import {
  upsertSaasCustomer,
  upsertSaasSubscription,
  markSubscriptionPastDue,
  markSubscriptionCanceled,
  recordTransaction,
} from "@/lib/data/saas";

/**
 * Minimal shape of the Paddle Billing event payloads this app handles.
 * Real Paddle payloads carry more fields — only what's needed for the
 * dashboard/billing data model is picked out here.
 */
type PaddleEvent = {
  event_id: string;
  event_type: string;
  data: Record<string, unknown>;
};

function str(data: Record<string, unknown>, key: string): string | undefined {
  const v = data[key];
  return typeof v === "string" ? v : undefined;
}

function num(data: Record<string, unknown>, key: string): number | undefined {
  const v = data[key];
  return typeof v === "number" ? v : undefined;
}

export function handleSubscriptionUpsert(event: PaddleEvent): void {
  const data = event.data;
  const customerId = str(data, "customer_id");
  if (!customerId) return;

  const customer = upsertSaasCustomer({ paddleCustomerId: customerId, email: str(data, "customer_email") });

  const subscriptionId = str(data, "subscription_id") ?? str(data, "id");
  if (!subscriptionId) return;

  upsertSaasSubscription({
    paddleSubscriptionId: subscriptionId,
    saasCustomerId: customer.id,
    status: (str(data, "status") as "trialing" | "active" | "past_due" | "canceled" | "paused") ?? "active",
    currency: str(data, "currency_code") ?? "USD",
    recurringAmountCents: num(data, "recurring_amount_cents") ?? 0,
    billingInterval: (str(data, "billing_interval") as "month" | "year") ?? "month",
    currentPeriodStart: str(data, "current_period_start") ?? null,
    currentPeriodEnd: str(data, "current_period_end") ?? null,
    trialEndsAt: str(data, "trial_ends_at") ?? null,
  });
}

export function handleSubscriptionPastDue(event: PaddleEvent): void {
  const subscriptionId = str(event.data, "subscription_id") ?? str(event.data, "id");
  if (subscriptionId) markSubscriptionPastDue(subscriptionId);
}

export function handleSubscriptionCanceled(event: PaddleEvent): void {
  const subscriptionId = str(event.data, "subscription_id") ?? str(event.data, "id");
  if (subscriptionId) markSubscriptionCanceled(subscriptionId);
}

export function handleTransactionCompleted(event: PaddleEvent): void {
  const data = event.data;
  const transactionId = str(data, "transaction_id") ?? str(data, "id");
  if (!transactionId) return;

  recordTransaction({
    paddleTransactionId: transactionId,
    paddleSubscriptionId: str(data, "subscription_id") ?? null,
    saasCustomerId: null,
    amountCents: num(data, "amount_cents") ?? 0,
    currency: str(data, "currency_code") ?? "USD",
    status: "completed",
    billedAt: str(data, "billed_at") ?? new Date().toISOString(),
  });
}
