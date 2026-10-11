/**
 * On a self-hosted server (Docker, `next start`), check for due notifications
 * every 5 minutes from inside the app. Cloudflare Workers have no long-running
 * process; there the cron trigger in wrangler.jsonc does it instead
 * (cloudflare-worker.mjs → /api/cron/notifications).
 */
export async function register() {
  // Written this way so the edge build drops the import (NEXT_RUNTIME is replaced at build time).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
    if (!onWorkers && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const { startNotificationTimer } = await import("./instrumentation-node");
      startNotificationTimer();
    }
  }
}
