"use client";

import { use } from "react";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { RoleUpdateComponent } from "../../components/role-update";

export default function EditRolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <ProtectedPage requiredPermission={PERMISSIONS.ROLE_UPDATE}>
      <PageWrapper title="Edit Role" showBackButton>
        <RoleUpdateComponent id={id} />
      </PageWrapper>
    </ProtectedPage>
  );
}
