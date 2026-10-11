import { route, body } from "@/lib/api";
import { deletePushSubscription, savePushSubscription } from "@/lib/data/notifications";
import { pushSubscriptionSchema, pushUnsubscribeSchema } from "@/lib/validators/notifications";

/** This device turns notifications on for the signed-in user. */
export const POST = route({ status: 201 }, async ({ req, session }) => {
  const { endpoint, keys, device } = await body(req, pushSubscriptionSchema);
  await savePushSubscription(session.user.id, { endpoint, p256dh: keys.p256dh, auth: keys.auth, device: device ?? null });
  return { ok: true };
});

/** This device turns them off. */
export const DELETE = route({}, async ({ req, session }) => {
  await deletePushSubscription(session.user.id, (await body(req, pushUnsubscribeSchema)).endpoint);
  return { ok: true };
});
