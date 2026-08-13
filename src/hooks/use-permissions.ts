import { useSession } from "next-auth/react";
import { Permission, ROLES } from "@/lib/permissions";
import { useCallback, useMemo } from "react";

// The session carries role *names* as seeded in the DB (OWNER / OFFICE_STAFF /
// FIELD_STAFF) — a user can hold more than one.
export function usePermissions() {
  const { data: session } = useSession();
  const roles = useMemo(
    () => session?.user?.roles ?? [],
    [session?.user?.roles],
  );

  const isAdmin = roles.includes(ROLES.OWNER);
  const isOffice = roles.includes(ROLES.OFFICE_STAFF);
  const isSales = roles.includes(ROLES.FIELD_STAFF);

  return {
    roles,
    role: roles[0],
    isAdmin,
    isOffice,
    isSales,
  };
}

export function usePermission() {
  const { data: session, status } = useSession();

  const permissions = useMemo(() => session?.user.permissions ?? [], [session?.user.permissions])

  const hasPermission = useCallback(function (permission: Permission) {
    return permissions.includes(permission)
  }, [permissions])

  const hasAnyPermission = useCallback(function (required: Permission[]) {
    return required.some(p => permissions.includes(p))
  }, [permissions])

  const hasAllPermission = useCallback(function (required: Permission[]) {
    return required.every(p => permissions.includes(p))
  },[permissions])

  return {
    status,
    permissions,
    hasPermission,
    hasAllPermission,
    hasAnyPermission
  }
}