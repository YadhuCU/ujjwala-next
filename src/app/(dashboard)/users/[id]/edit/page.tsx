"use client";

import { ProtectedPage } from "@/components/protected-page";
import { UserUpdatePage } from "../../components/user-update-page";
import { PERMISSIONS } from "@/lib/permissions";

export default function EditUserPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.USER_UPDATE}>
      <UserUpdatePage />
    </ProtectedPage>
  )
}
