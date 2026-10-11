import { route, body } from "@/lib/api";
import { canAccessCrm, canSeeMoney } from "@/lib/rbac";
import { dealSchema } from "@/lib/validators/crm";
import { createDeal, withoutValue } from "@/lib/data/crm";
import { majorToMinorUnits } from "@/lib/money";

export const POST = route({ allow: canAccessCrm, status: 201 }, async ({ req, session }) => {
  const { value, ...input } = await body(req, dealSchema);
  // Marketing adds deals without a value; a partner fills it in.
  const money = canSeeMoney(session);
  const deal = await createDeal({ ...input, valueCents: money ? majorToMinorUnits(value, input.currency) : 0 }, session.user.id);
  return { deal: money ? deal : withoutValue(deal) };
});
