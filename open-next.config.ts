import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Settings for the Cloudflare Workers build (`opennextjs-cloudflare build`,
// run by `npm run cf:build` and by Cloudflare's own build). The OpenNext CLI
// loads this file before it runs `next build`, and the build inherits these.
// The Docker build never loads it, so the self-hosted deployment is unchanged.
process.env.NEWMUX_TARGET = "cloudflare"; // next.config.ts: leave out PGlite, serve images as-is
process.env.NEXT_PUBLIC_MAX_FILE_MB ??= "4"; // lib/fileLimits.ts: a Worker has 128 MB of memory

// Every page reads live data from Postgres, so no incremental cache is configured.
export default defineCloudflareConfig();
