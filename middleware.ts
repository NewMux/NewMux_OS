import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

// API routes are excluded: each one authenticates itself (see lib/api.ts), and
// the Paddle webhook must stay reachable without a session. /d/… is the link
// to an issued document sent to a client; /doc/… holds its fonts and header.
export const config = {
  matcher: [
    "/((?!api/|d/|doc/|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|splash|sw.js|swe-worker-.*\\.js|worker-.*\\.js|workbox-.*\\.js).*)",
  ],
};
