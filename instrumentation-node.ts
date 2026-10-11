import { runDueNotifications } from "./lib/push/notify";

/** Started by instrumentation.ts on a Node server: the 5-minute notification check. */
export function startNotificationTimer() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runDueNotifications();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[push] scheduled check failed", error);
    } finally {
      running = false;
    }
  };
  setInterval(() => void tick(), 5 * 60_000).unref?.();
  setTimeout(() => void tick(), 30_000).unref?.();
}
