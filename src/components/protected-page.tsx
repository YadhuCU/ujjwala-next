"use client";

import { usePermission } from "@/hooks/use-permissions";
import { Permission } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { Fragment, ReactNode, useEffect } from "react";
import LayoutLoader from "./layout-loader";

type ProtectedPageProps = {
  children: ReactNode;
  /**
   * One permission, or several of which any will do — the same any-of
   * semantics the sidebar uses, so a page and its nav link agree.
   *
   * This is presentation only. `withAuth` on the route is the real gate; this
   * exists so an unauthorised user gets a clear 403 page instead of a shell
   * that renders and then fails every request it makes.
   */
  requiredPermission: Permission | Permission[];
};

export const ProtectedPage = ({
  requiredPermission,
  children,
}: ProtectedPageProps) => {
  const router = useRouter();
  const { hasAnyPermission, status } = usePermission();

  const required = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  const allowed = hasAnyPermission(required);

  useEffect(() => {
    if (status === "loading") return;
    if (!allowed) router.replace("/403");
  }, [allowed, router, status]);

  if (status === "loading") {
    return <LayoutLoader />;
  }

  if (!allowed) {
    return null;
  }

  return <Fragment>{children}</Fragment>;
};
