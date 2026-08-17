"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { StockAdjustmentViewComponent } from "./components/stock-adjustment-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.STOCK_READ}>
      <PageWrapper
        title="Stock Adjustments"
        description="Manual godown corrections, each with the reason it was posted."
        addButton={
          <Button asChild className="ml-auto">
            <Link href="/stock-adjustments/add">
              <Plus className="w-4 h-4 mr-2" />
              New Adjustment
            </Link>
          </Button>
        }
      >
        <StockAdjustmentViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
