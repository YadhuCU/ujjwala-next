"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { ExpenseForm } from "../components/expense-form";
import type { ExpenseFormValues } from "../components/expense-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddExpensePage() {
  const router = useRouter();

  const createExpense = useApiMutation({
    url: "/api/expenses",
    invalidateKeys: [queryKeys.expenses.all],
    onSuccess: () => {
      toast.success("Expense added");
      router.push("/expenses");
    },
  });

  return (
    <PageWrapper title="Add Expense" showBackButton>
      <ExpenseForm
        onSubmit={(values: ExpenseFormValues) => createExpense.mutate(values)}
        isPending={createExpense.isPending}
      />
    </PageWrapper>
  );
}
