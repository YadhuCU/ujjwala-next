"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import VendorsViewComponent from "./components/vendor-view";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";

export default function VendorsPage() {
  const { hasPermission } = usePermission();
  const vendorUpdatePermission = hasPermission(PERMISSIONS.VENDOR_UPDATE);

  return (
    <PageWrapper
      title="Vendors"
      addButton={
        vendorUpdatePermission && (
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
  );
}
