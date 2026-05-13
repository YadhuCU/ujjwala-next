import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { Permission } from "./permissions";


/**
 * Wrapper to use requireAuth in route handlers.
 * Catches the thrown NextResponse and returns it.
 */
export async function withAuth(
  handler: () => Promise<NextResponse>,
  requiredPermissions: Permission[] = []
): Promise<NextResponse> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userPermissions = session.user.permissions ?? [];

    // Permission validation
    const hasPermission = requiredPermissions.every(permission => userPermissions.includes(permission))

    if(!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403})
    }

    return handler();

  } catch (error) {
    if (error instanceof NextResponse) return error;
    console.error(error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
