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
  // PGlite ships WASM + data files that must be loaded from node_modules at
  // runtime rather than bundled; postgres.js likewise stays external.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // db/migrations + db/seed.sql are read with fs at runtime.
  outputFileTracingIncludes: { "/**": ["./db/**/*.sql"] },
};

export default withPWA(nextConfig);
