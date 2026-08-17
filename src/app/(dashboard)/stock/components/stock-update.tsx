"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { StockResponse } from "@/module/stock/stock.serializer";
import { StockFormValues } from "@/module/stock/stock.form.schema";
import { StockForm } from "./stock-form";

export function StockUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data } = useSuspenseQuery({
    queryKey: queryKeys.stocks.detail(id),
    queryFn: () => api.getById<StockResponse>("stock", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/stock/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Stock batch updated");
      router.push("/stock");
    },
  });

  const formDefaults = {
    batchNo: data.batchNo,
    productId: data.productId,
    invoiceNo: data.invoiceNo ?? "",
    quantity: data.quantity,
    productCost: data.productCost,
    // The reason describes this correction, so it always starts empty
    reason: "",
  } as StockFormValues;

  return (
    <StockForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
