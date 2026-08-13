"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { CommercialSaleForm } from "./commercial-sale-form";

export function CommercialSaleCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/commercial-sales",
    invalidateKeys: [
      queryKeys.commercialSales.all,
      queryKeys.stocks.all,
      queryKeys.customerTxn.all,
    ],
    onSuccess: () => {
      toast.success("Commercial sale added");
      router.push("/commercial-sales");
    },
  });

  return (
    <CommercialSaleForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
