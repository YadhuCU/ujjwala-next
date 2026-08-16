"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { SaleReportView } from "../_components/sale-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper
        title="Domestic Sale Report"
        description="Domestic invoices with totals for the selected range."
      >
        <SaleReportView kind="dom" />
      </PageWrapper>
    </ProtectedPage>
  );
}
