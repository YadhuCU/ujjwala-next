"use client";

import { ProtectedPage } from "@/components/protected-page";
import { UserViewPage } from "./components/user-view-page";
import { PERMISSIONS } from "@/lib/permissions";

export default function UsersPage() {

  return (
    <ProtectedPage requiredPermission={PERMISSIONS.USER_READ}>
      <UserViewPage />
    </ProtectedPage>
  );
}
