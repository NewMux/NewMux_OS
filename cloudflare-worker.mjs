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
};
