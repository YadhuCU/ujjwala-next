"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import VendorsViewComponent from "./components/vendor-view";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

export default function VendorsPage() {
  const { hasPermission } = usePermission();
  // The button posts to /api/vendors, which requires VENDOR_CREATE — gating
  // it on VENDOR_UPDATE showed a button that 403s.
  const canCreate = hasPermission(PERMISSIONS.VENDOR_CREATE);

  return (
    <ProtectedPage requiredPermission={PERMISSIONS.VENDOR_READ}>
      <PageWrapper
        title="Vendors"
        addButton={
          canCreate && (
            <Button asChild className="ml-auto">
              <Link href="/vendors/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Vendor
              </Link>
            </Button>
          )
        }
      >
        <VendorsViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
