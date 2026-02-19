import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

type AuthResult = {
  userId: number;
  role: "admin" | "staff";
};

/**
 * Require authentication for an API route.
 * Returns { userId, role } or throws a NextResponse error.
 *
 * @param requiredRole - If "admin", staff users will get 403
 */
export async function requireAuth(
  requiredRole?: "admin"
): Promise<AuthResult> {
  const session = await auth();

  if (!session?.user?.id) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role === "admin" ? "admin" : "staff";

  if (requiredRole === "admin" && role !== "admin") {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId: parseInt(session.user.id), role };
}

/**
 * Wrapper to use requireAuth in route handlers.
 * Catches the thrown NextResponse and returns it.
 */
export async function withAuth(
  handler: (authResult: AuthResult) => Promise<NextResponse>,
  requiredRole?: "admin"
): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(requiredRole);
    return handler(authResult);
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
