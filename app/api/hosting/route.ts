import { route, body } from "@/lib/api";
import { canAccessFinance } from "@/lib/rbac";
import { hostingSubscriptionSchema } from "@/lib/validators/hosting";
import { toHostingInput } from "@/lib/validators/hostingInput";
import { createHostingSubscription, listHostingSubscriptions } from "@/lib/data/hosting";

export const GET = route({ allow: canAccessFinance }, async () => ({ subscriptions: await listHostingSubscriptions() }));

export const POST = route({ allow: canAccessFinance, status: 201 }, async ({ req }) => ({
  subscription: await createHostingSubscription(toHostingInput(await body(req, hostingSubscriptionSchema))),
}));
