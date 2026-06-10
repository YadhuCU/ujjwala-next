import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";
import { Permission } from "@/lib/permissions";
import { useCallback, useMemo } from "react";

export function usePermissions() {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  const isAdmin = role === "Owner";
  const isOffice = role === "Office";
  const isSales = role === "Sales";

  return {
    role,
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