import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
    runtimeCaching: [
      {
        // App screens: fresh when online, last-seen copy when offline.
        urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
          sameOrigin && request.mode === "navigate",
        handler: "NetworkFirst",
        options: {
          cacheName: "app-shell",
          networkTimeoutSeconds: 3,
        },
      },
      {
        urlPattern: /\/_next\/static\/.*/,
        handler: "CacheFirst",
        options: {
          cacheName: "static-assets",
        },
      },
      {
        urlPattern: /\/api\/.*/,
        handler: "NetworkOnly",
      },
    ],
  },
});

// Set by open-next.config.ts when building for Cloudflare Workers (npm run cf:build).
const forCloudflare = process.env.NEWMUX_TARGET === "cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // PGlite ships WASM + data files that must be loaded from node_modules at
  // runtime rather than bundled; postgres.js likewise stays external.
  serverExternalPackages: forCloudflare ? ["postgres"] : ["@electric-sql/pglite", "postgres"],
  // Next treats @react-pdf/renderer as an external server package by default;
  // for Cloudflare it is bundled instead (see the alias below).
  transpilePackages: forCloudflare ? ["@react-pdf/renderer"] : [],
  // Leave code out of the Worker that it never runs, which keeps it small and
  // quick to start: the embedded PGlite dev database (Workers always use
  // Postgres) and @react-pdf/renderer (PDFs are built in the browser, lib/pdf).
  webpack: (config, { isServer }) => {
    if (forCloudflare && isServer) {
      config.resolve.alias = { ...config.resolve.alias, "@electric-sql/pglite": false, "@react-pdf/renderer": false };
    }
    return config;
  },
  // Icons are served as-is; Workers have no built-in image optimizer.
  images: { unoptimized: forCloudflare },
  // Files read at runtime that the standalone tracer can't see: db/migrations +
  // db/seed.sql (read with fs). PDFs are rendered in the browser (lib/pdf).
  outputFileTracingIncludes: {
    "/**": ["./db/**/*.sql"],
  },
  // Internal app on an unlisted subdomain: keep every response (pages, the
  // login screen, PDF/CSV exports) out of search engines. No robots.txt
  // Disallow on purpose — crawlers must be able to fetch a URL to see this.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default withPWA(nextConfig);
