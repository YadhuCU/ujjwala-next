import { useSession } from "next-auth/react";
import { Permission } from "@/lib/permissions";
import { useCallback, useMemo } from "react";

/**
 * What the signed-in user may do, for deciding what to render.
 *
 * This is presentation only. The session's copy of the permission list is a
 * hint refreshed on a timer — `withAuth` on the route is the real gate, and it
 * re-reads from the database. Hiding a button here is a courtesy, not security.
 *
 * There used to be a second, role-based hook beside this one (`usePermissions`,
 * plural) exposing `isAdmin`. It has gone: comparing role names is what stopped
 * a newly created role from ever being granted anything.
 */
export function usePermission() {
  const { data: session, status } = useSession();

  const permissions = useMemo(
    () => session?.user.permissions ?? [],
    [session?.user.permissions],
  );

  // A system role is allowed everything, so the UI must agree with the server
  // rather than looking for a permission row that may not exist.
  const isOwner = session?.user.isOwner === true;

  const hasPermission = useCallback(
    (permission: Permission) => isOwner || permissions.includes(permission),
    [permissions, isOwner],
  );

  const hasAnyPermission = useCallback(
    (required: Permission[]) =>
      isOwner || required.some((permission) => permissions.includes(permission)),
    [permissions, isOwner],
  );

  const hasAllPermission = useCallback(
    (required: Permission[]) =>
      isOwner ||
      required.every((permission) => permissions.includes(permission)),
    [permissions, isOwner],
  );

  return {
    status,
    permissions,
    isOwner,
    hasPermission,
    hasAllPermission,
    hasAnyPermission,
  };
}
