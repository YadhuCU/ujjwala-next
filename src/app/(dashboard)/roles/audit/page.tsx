"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { RbacAuditViewComponent } from "../components/rbac-audit-view";

export default function RbacAuditPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.ROLE_READ}>
      <PageWrapper
        title="Access history"
        description="Every change to a role or to who holds it, in order."
        showBackButton
      >
        <RbacAuditViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
