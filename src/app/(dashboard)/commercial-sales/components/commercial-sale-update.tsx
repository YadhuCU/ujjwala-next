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

  // Invoices from before the discount was per cylinder carry only the flat
  // amount. Spread it over their cylinders so saving one keeps its total (to
  // the paisa, if it did not divide evenly).
  const cylinders = data.items.reduce((sum, item) => sum + item.quantity, 0);
  const unitDiscount =
    data.unitDiscount ??
    (data.discount && cylinders > 0
      ? Math.round((data.discount / cylinders) * 100) / 100
      : undefined);

  const formDefaults = {
    ...data,
    invoiceDate: new Date(data.invoiceDate),
    notes: data.notes ?? "",
    // No discount comes back as undefined, which would leave the input uncontrolled
    unitDiscount: unitDiscount ?? "",
    // What this invoice already collected. The form merges these with what the
    // customer currently holds, so a product returned in full still shows.
    returns: data.returns.map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
    })),
  } as CommercialSaleFormValues;

  return (
    <CommercialSaleForm
      defaultValues={formDefaults}
      isEditMode
      // What this invoice already added to the customer's balance, so the form
      // can show the due from before it
      original={{
        customerId: data.customerId ?? undefined,
        netCharge: data.totalAmount - data.paidAmount,
      }}
      onSubmit={(values) => updateMutation.mutate(values)}
      isPending={updateMutation.isPending}
    />
  );
}
