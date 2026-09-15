import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // api/webhooks is excluded because Paddle posts unauthenticated: those routes
    // gate on an HMAC signature (lib/paddle/verify.ts), and letting the session
    // check run first would redirect the delivery to /login.
    "/((?!api/auth|api/webhooks|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw.js|workbox-.*\\.js).*)",
  ],
};
