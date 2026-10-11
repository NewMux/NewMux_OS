// Cloudflare Workers entry point (wrangler.jsonc "main"), wrapping the worker
// that `npm run cf:build` generates.
//
// The login library (Auth.js) builds its URLs and picks its session cookie name
// ("__Secure-" on https) from the x-forwarded-proto / x-forwarded-host headers.
// Inside a Worker, Next.js fills in x-forwarded-proto from the connection, which
// always looks like plain http: sign-in then sets the "__Secure-" cookie while
// every server-side session check looks for the plain one, and nobody can stay
// logged in. Clients can also send these headers themselves. So set both from
// the real request URL, whatever the client sent.
import handler from "./.open-next/worker.js";

export default {
  /** @param {Request} request */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));
    headers.set("x-forwarded-host", url.host);
    return handler.fetch(new Request(request, { headers }), env, ctx);
  },

  /**
   * The cron trigger in wrangler.jsonc (every 5 minutes): sends due
   * notifications through the app's own /api/cron/notifications, which checks
   * CRON_SECRET. The request never leaves the Worker.
   */
  async scheduled(_event, env, ctx) {
    if (!env.CRON_SECRET) {
      console.log("[cron] CRON_SECRET is not set; skipping notifications");
      return;
    }
    const request = new Request("https://cron.internal/api/cron/notifications", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}`, "x-forwarded-proto": "https", "x-forwarded-host": "cron.internal" },
    });
    const res = await handler.fetch(request, env, ctx);
    console.log(`[cron] notifications ${res.status}: ${(await res.text()).slice(0, 300)}`);
  },
};
