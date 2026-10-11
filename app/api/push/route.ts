import { route } from "@/lib/api";
import { countPushSubscriptions } from "@/lib/data/notifications";
import { vapidKeys } from "@/lib/push/webpush";

/** The public key a browser subscribes with, and whether push is set up on the server. */
export const GET = route({}, async ({ session }) => {
  const keys = vapidKeys();
  return { configured: !!keys, publicKey: keys?.publicKey ?? null, devices: await countPushSubscriptions(session.user.id) };
});
