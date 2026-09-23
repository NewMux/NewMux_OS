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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // PGlite ships WASM + data files that must be loaded from node_modules at
  // runtime rather than bundled; postgres.js likewise stays external.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Files read at runtime that the standalone tracer can't see: db/migrations +
  // db/seed.sql (read with fs) and pdfkit's fonts (loaded via "#standard-fonts/*"
  // package imports, used by the PDF exports).
  outputFileTracingIncludes: {
    "/**": ["./db/**/*.sql", "./node_modules/pdfkit/js/standard-fonts/**"],
  },
};

export default withPWA(nextConfig);
