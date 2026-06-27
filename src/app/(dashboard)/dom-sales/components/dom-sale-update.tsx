"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { DomSaleResponse } from "@/module/dom-sale/dom-sale.serializer";
import { DomSaleFormValues } from "@/module/dom-sale/dom-sale.form.schema";
import { DomSaleForm } from "./dom-sale-form";

export default function DomSaleUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: domSale } = useSuspenseQuery({
    queryKey: queryKeys.domSales.detail(id),
    queryFn: () => api.getById<DomSaleResponse>("dom-sales", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/dom-sales/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.domSales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Domestic sale updated");
      router.push("/dom-sales");
    },
  });

  const formDefaults = {
    ...domSale,
    notes: domSale.notes ?? "",
  } as DomSaleFormValues;
  console.log({ formDefaults });

  return (
    <DomSaleForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
