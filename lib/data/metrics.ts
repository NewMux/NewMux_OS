import { many, one } from "./sql";
import { countActiveDeliveryProjects } from "./projects";
import type { Product } from "./types";

export type SubscriberBreakdown = { paying: number; trialing: number; pastDue: number };

/** SaaS (Paddle) subscriptions are billed in USD. */
export async function getMrrArrCents(productSlug?: string): Promise<{ mrrCents: number; arrCents: number }> {
  const params: unknown[] = [];
  const productFilter =
    productSlug && productSlug !== "all" ? `and s.product_id = (select id from products where slug = $${params.push(productSlug)})` : "";
  const row = await one<{ mrr: number }>(
    `select coalesce(sum(case when s.billing_interval = 'year' then s.recurring_amount_cents / 12.0 else s.recurring_amount_cents end), 0)::numeric as mrr
     from saas_subscriptions s where s.status in ('active', 'past_due') and s.currency = 'USD' ${productFilter}`,
    params,
  );
  const mrrCents = Math.round(row?.mrr ?? 0);
  return { mrrCents, arrCents: mrrCents * 12 };
}

export async function getSubscriberBreakdown(): Promise<SubscriberBreakdown> {
  const row = await one<SubscriberBreakdown>(
    `select count(*) filter (where status = 'active')::int as paying,
            count(*) filter (where status = 'trialing')::int as trialing,
            count(*) filter (where status = 'past_due')::int as past_due
     from saas_subscriptions`,
  );
  return row ?? { paying: 0, trialing: 0, pastDue: 0 };
}

export async function getActiveDeliveryIndex(): Promise<number> {
  return countActiveDeliveryProjects();
}

export async function listProductsForScopeSwitcher(): Promise<Product[]> {
  return many<Product>("select * from products order by name");
}
