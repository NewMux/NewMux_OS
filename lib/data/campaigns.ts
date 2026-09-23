import { many, must } from "./sql";
import type { Campaign, CampaignChannel, CampaignMetric } from "./types";
import { todayYmd } from "@/lib/time";

export type CampaignAttribution = {
  campaignId: string;
  name: string;
  channel: CampaignChannel;
  isActive: boolean;
  spendCents: number;
  leadsCaptured: number;
  conversions: number;
  revenueCents: number;
  conversionRate: number;
  blendedCacCents: number | null;
  roas: number | null;
};

export async function listCampaigns(): Promise<Campaign[]> {
  return many<Campaign>("select * from campaigns order by is_active desc, name");
}

export async function createCampaign(input: { name: string; channel: CampaignChannel; productId?: string | null; createdBy: string }): Promise<Campaign> {
  return must<Campaign>(
    "Campaign",
    "insert into campaigns (name, channel, product_id, start_date, created_by) values ($1,$2,$3,$4,$5) returning *",
    [input.name, input.channel, input.productId ?? null, todayYmd(), input.createdBy],
  );
}

export async function addCampaignMetric(input: {
  campaignId: string;
  metricDate: string;
  spendCents: number;
  leadsCaptured: number;
  conversions: number;
  revenueCents: number;
}): Promise<CampaignMetric> {
  return must<CampaignMetric>(
    "Metric",
    `insert into campaign_metrics (campaign_id, metric_date, spend_cents, leads_captured, conversions, revenue_cents)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (campaign_id, metric_date) do update set spend_cents = excluded.spend_cents,
       leads_captured = excluded.leads_captured, conversions = excluded.conversions, revenue_cents = excluded.revenue_cents
     returning *`,
    [input.campaignId, input.metricDate, input.spendCents, input.leadsCaptured, input.conversions, input.revenueCents],
  );
}

export async function getAttributionMatrix(): Promise<CampaignAttribution[]> {
  const rows = await many<Omit<CampaignAttribution, "conversionRate" | "blendedCacCents" | "roas">>(
    `select c.id as campaign_id, c.name, c.channel, c.is_active,
       coalesce(sum(m.spend_cents), 0)::int8 as spend_cents,
       coalesce(sum(m.leads_captured), 0)::int8 as leads_captured,
       coalesce(sum(m.conversions), 0)::int8 as conversions,
       coalesce(sum(m.revenue_cents), 0)::int8 as revenue_cents
     from campaigns c left join campaign_metrics m on m.campaign_id = c.id
     group by c.id order by c.is_active desc, c.name`,
  );
  return rows.map((r) => ({
    ...r,
    conversionRate: r.leadsCaptured === 0 ? 0 : r.conversions / r.leadsCaptured,
    blendedCacCents: r.conversions === 0 ? null : Math.round(r.spendCents / r.conversions),
    roas: r.spendCents === 0 ? null : r.revenueCents / r.spendCents,
  }));
}
