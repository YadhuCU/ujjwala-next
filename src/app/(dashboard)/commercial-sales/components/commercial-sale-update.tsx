"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { CommercialSaleResponse } from "@/module/commercial-sale/commercial-sale.serializer";
import { CommercialSaleForm } from "./commercial-sale-form";
import { CommercialSaleFormValues } from "@/module/commercial-sale/commercial-sale.form.schema";

export function CommercialSaleUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data } = useSuspenseQuery({
    queryKey: queryKeys.commercialSales.detail(id),
    queryFn: () => api.getById<CommercialSaleResponse>("commercial-sales", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/commercial-sales/${id}`,
    method: "PUT",
    invalidateKeys: [
      queryKeys.commercialSales.all,
      queryKeys.stocks.all,
      queryKeys.customerTxn.all,
    ],
    onSuccess: () => {
      toast.success("Commercial sale updated");
      router.push("/commercial-sales");
    },
  });

  const formDefaults = {
    ...data,
    invoiceDate: new Date(data.invoiceDate),
    notes: data.notes ?? "",
  } as CommercialSaleFormValues;

  return (
    <CommercialSaleForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
