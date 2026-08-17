"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { StockAdjustmentCreateComponent } from "../components/stock-adjustment-create";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.STOCK_UPDATE}>
      <PageWrapper title="New Stock Adjustment" showBackButton>
        <StockAdjustmentCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
