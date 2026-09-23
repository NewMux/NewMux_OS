import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { dealSchema } from "@/lib/validators/crm";
import { createDeal } from "@/lib/data/crm";
import { majorToMinorUnits } from "@/lib/money";

export const POST = route({ allow: canAccessCrm, status: 201 }, async ({ req, session }) => {
  const { value, ...input } = await body(req, dealSchema);
  return { deal: await createDeal({ ...input, valueCents: majorToMinorUnits(value, input.currency) }, session.user.id) };
});
