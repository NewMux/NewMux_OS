import { randomUUID } from "crypto";
import { store } from "./store";
import type { SaasCustomer, SaasSubscription, SaasSubscriptionStatus } from "./types";

export function hasProcessedEvent(paddleEventId: string): boolean {
  return store.paddleWebhookEventIds.has(paddleEventId);
}

export function markEventProcessed(paddleEventId: string): void {
  store.paddleWebhookEventIds.add(paddleEventId);
}

export function upsertSaasCustomer(input: { paddleCustomerId: string; email?: string | null }): SaasCustomer {
  let customer = store.saasCustomers.find((c) => c.paddleCustomerId === input.paddleCustomerId);
  if (!customer) {
    customer = { id: randomUUID(), paddleCustomerId: input.paddleCustomerId, clientId: null, email: input.email ?? null };
    store.saasCustomers.push(customer);
  } else if (input.email) {
    customer.email = input.email;
  }
  return customer;
}

export function upsertSaasSubscription(input: {
  paddleSubscriptionId: string;
  saasCustomerId: string;
  status: SaasSubscriptionStatus;
  currency: string;
  recurringAmountCents: number;
  billingInterval: "month" | "year";
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
}): SaasSubscription {
  let sub = store.saasSubscriptions.find((s) => s.paddleSubscriptionId === input.paddleSubscriptionId);
  if (!sub) {
    sub = {
      id: randomUUID(),
      paddleSubscriptionId: input.paddleSubscriptionId,
      saasCustomerId: input.saasCustomerId,
      productId: null,
      status: input.status,
      currency: input.currency,
      recurringAmountCents: input.recurringAmountCents,
      billingInterval: input.billingInterval,
      currentPeriodStart: input.currentPeriodStart ?? null,
      currentPeriodEnd: input.currentPeriodEnd ?? null,
      trialEndsAt: input.trialEndsAt ?? null,
      canceledAt: null,
    };
    store.saasSubscriptions.push(sub);
  } else {
    sub.status = input.status;
    sub.currency = input.currency;
    sub.recurringAmountCents = input.recurringAmountCents;
    sub.billingInterval = input.billingInterval;
    sub.currentPeriodStart = input.currentPeriodStart ?? sub.currentPeriodStart;
    sub.currentPeriodEnd = input.currentPeriodEnd ?? sub.currentPeriodEnd;
    sub.trialEndsAt = input.trialEndsAt ?? sub.trialEndsAt;
  }
  return sub;
}

export function markSubscriptionPastDue(paddleSubscriptionId: string): void {
  const sub = store.saasSubscriptions.find((s) => s.paddleSubscriptionId === paddleSubscriptionId);
  if (sub) sub.status = "past_due";
}

export function markSubscriptionCanceled(paddleSubscriptionId: string): void {
  const sub = store.saasSubscriptions.find((s) => s.paddleSubscriptionId === paddleSubscriptionId);
  if (sub) {
    sub.status = "canceled";
    sub.canceledAt = new Date().toISOString();
  }
}

export function recordTransaction(input: {
  paddleTransactionId: string;
  paddleSubscriptionId?: string | null;
  saasCustomerId?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  billedAt?: string | null;
}): void {
  const exists = store.saasTransactions.some((t) => t.paddleTransactionId === input.paddleTransactionId);
  if (exists) return;

  const sub = input.paddleSubscriptionId
    ? store.saasSubscriptions.find((s) => s.paddleSubscriptionId === input.paddleSubscriptionId)
    : undefined;

  store.saasTransactions.push({
    id: randomUUID(),
    paddleTransactionId: input.paddleTransactionId,
    saasSubscriptionId: sub?.id ?? null,
    saasCustomerId: input.saasCustomerId ?? null,
    amountCents: input.amountCents,
    currency: input.currency,
    status: input.status,
    billedAt: input.billedAt ?? null,
  });
}
