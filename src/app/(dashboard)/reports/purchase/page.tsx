"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { PurchaseReportView } from "./components/purchase-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper title="Purchase Report" description="Vendor deliveries and what they cost.">
        <PurchaseReportView />
      </PageWrapper>
    </ProtectedPage>
  );
}
