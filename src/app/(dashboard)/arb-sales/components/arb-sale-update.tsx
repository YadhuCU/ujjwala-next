"use client";

import { useRouter, useParams } from "next/navigation";
import { useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { DomSaleResponse } from "@/module/dom-sale/dom-sale.serializer";
import { ARBSaleForm } from "./arb-sale-form";
import { ArbSaleFormValues } from "@/module/arb-sale/arb-sale.form.schema";

export default function ARBSaleUpdateComponent() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data } = useSuspenseQuery({
    queryKey: queryKeys.domSales.detail(id),
    queryFn: () => api.getById<DomSaleResponse>("arb-sales", id),
    select: (res) => res.data,
  });

  const updateMutation = useApiMutation({
    url: `/api/arb-sales/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.arbSales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("ARB sale updated");
      router.push("/arb-sales");
    },
  });

  const formDefaults = {
    ...data,
    notes: data.notes ?? "",
  } as ArbSaleFormValues;

  return (
    <ARBSaleForm
      defaultValues={formDefaults}
      isEditMode
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
