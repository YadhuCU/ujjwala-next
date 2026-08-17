"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { RoleCreateComponent } from "../components/role-create";

export default function AddRolePage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.ROLE_CREATE}>
      <PageWrapper title="Add Role" showBackButton>
        <RoleCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
