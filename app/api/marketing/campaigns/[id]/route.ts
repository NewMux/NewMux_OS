import { route, body } from "@/lib/api";
import { canAccessMarketing } from "@/lib/rbac";
import { deleteMarketingCampaign, updateMarketingCampaign } from "@/lib/data/marketing";
import { campaignSchema, toCampaignInput } from "@/lib/validators/marketing";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessMarketing }, async ({ req, params }) => {
  await updateMarketingCampaign(params.id, toCampaignInput(await body(req, campaignSchema)));
  return { ok: true };
});

/** Its posts and deals stay, just no longer linked to it. */
export const DELETE = route<P>({ allow: canAccessMarketing }, async ({ params, session }) => {
  await deleteMarketingCampaign(params.id, session.user.id);
  return { ok: true };
});
