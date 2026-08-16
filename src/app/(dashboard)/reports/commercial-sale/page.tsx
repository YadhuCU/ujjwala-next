"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { SaleReportView } from "../_components/sale-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper
        title="Commercial Sale Report"
        description="Commercial invoices, including cylinders still with customers."
      >
        <SaleReportView kind="commercial" />
      </PageWrapper>
    </ProtectedPage>
  );
}
