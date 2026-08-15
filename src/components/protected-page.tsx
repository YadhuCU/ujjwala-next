"use client";

import { usePermission } from "@/hooks/use-permissions";
import { Permission } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { Fragment, ReactNode, useEffect } from "react";
import LayoutLoader from "./layout-loader";

type ProtectedPageProps = {
  children: ReactNode,
  requiredPermission: Permission
}

export const ProtectedPage = ({ requiredPermission, children }: ProtectedPageProps) => {
  const router = useRouter();
  const { hasPermission, status } = usePermission()

  useEffect(() => {
    if(status === "loading") return;

    if (!hasPermission(requiredPermission)) {
      router.replace("/403")
    }
  }, [requiredPermission, hasPermission, router, status])

  if (status === "loading") {
    return <LayoutLoader />
  }

  if (!hasPermission(requiredPermission)) {
    return null;
  }

  return (
    <Fragment>
      {children}
    </Fragment>
  )
}