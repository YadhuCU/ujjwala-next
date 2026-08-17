"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PurchaseResponse } from "@/module/purchase/purchase.serializer";
import { PurchaseForm } from "./purchase-form";
import { PurchaseFormValues } from "@/module/purchase/purchase.form.schema";

export function UpdatePurchaseComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: purchase } = useSuspenseQuery({
    queryKey: queryKeys.purchases.detail(id),
    queryFn: () => api.getById<PurchaseResponse>("purchases", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/purchases/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.purchases.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Purchase updated");
      router.push("/purchases");
    },
  });

  const formValues = {
    ...purchase,
    vendorId: purchase.vendorId,
    purchaseDate: new Date(purchase.purchaseDate),
    items: purchase.items.map((x) => ({
      ...x,
      unitCost: x.unitCost ?? 0,
      totalCost: x.totalCost ?? 0,
      productId: x.productId,
    })),
  } satisfies PurchaseFormValues;

  return (
    <PurchaseForm
      defaultValues={formValues}
      isEditMode
      onSubmit={(v) => updateMutation.mutate(v)}
      isPending={updateMutation.isPending}
    />
  );
}
