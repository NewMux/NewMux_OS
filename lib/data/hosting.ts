import { randomUUID } from "crypto";
import { store } from "./store";
import type { HostingSubscription, RecurringExpenseCycle } from "./types";
import { createDocument } from "./documents";
import { addPayment } from "./finance";

const CYCLE_MONTHS: Record<RecurringExpenseCycle, number> = { monthly: 1, quarterly: 3, annual: 12 };

function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

export async function listHostingSubscriptions(): Promise<HostingSubscription[]> {
  return store.hostingSubscriptions;
}

export async function listHostingSubscriptionsForClient(clientId: string): Promise<HostingSubscription[]> {
  return store.hostingSubscriptions.filter((h) => h.clientId === clientId);
}

export type HostingAlertLevel = "overdue" | "due_soon" | "upcoming" | "ok";

/** PRD section 6: 14-day alert, 3-day alert, then overdue once the due date passes. */
export function hostingAlertLevel(sub: HostingSubscription): HostingAlertLevel {
  if (!sub.nextDueDate || sub.status === "paused") return "ok";
  const daysUntil = Math.ceil((new Date(sub.nextDueDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "due_soon";
  if (daysUntil <= 14) return "upcoming";
  return "ok";
}

export async function listHostingAlerts(): Promise<{ subscription: HostingSubscription; level: HostingAlertLevel }[]> {
  return store.hostingSubscriptions
    .map((subscription) => ({ subscription, level: hostingAlertLevel(subscription) }))
    .filter((x) => x.level !== "ok");
}

export async function createHostingSubscription(input: {
  clientId: string;
  item: HostingSubscription["item"];
  amountCents: number;
  currency: string;
  cycle: RecurringExpenseCycle;
}): Promise<HostingSubscription> {
  const sub: HostingSubscription = {
    id: randomUUID(),
    clientId: input.clientId,
    item: input.item,
    amountCents: input.amountCents,
    currency: input.currency,
    cycle: input.cycle,
    lastCollectedDate: null,
    nextDueDate: addMonths(new Date().toISOString(), CYCLE_MONTHS[input.cycle]),
    status: "active",
    linkedInvoiceId: null,
  };
  store.hostingSubscriptions.push(sub);
  return sub;
}

/**
 * PRD section 6: "Collected" creates an invoice for the amount and advances
 * the next due date by the subscription's cycle. The invoice is recorded as
 * immediately paid in full, since "Collected" means the client already paid.
 */
export async function collectHostingFee(subscriptionId: string, collectedBy: string) {
  const sub = store.hostingSubscriptions.find((s) => s.id === subscriptionId);
  if (!sub) throw new Error("Hosting subscription not found");

  const project = store.projects.find((p) => p.clientId === sub.clientId);
  const itemLabel = sub.item === "server" ? "Server/hosting" : sub.item === "domain" ? "Domain" : "Hosting";

  const invoice = await createDocument({
    type: "invoice",
    clientId: sub.clientId,
    productId: project?.productId ?? null,
    projectId: project?.id ?? null,
    currency: sub.currency,
    taxRateBps: 0,
    paymentTerms: "Due on receipt",
    notes: `${itemLabel} — ${sub.cycle} hosting fee collection.`,
    lineItems: [{ description: `${itemLabel} (${sub.cycle})`, quantity: 1, unitPriceCents: sub.amountCents }],
    createdBy: collectedBy,
  });

  await addPayment({
    documentId: invoice.id,
    amountCents: sub.amountCents,
    method: "transfer",
    recordedBy: collectedBy,
  });

  const now = new Date().toISOString();
  sub.lastCollectedDate = now;
  sub.nextDueDate = addMonths(sub.nextDueDate ?? now, CYCLE_MONTHS[sub.cycle]);
  sub.linkedInvoiceId = invoice.id;
  sub.status = "active";

  return { subscription: sub, invoice };
}
