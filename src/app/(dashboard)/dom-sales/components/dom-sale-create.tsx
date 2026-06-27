"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { DomSaleForm } from "../components/dom-sale-form";

export function DomSaleCreateComponent() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/dom-sales",
    invalidateKeys: [queryKeys.domSales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Domestic sale added");
      router.push("/dom-sales");
    },
  });

  return (
    <DomSaleForm
      onSubmit={(values) => createMutation.mutate(values)}
      isPending={createMutation.isPending}
    />
  );
}
