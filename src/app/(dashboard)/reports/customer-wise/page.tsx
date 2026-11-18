"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { CustomerWiseReportView } from "./components/customer-wise-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_CUSTOMER_WISE}>
      <PageWrapper
        title="Customer Wise Report"
        description="Each customer's cylinders and money over the selected range."
      >
        <CustomerWiseReportView />
      </PageWrapper>
    </ProtectedPage>
  );
}
