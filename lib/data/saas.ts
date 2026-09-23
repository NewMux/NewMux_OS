import { query } from "@/lib/db";
import { must } from "./sql";
import type { SaasCustomer, SaasSubscription, SaasSubscriptionStatus } from "./types";

/** Returns true if this Paddle event id was newly recorded (i.e. not a redelivery). */
export async function claimEvent(paddleEventId: string): Promise<boolean> {
  const rows = await query("insert into paddle_webhook_events (event_id) values ($1) on conflict do nothing returning event_id", [paddleEventId]);
  return rows.length > 0;
}

export async function hasProcessedEvent(paddleEventId: string): Promise<boolean> {
  return (await query("select 1 from paddle_webhook_events where event_id = $1", [paddleEventId])).length > 0;
}

export async function upsertSaasCustomer(input: { paddleCustomerId: string; email?: string | null }): Promise<SaasCustomer> {
  return must<SaasCustomer>(
    "Customer",
    `insert into saas_customers (paddle_customer_id, email) values ($1, $2)
     on conflict (paddle_customer_id) do update set email = coalesce(excluded.email, saas_customers.email)
     returning *`,
    [input.paddleCustomerId, input.email ?? null],
  );
}

export async function upsertSaasSubscription(input: {
  paddleSubscriptionId: string;
  saasCustomerId: string;
  status: SaasSubscriptionStatus;
  currency: string;
  recurringAmountCents: number;
  billingInterval: "month" | "year";
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
}): Promise<SaasSubscription> {
  return must<SaasSubscription>(
    "Subscription",
    `insert into saas_subscriptions (paddle_subscription_id, saas_customer_id, status, currency, recurring_amount_cents,
       billing_interval, current_period_start, current_period_end, trial_ends_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     on conflict (paddle_subscription_id) do update set status = excluded.status, currency = excluded.currency,
       recurring_amount_cents = excluded.recurring_amount_cents, billing_interval = excluded.billing_interval,
       current_period_start = coalesce(excluded.current_period_start, saas_subscriptions.current_period_start),
       current_period_end = coalesce(excluded.current_period_end, saas_subscriptions.current_period_end),
       trial_ends_at = coalesce(excluded.trial_ends_at, saas_subscriptions.trial_ends_at)
     returning *`,
    [
      input.paddleSubscriptionId,
      input.saasCustomerId,
      input.status,
      input.currency,
      input.recurringAmountCents,
      input.billingInterval,
      input.currentPeriodStart ?? null,
      input.currentPeriodEnd ?? null,
      input.trialEndsAt ?? null,
    ],
  );
}

export async function markSubscriptionPastDue(paddleSubscriptionId: string): Promise<void> {
  await query("update saas_subscriptions set status = 'past_due' where paddle_subscription_id = $1", [paddleSubscriptionId]);
}

export async function markSubscriptionCanceled(paddleSubscriptionId: string): Promise<void> {
  await query("update saas_subscriptions set status = 'canceled', canceled_at = now() where paddle_subscription_id = $1", [paddleSubscriptionId]);
}

export async function recordTransaction(input: {
  paddleTransactionId: string;
  paddleSubscriptionId?: string | null;
  saasCustomerId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  billedAt?: string | null;
}): Promise<void> {
  await query(
    `insert into saas_transactions (paddle_transaction_id, saas_subscription_id, saas_customer_id, amount_cents, currency, status, billed_at)
     values ($1, (select id from saas_subscriptions where paddle_subscription_id = $2), $3, $4, $5, $6, $7)
     on conflict (paddle_transaction_id) do nothing`,
    [
      input.paddleTransactionId,
      input.paddleSubscriptionId ?? null,
      input.saasCustomerId ?? null,
      input.amountCents,
      input.currency,
      input.status,
      input.billedAt ?? null,
    ],
  );
}
