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
        urlPattern: /^\/dashboard/,
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
};

export default withPWA(nextConfig);
