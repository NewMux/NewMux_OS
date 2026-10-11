import { route } from "@/lib/api";
import { ValidationError } from "@/lib/data/sql";
import { sendToUsers } from "@/lib/push/notify";
import { vapidKeys } from "@/lib/push/webpush";

/** "Send a test" in Settings: one notification to each of your devices. */
export const POST = route({}, async ({ session }) => {
  if (!vapidKeys()) throw new ValidationError("Notifications aren't set up on the server yet (VAPID keys are missing).");
  const reached = await sendToUsers([session.user.id], { title: "NEWMUX OS", body: "Notifications are working on this device.", url: "/settings", tag: "test" });
  if (!reached) throw new ValidationError("No device took the notification. Turn notifications off and on again on this device.");
  return { reached };
});
