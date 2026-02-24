"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ExpenseForm } from "../../components/expense-form";
import type { ExpenseFormValues } from "../../components/expense-form";
import { PageWrapper } from "@/components/page-wrapper";

interface ExpenseDetail {
  id: number;
  expense: string | null;
  date: string | null;
  amount: number | null;
}

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: expenseData, isLoading } = useQuery({
    queryKey: queryKeys.expenses.detail(id),
    queryFn: () => api.getById<ExpenseDetail>("expenses", id),
    enabled: !!id,
  });

  const updateExpense = useApiMutation({
    url: `/api/expenses/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.expenses.all],
    onSuccess: () => {
      toast.success("Expense updated");
      router.push("/expenses");
    },
  });

  if (isLoading || !expenseData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading expense...</p>
      </div>
    );
  }

  const formDefaults: ExpenseFormValues = {
    expense: expenseData.expense || "",
    date: expenseData.date
      ? new Date(expenseData.date).toISOString().split("T")[0]
      : "",
    amount: expenseData.amount ?? 0,
  };

  return (
    <PageWrapper title="Edit Expense" showBackButton>
      <ExpenseForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(values: ExpenseFormValues) => updateExpense.mutate(values)}
        isPending={updateExpense.isPending}
      />
    </PageWrapper>
  );
}
