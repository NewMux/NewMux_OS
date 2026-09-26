import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { payoutSchema } from "@/lib/validators/finance";
import { deletePayout, updatePayout } from "@/lib/data/ledger";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessFinance }, async ({ req, params, session }) => {
  const { amount, ...input } = await body(req, payoutSchema);
  return { payout: await updatePayout(params.id, { ...input, amountCents: majorToMinorUnits(amount, input.currency) }, session.user.id) };
});

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deletePayout(params.id, session.user.id);
  return { ok: true };
});
