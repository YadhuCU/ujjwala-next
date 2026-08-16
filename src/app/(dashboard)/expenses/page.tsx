"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { ProtectedPage } from "@/components/protected-page";
import { PERMISSIONS } from "@/lib/permissions";
import { ExpensesViewComponent } from "./components/expense-view";

export default function Page() {
  return (
    <ProtectedPage requiredPermission={PERMISSIONS.EXPENSE_READ}>
      <PageWrapper
        title="Expenses"
        addButton={
          <Button asChild className="ml-auto">
            <Link href="/expenses/add">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Link>
          </Button>
        }
      >
        <ExpensesViewComponent />
      </PageWrapper>
    </ProtectedPage>
  );
}
