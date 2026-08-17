"use client";

import { usePermission } from "@/hooks/use-permissions";
import { Permission } from "@/lib/permissions";
import { Fragment, ReactNode } from "react";

type PermissionGateProps = {
  permission: Permission
  children: ReactNode
}
export function PermissionGate({ permission, children }: PermissionGateProps) {
  const { hasPermission } = usePermission()

  if (!hasPermission(permission)) {
    return null;
  }

  return (
    <Fragment>
      {children}
    </Fragment>
  )
}