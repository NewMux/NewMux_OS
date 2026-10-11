import { route, body } from "@/lib/api";
import { canAccessCrm, canSeeMoney } from "@/lib/rbac";
import { updateDealSchema } from "@/lib/validators/crm";
import { deleteDeal, getDealById, updateDeal, withoutValue } from "@/lib/data/crm";
import { NotFoundError } from "@/lib/data/sql";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessCrm }, async ({ req, params, session }) => {
  const { value, currency: newCurrency, stage: _stage, ...rest } = await body(req, updateDealSchema);
  const current = await getDealById(params.id);
  if (!current) throw new NotFoundError("Deal");
  if (!canSeeMoney(session)) {
    // The value and its currency are partners' to set; everything else is open to Marketing.
    return { deal: withoutValue(await updateDeal(params.id, rest)) };
  }
  const currency = newCurrency ?? current.currency;
  return {
    deal: await updateDeal(params.id, { ...rest, currency: newCurrency, valueCents: value === undefined ? undefined : majorToMinorUnits(value, currency) }),
  };
});

export const DELETE = route<P>({ allow: canAccessCrm }, async ({ params, session }) => {
  await deleteDeal(params.id, session.user.id);
  return { ok: true };
});
