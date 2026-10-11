import { route, body } from "@/lib/api";
import { canAccessMarketing, canSeeMoney } from "@/lib/rbac";
import { logCampaignNumbers } from "@/lib/data/marketing";
import { campaignNumbersSchema } from "@/lib/validators/marketing";
import { one, NotFoundError } from "@/lib/data/sql";
import { majorToMinorUnits } from "@/lib/money";

/** A day's spend, leads and conversions (and, for partners, revenue). Logging the same day again replaces it. */
export const POST = route<{ id: string }>({ allow: canAccessMarketing, status: 201 }, async ({ req, params, session }) => {
  const input = await body(req, campaignNumbersSchema);
  const campaign = await one<{ currency: string }>("select currency from campaigns where id = $1", [params.id]);
  if (!campaign) throw new NotFoundError("Campaign");
  await logCampaignNumbers({
    campaignId: params.id,
    metricDate: input.metricDate,
    spendCents: majorToMinorUnits(input.spend, campaign.currency),
    leadsCaptured: input.leadsCaptured,
    conversions: input.conversions,
    revenueCents: canSeeMoney(session) && input.revenue !== undefined ? majorToMinorUnits(input.revenue, campaign.currency) : undefined,
  });
  return { ok: true };
});
