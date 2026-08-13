"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { StockForm } from "./stock-form";

export function StockCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/stock",
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Stock batch added");
      router.push("/stock");
    },
  });

  return (
    <StockForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
