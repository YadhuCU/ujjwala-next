"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { ARBSaleForm } from "./arb-sale-form";

export function ARBSaleCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/arb-sales",
    invalidateKeys: [queryKeys.domSales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("ARB sale added");
      router.push("/arb-sales");
    },
  });

  return (
    <ARBSaleForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
