import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { hostingSubscriptionSchema } from "@/lib/validators/hosting";
import { deleteHostingSubscription, updateHostingSubscription } from "@/lib/data/hosting";
import { majorToMinorUnits } from "@/lib/money";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessFinance }, async ({ req, params }) => {
  const { amount, ...input } = await body(req, hostingSubscriptionSchema);
  return { subscription: await updateHostingSubscription(params.id, { ...input, amountCents: majorToMinorUnits(amount, input.currency) }) };
});

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deleteHostingSubscription(params.id, session.user.id);
  return { ok: true };
});
