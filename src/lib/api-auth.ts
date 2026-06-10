import { auth } from "@/lib/auth";
import { Permission } from "./permissions";
import { Session } from "next-auth";

import { UnauthorizedError, ForbiddenError } from "./errors";
import { routeErrorHandler } from "./error-handler";
import { logError } from "./log";

/**
 * Authentication + Permissions + Global exception
 * @param [requiredPermissions=[]]
 * @param handler
 */
export async function withAuth(
  handler: (user: Session["user"]) => Promise<Response>,
  requiredPermissions: Permission[] = [],
): Promise<Response> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const userPermissions = session.user.permissions ?? [];

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenError();
    }

    return await handler(session.user);
  } catch (error) {
    logError(error);

    return routeErrorHandler(error);
  }
}
