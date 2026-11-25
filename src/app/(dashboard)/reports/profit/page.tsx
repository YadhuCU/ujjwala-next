"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ProfitReportView } from "./components/profit-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_PROFIT}>
      <PageWrapper
        title="Profit Report"
        description="Sales, cost and gross profit, by category or by item."
      >
        <ProfitReportView />
      </PageWrapper>
    </ProtectedPage>
  );
}
