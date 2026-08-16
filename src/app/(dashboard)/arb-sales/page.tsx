"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ARBSalesViewComponent } from "./components/arb-sale-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.ARB_SALE_READ}>
      <PageWrapper
        title="ARB Sales"
        addButton={
          <Button asChild className="ml-auto">
            <Link href="/arb-sales/add">
              <Plus className="w-4 h-4 mr-2" />
              Add ARB Sale
            </Link>
          </Button>
        }
      >
        <ARBSalesViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
