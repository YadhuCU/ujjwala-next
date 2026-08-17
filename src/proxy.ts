import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // `/api` is excluded deliberately. Auth.js re-signs and re-emits the session
  // cookie on every request the middleware matches, and `withAuth` already
  // authorises every API route — so running middleware there bought nothing and
  // produced racing `Set-Cookie` headers, including two on /api/auth/session
  // (one from middleware carrying the old token, one from the handler carrying
  // the refreshed one).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
