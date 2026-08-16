"use client";

import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ExpenseUpdateComponent } from "../../components/expense-update";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.EXPENSE_UPDATE}>
      <PageWrapper title="Edit Expense" showBackButton>
        <ExpenseUpdateComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
