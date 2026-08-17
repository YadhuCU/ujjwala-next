import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  // The agency runs this itself, on a LAN address rather than a public domain.
  // Auth.js only trusts the request host automatically in dev, so without this
  // a production `next start` rejects every sign-in with UntrustedHost.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
      const isPublicRoute = ["/login"].includes(nextUrl.pathname);

      if (isApiAuthRoute) return true;

      if (isPublicRoute) {
        // Prevent logged-in users from visiting login page
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      if (!isLoggedIn) return false;

      return true;
    },
    // No `jwt` callback here on purpose. This config is bundled for the edge
    // middleware, where Prisma cannot run, and the real implementation needs a
    // database. It lives in `auth.ts`; Auth.js supplies a passthrough default.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.roles = token.roles;
        session.user.permissions = token.permissions;
        session.user.isOwner = token.isOwner;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
