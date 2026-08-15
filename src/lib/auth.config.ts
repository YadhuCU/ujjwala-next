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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.roles = user.roles;
        token.permissions = user.permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.roles = token.roles;
        session.user.permissions = token.permissions;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
