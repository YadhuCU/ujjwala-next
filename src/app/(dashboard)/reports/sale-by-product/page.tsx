"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { SaleByProductReportView } from "./components/sale-by-product-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper title="Sale by Product Report" description="Every sale model rolled up per product.">
        <SaleByProductReportView />
      </PageWrapper>
    </ProtectedPage>
  );
}
