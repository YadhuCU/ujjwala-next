"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { StockUpdateComponent } from "../../components/stock-update";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.STOCK_UPDATE}>
      <PageWrapper title="Edit Stock Batch" showBackButton>
        <StockUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
