import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const ADMIN_ONLY_PAGES = ["/users", "/user-types"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Block staff from admin-only pages
  if (isLoggedIn) {
    const role = (req.auth?.user as { role?: string })?.role;
    const pathname = req.nextUrl.pathname;

    if (role !== "admin") {
      const isAdminPage = ADMIN_ONLY_PAGES.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      if (isAdminPage) {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
