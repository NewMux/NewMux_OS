import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { hostingSubscriptionSchema } from "@/lib/validators/hosting";
import { toHostingInput } from "@/lib/validators/hostingInput";
import { deleteHostingSubscription, updateHostingSubscription } from "@/lib/data/hosting";

type P = { id: string };

export const PATCH = route<P>({ allow: canAccessFinance }, async ({ req, params }) => ({
  subscription: await updateHostingSubscription(params.id, toHostingInput(await body(req, hostingSubscriptionSchema))),
}));

export const DELETE = route<P>({ allow: canAccessFinance }, async ({ params, session }) => {
  await deleteHostingSubscription(params.id, session.user.id);
  return { ok: true };
});
