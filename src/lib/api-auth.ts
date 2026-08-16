import { auth } from "@/lib/auth";
import { Permission } from "./permissions";
import { Session } from "next-auth";

import { UnauthorizedError, ForbiddenError } from "./errors";
import { routeErrorHandler } from "./error-handler";
import { logError } from "./log";
import { loadRbacCached } from "./rbac";

/**
 * What a route handler is given. The session supplies identity; roles and
 * permissions are re-read from the database (see `rbac.ts` for why the cookie
 * cannot be trusted for this), so a revoked permission stops working within
 * seconds rather than at the user's next sign-in.
 *
 * `id` and `roles` keep their original shape so existing handlers are
 * unaffected; `userId`, `permissions` and `isOwner` are what scoped handlers use.
 */
export type AuthActor = Session["user"] & {
  userId: number;
  permissions: Permission[];
  isOwner: boolean;
};

/**
 * Either every listed permission, or any one of them. A bare array means ALL,
 * which is what every existing call site expects.
 */
export type PermissionRequirement =
  | Permission[]
  | { anyOf: Permission[] }
  | { allOf: Permission[] };

function satisfies(
  required: PermissionRequirement,
  held: Permission[],
): boolean {
  if (Array.isArray(required))
    return required.every((permission) => held.includes(permission));

  if ("anyOf" in required)
    return required.anyOf.some((permission) => held.includes(permission));

  return required.allOf.every((permission) => held.includes(permission));
}

/**
 * Authentication + permissions + global exception handling.
 *
 * Note the default: `withAuth(handler)` with no requirement means "any signed-in
 * user". That is intentional for lookup endpoints but easy to reach by accident,
 * so state the requirement explicitly unless a route is genuinely public to all
 * authenticated users.
 */
export async function withAuth(
  handler: (user: AuthActor) => Promise<Response>,
  requiredPermissions: PermissionRequirement = [],
): Promise<Response> {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      throw new UnauthorizedError();
    }

    const userId = Number(session.user.id);
    const snapshot = await loadRbacCached(userId);

    // Deactivated or deleted since the token was issued.
    if (!snapshot) throw new UnauthorizedError();

    // A user with no roles can do nothing. Failing here says so once, instead
    // of letting every request 403 with no explanation.
    if (snapshot.roles.length === 0) throw new UnauthorizedError();

    // A system role is allowed everything, so adding a permission code in a
    // release cannot lock the owner out before the seed has run.
    if (!snapshot.isOwner && !satisfies(requiredPermissions, snapshot.permissions)) {
      throw new ForbiddenError();
    }

    return await handler({
      ...session.user,
      userId,
      roles: snapshot.roles,
      permissions: snapshot.permissions,
      isOwner: snapshot.isOwner,
    });
  } catch (error) {
    logError(error);

    return routeErrorHandler(error);
  }
}
