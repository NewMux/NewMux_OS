import type { CampaignChannel } from "@/lib/data/types";

/**
 * Marketing's fixed lists, kept free of server code so screens can import
 * them (lib/data/marketing.ts re-exports them for the server side).
 */

export const POST_CHANNELS = ["instagram", "linkedin", "x", "tiktok", "facebook", "youtube", "website", "newsletter", "other"] as const;
export type PostChannel = (typeof POST_CHANNELS)[number];

export const POST_STATUSES = ["idea", "drafting", "review", "scheduled", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const CAMPAIGN_STATUSES = ["planned", "active", "paused", "completed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_CHANNELS: CampaignChannel[] = [
  "instagram",
  "linkedin",
  "meta_ads",
  "google_search",
  "tiktok",
  "x",
  "facebook",
  "youtube",
  "website",
  "newsletter",
  "outbound_email",
  "event",
  "referral",
  "other",
];
