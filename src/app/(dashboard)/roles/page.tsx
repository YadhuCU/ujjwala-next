"use client";

import Link from "next/link";
import { History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { RoleViewComponent } from "./components/role-view";

export default function RolesPage() {
  const { hasPermission } = usePermission();

  return (
    <ProtectedPage requiredPermission={PERMISSIONS.ROLE_READ}>
      <PageWrapper
        title="Roles & permissions"
        addButton={
          <div className="ml-auto flex gap-2">
            <Button asChild variant="outline">
              <Link href="/roles/audit">
                <History className="mr-2 h-4 w-4" />
                Access history
              </Link>
            </Button>
            {hasPermission(PERMISSIONS.ROLE_CREATE) && (
              <Button asChild>
                <Link href="/roles/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Role
                </Link>
              </Button>
            )}
          </div>
        }
      >
        <RoleViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
