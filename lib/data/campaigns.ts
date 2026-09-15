import { randomUUID } from "crypto";
import { store } from "./store";
import type { Campaign, CampaignChannel } from "./types";

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
  return store.campaigns;
}

export async function createCampaign(input: {
  name: string;
  channel: CampaignChannel;
  productId?: string | null;
  createdBy: string;
}): Promise<Campaign> {
  const campaign: Campaign = {
    id: randomUUID(),
    name: input.name,
    channel: input.channel,
    productId: input.productId ?? null,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    isActive: true,
    createdBy: input.createdBy,
  };
  store.campaigns.push(campaign);
  return campaign;
}

export async function addCampaignMetric(input: {
  campaignId: string;
  metricDate: string;
  spendCents: number;
  leadsCaptured: number;
  conversions: number;
  revenueCents: number;
}) {
  const existing = store.campaignMetrics.find(
    (m) => m.campaignId === input.campaignId && m.metricDate === input.metricDate,
  );
  if (existing) {
    existing.spendCents = input.spendCents;
    existing.leadsCaptured = input.leadsCaptured;
    existing.conversions = input.conversions;
    existing.revenueCents = input.revenueCents;
    return existing;
  }
  const metric = { id: randomUUID(), ...input };
  store.campaignMetrics.push(metric);
  return metric;
}

/** Mirrors campaign_attribution_view from db/migrations/0007_growth.sql. */
export async function getAttributionMatrix(): Promise<CampaignAttribution[]> {
  return store.campaigns.map((c) => {
    const metrics = store.campaignMetrics.filter((m) => m.campaignId === c.id);
    const spendCents = metrics.reduce((s, m) => s + m.spendCents, 0);
    const leadsCaptured = metrics.reduce((s, m) => s + m.leadsCaptured, 0);
    const conversions = metrics.reduce((s, m) => s + m.conversions, 0);
    const revenueCents = metrics.reduce((s, m) => s + m.revenueCents, 0);

    return {
      campaignId: c.id,
      name: c.name,
      channel: c.channel,
      isActive: c.isActive,
      spendCents,
      leadsCaptured,
      conversions,
      revenueCents,
      conversionRate: leadsCaptured === 0 ? 0 : conversions / leadsCaptured,
      blendedCacCents: conversions === 0 ? null : Math.round(spendCents / conversions),
      roas: spendCents === 0 ? null : revenueCents / spendCents,
    };
  });
}
