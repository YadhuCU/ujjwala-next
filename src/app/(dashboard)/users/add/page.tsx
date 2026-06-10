"use client"

import { ProtectedPage } from "@/components/protected-page";
import { UserCreatePage } from "../components/user-create-page";
import { PERMISSIONS } from "@/lib/permissions";

export default function AddUserPage() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.USER_CREATE}>
      <UserCreatePage />
    </ProtectedPage>
  );
}
