"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { StockCreateComponent } from "../components/stock-create";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.STOCK_CREATE}>
      <PageWrapper title="Add Stock Batch" showBackButton>
        <StockCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
