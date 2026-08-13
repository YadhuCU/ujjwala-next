"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { ExpenseForm } from "./expense-form";

export function ExpenseCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/expenses",
    invalidateKeys: [queryKeys.expenses.all],
    onSuccess: () => {
      toast.success("Expense added");
      router.push("/expenses");
    },
  });

  return (
    <ExpenseForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
