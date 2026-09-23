import { route, body } from "@/lib/api";
import { canAccessCrm } from "@/lib/rbac";
import { updateDealSchema } from "@/lib/validators/crm";
import { deleteDeal, getDealById, updateDeal } from "@/lib/data/crm";
import { NotFoundError } from "@/lib/data/sql";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCrm }, async ({ req, params }) => {
  const { value, stage: _stage, ...patch } = await body(req, updateDealSchema);
  const current = await getDealById(params.id);
  if (!current) throw new NotFoundError("Deal");
  const currency = patch.currency ?? current.currency;
  return {
    deal: await updateDeal(params.id, { ...patch, valueCents: value === undefined ? undefined : majorToMinorUnits(value, currency) }),
  };
});

export const DELETE = route<P>({ allow: canAccessCrm }, async ({ params, session }) => {
  await deleteDeal(params.id, session.user.id);
  return { ok: true };
});
