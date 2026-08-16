"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ExpenseReportView } from "./components/expense-report-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.REPORT_READ}>
      <PageWrapper title="Expense Report" description="Recorded spending for the selected range.">
        <ExpenseReportView />
      </PageWrapper>
    </ProtectedPage>
  );
}
