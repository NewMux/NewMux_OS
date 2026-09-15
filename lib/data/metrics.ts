import { store } from "./store";
import { countActiveDeliveryProjects } from "./projects";

export type SubscriberBreakdown = { paying: number; trialing: number; pastDue: number };

/**
 * v1 assumes single-currency USD across all SaaS subscriptions (no FX
 * table) — see plan's documented assumptions.
 */
export function getMrrArrCents(productSlug?: string): { mrrCents: number; arrCents: number } {
  const subs = store.saasSubscriptions.filter((s) => {
    if (s.status !== "active" && s.status !== "past_due") return false;
    if (!productSlug || productSlug === "all") return true;
    const product = store.products.find((p) => p.id === s.productId);
    return product?.slug === productSlug;
  });

  const mrrCents = subs.reduce((sum, s) => {
    const monthly = s.billingInterval === "year" ? s.recurringAmountCents / 12 : s.recurringAmountCents;
    return sum + monthly;
  }, 0);

  return { mrrCents: Math.round(mrrCents), arrCents: Math.round(mrrCents * 12) };
}

export function getSubscriberBreakdown(): SubscriberBreakdown {
  return {
    paying: store.saasSubscriptions.filter((s) => s.status === "active").length,
    trialing: store.saasSubscriptions.filter((s) => s.status === "trialing").length,
    pastDue: store.saasSubscriptions.filter((s) => s.status === "past_due").length,
  };
}

/**
 * USD-only rollup (legacy agency/SaaS dashboard widget). Mixing currencies
 * without an FX table would silently misreport totals, so BHD-denominated
 * invoices (the real Newmux ERP data) are deliberately excluded here — see
 * lib/data/erpMetrics.ts for the BHD-native Finance module reporting.
 */
export function getCashFlowCents() {
  const cashCollected =
    store.saasTransactions.filter((t) => t.status === "completed").reduce((sum, t) => sum + t.amountCents, 0) +
    store.documents
      .filter((d) => d.type === "invoice" && d.status === "paid" && d.currency === "USD")
      .reduce((sum, d) => sum + d.totalCents, 0);

  const pendingQuotePipeline = store.documents
    .filter((d) => d.type === "quote" && d.status === "sent" && d.currency === "USD")
    .reduce((sum, d) => sum + d.totalCents, 0);

  const outstandingInvoices = store.documents
    .filter((d) => d.type === "invoice" && ["sent", "accepted"].includes(d.status) && d.currency === "USD")
    .reduce((sum, d) => sum + d.totalCents, 0);

  return { cashCollected, pendingQuotePipeline, outstandingInvoices };
}

export async function getActiveDeliveryIndex(): Promise<number> {
  return countActiveDeliveryProjects();
}

export function listProductsForScopeSwitcher() {
  return store.products;
}
