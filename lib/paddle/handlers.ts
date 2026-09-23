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

export async function handleSubscriptionUpsert(event: PaddleEvent): Promise<void> {
  const data = event.data;
  const customerId = str(data, "customer_id");
  if (!customerId) return;

  const customer = await upsertSaasCustomer({ paddleCustomerId: customerId, email: str(data, "customer_email") });

  const subscriptionId = str(data, "subscription_id") ?? str(data, "id");
  if (!subscriptionId) return;

  await upsertSaasSubscription({
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

export async function handleSubscriptionPastDue(event: PaddleEvent): Promise<void> {
  const subscriptionId = str(event.data, "subscription_id") ?? str(event.data, "id");
  if (subscriptionId) await markSubscriptionPastDue(subscriptionId);
}

export async function handleSubscriptionCanceled(event: PaddleEvent): Promise<void> {
  const subscriptionId = str(event.data, "subscription_id") ?? str(event.data, "id");
  if (subscriptionId) await markSubscriptionCanceled(subscriptionId);
}

export async function handleTransactionCompleted(event: PaddleEvent): Promise<void> {
  const data = event.data;
  const transactionId = str(data, "transaction_id") ?? str(data, "id");
  if (!transactionId) return;

  await recordTransaction({
    paddleTransactionId: transactionId,
    paddleSubscriptionId: str(data, "subscription_id") ?? null,
    saasCustomerId: null,
    amountCents: num(data, "amount_cents") ?? 0,
    currency: str(data, "currency_code") ?? "USD",
    status: "completed",
    billedAt: str(data, "billed_at") ?? new Date().toISOString(),
  });
}
