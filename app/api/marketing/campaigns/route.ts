import { route, body } from "@/lib/api";
import { canAccessMarketing, canSeeMoney } from "@/lib/rbac";
import { createMarketingCampaign, listMarketingCampaigns } from "@/lib/data/marketing";
import { campaignSchema, toCampaignInput } from "@/lib/validators/marketing";

export const GET = route({ allow: canAccessMarketing }, async ({ session }) => ({ campaigns: await listMarketingCampaigns({ money: canSeeMoney(session) }) }));

export const POST = route({ allow: canAccessMarketing, status: 201 }, async ({ req, session }) => ({
  campaign: await createMarketingCampaign(toCampaignInput(await body(req, campaignSchema)), session.user.id),
}));
