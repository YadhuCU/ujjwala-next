"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { StockAdjustmentForm } from "./stock-adjustment-form";

export function StockAdjustmentCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/stock-adjustments",
    invalidateKeys: [queryKeys.stockAdjustments.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Stock adjustment recorded");
      router.push("/stock-adjustments");
    },
  });

  return (
    <StockAdjustmentForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
