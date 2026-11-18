"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ProductWiseReportView } from "./components/product-wise-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_PRODUCT_WISE}>
      <PageWrapper
        title="Product Wise Report"
        description="Opening stock, purchases, sales, adjustments and closing stock per product."
      >
        <ProductWiseReportView />
      </PageWrapper>
    </ProtectedPage>
  );
}
