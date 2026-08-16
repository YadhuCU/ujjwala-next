"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ExpenseCreateComponent } from "../components/expense-create";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.EXPENSE_CREATE}>
      <PageWrapper title="Add Expense" showBackButton>
        <ExpenseCreateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
