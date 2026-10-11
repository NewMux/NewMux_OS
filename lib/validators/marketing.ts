import { z } from "zod";
import { currency, ref, requiredText, text, ymd } from "./common";
import { CAMPAIGN_CHANNELS, CAMPAIGN_STATUSES, POST_CHANNELS, POST_STATUSES } from "@/lib/marketing";
import type { CampaignInput } from "@/lib/data/marketing";
import { majorToMinorUnits } from "@/lib/money";

/** A date and time (or blank for "no date yet"), stored as an instant. */
const when = z
  .union([z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Use a date and time like 2026-10-14T10:00:00+03:00"), z.literal("")])
  .nullish()
  .transform((v) => (v ? new Date(v).toISOString() : null));

/** A web link, or blank. */
const link = z
  .union([z.string().trim().url("Use a full link starting with https://").max(1000), z.literal("")])
  .nullish()
  .transform((v) => v || null);

export const postSchema = z.object({
  title: requiredText,
  channel: z.enum(POST_CHANNELS).default("instagram"),
  status: z.enum(POST_STATUSES).default("idea"),
  publishAt: when,
  ownerId: ref,
  campaignId: ref,
  caption: text,
  link,
  notes: text,
  assetFileId: ref,
});

export const postStatusSchema = z.object({ status: z.enum(POST_STATUSES) });

/** Money in major units as typed (BHD 500 = 500); blank = no budget set. */
const optionalAmount = z
  .union([z.coerce.number().min(0).max(1_000_000_000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const campaignSchema = z.object({
  name: requiredText,
  channel: z.enum(CAMPAIGN_CHANNELS as [string, ...string[]]),
  status: z.enum(CAMPAIGN_STATUSES).default("active"),
  goal: text,
  startDate: ymd,
  endDate: ymd,
  budget: optionalAmount,
  currency: currency.default("BHD"),
  ownerId: ref,
  notes: text,
});

export const campaignNumbersSchema = z.object({
  metricDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  /** Major units, in the campaign's currency. */
  spend: z.coerce.number().min(0).max(1_000_000_000).default(0),
  leadsCaptured: z.coerce.number().int().min(0).max(1_000_000).default(0),
  conversions: z.coerce.number().int().min(0).max(1_000_000).default(0),
  /** Partners only; ignored for anyone else. Major units. */
  revenue: z.coerce.number().min(0).max(1_000_000_000).optional(),
});

/** The checked form → what the data layer stores (budget in minor units). */
export function toCampaignInput({ budget, ...v }: z.output<typeof campaignSchema>): CampaignInput {
  return { ...v, channel: v.channel as CampaignInput["channel"], budgetCents: budget === null ? null : majorToMinorUnits(budget, v.currency) };
}
