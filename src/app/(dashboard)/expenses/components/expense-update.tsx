"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { ExpenseResponse } from "@/module/expense/expense.serializer";
import { ExpenseFormValues } from "@/module/expense/expense.form.schema";
import { ExpenseForm } from "./expense-form";

export function ExpenseUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data } = useSuspenseQuery({
    queryKey: queryKeys.expenses.detail(id),
    queryFn: () => api.getById<ExpenseResponse>("expenses", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/expenses/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.expenses.all],
    onSuccess: () => {
      toast.success("Expense updated");
      router.push("/expenses");
    },
  });

  const formDefaults = {
    expense: data.expense ?? "",
    date: data.date ? new Date(data.date) : new Date(),
    amount: data.amount,
  } satisfies ExpenseFormValues;

  return (
    <ExpenseForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
