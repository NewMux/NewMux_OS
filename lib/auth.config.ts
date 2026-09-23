import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe config used by middleware.ts. Must not import bcryptjs, the
 * postgres driver, or anything Node-only — middleware runs on the Edge
 * runtime. The Credentials provider itself is added in lib/auth.ts.
 */
export const authConfig: NextAuthConfig = {
  // Internal-only single-tenant app served from a known host — safe to trust
  // without requiring an exact NEXTAUTH_URL match in every environment.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/home", request.nextUrl));
        }
        return true;
      }
      return isLoggedIn;
    },
  },
  providers: [],
};
