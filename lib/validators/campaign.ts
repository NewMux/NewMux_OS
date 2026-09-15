import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(["meta_ads", "linkedin", "google_search", "outbound_email"]),
  productId: z.string().uuid().nullable().optional(),
});

export const addMetricSchema = z.object({
  campaignId: z.string().uuid(),
  metricDate: z.string().min(1),
  spendCents: z.number().int().nonnegative(),
  leadsCaptured: z.number().int().nonnegative(),
  conversions: z.number().int().nonnegative(),
  revenueCents: z.number().int().nonnegative(),
});
