import type { NextAuthConfig } from "next-auth";
import { UserRole } from "./constants";

export const authConfig = {
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
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }

      if (!isLoggedIn) return false;

      // Owner only pages
      const ADMIN_ONLY_PAGES = ["/users"];
      const role = (auth?.user as { role?: string })?.role;
      const isGoingToAdminPage = ADMIN_ONLY_PAGES.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + "/")
      );

      if (isGoingToAdminPage && role !== "Owner") {
        return Response.redirect(new URL("/", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
