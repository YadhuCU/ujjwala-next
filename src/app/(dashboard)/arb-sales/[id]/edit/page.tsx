"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiMutation } from "@/hooks/use-api";
import { PageWrapper } from "@/components/page-wrapper";
import { ArbSaleForm, ArbSaleFormValues } from "../../components/arb-sale-form";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArbSalePayload } from "@/lib/api-client";

export default function EditArbSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);

  const { data: sale, isLoading } = useQuery<ArbSalePayload>({
    queryKey: queryKeys.arbSales.detail(resolvedParams.id),
    queryFn: () => api.getById("arb-sales", resolvedParams.id),
  });

  const updateMutation = useApiMutation({
    url: `/api/arb-sales/${resolvedParams.id}`,
    method: "PUT",
    invalidateKeys: [
      queryKeys.arbSales.all,
      queryKeys.arbSales.detail(resolvedParams.id),
      queryKeys.stocks.all,
    ],
    onSuccess: () => {
      toast.success("ARB Sale notes updated successfully");
      router.push("/arb-sales");
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to update ARB sale notes";
      toast.error(msg);
    },
  });

  const handleSubmit = (values: ArbSaleFormValues) => {
    // Only notes and advanced header fields are allowed to be updated. Items are strict.
    updateMutation.mutate({
      notes: values.notes,
      customerId: values.customerId,
      paymentType: values.paymentType,
      discount: values.discount,
      totalAmount: values.totalAmount,
    });
  };

  if (isLoading) {
    return (
      <PageWrapper title="Loading ARB Sale..." showBackButton>
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageWrapper>
    );
  }

  if (!sale) {
    return (
      <PageWrapper title="Error" showBackButton>
        <div className="p-4 text-destructive bg-destructive/10 rounded-md">
          Sale details could not be loaded.
        </div>
      </PageWrapper>
    );
  }

  const formDefaults: ArbSaleFormValues = {
    customerId: sale.customerId ? String(sale.customerId) : null,
    paymentType: (sale.paymentType as "cash" | "cheque") || "cash",
    discount: Number(sale.discount || 0),
    notes: sale.notes || "",
    totalAmount: Number(sale.totalAmount || 0),
    items: sale.items.map((i) => ({
      stockId: String(i.stockId),
      productId: Number(i.productId),
      quantity: i.quantity,
      salePrice: Number(i.salePrice || 0),
      netTotal: Number(i.netTotal || 0),
    })),
  };

  return (
    <PageWrapper
      title={`ARB Sale ${sale.trNo || ""}`}
      description="View sale details. Notes, Payment Type, Customer, Discount, and Total Amount can be updated."
      showBackButton
    >
      <div className="max-h-[75vh] overflow-y-auto pr-4 scrollbar-thin">
        <ArbSaleForm
          defaultValues={formDefaults}
          isEditMode={true}
          onSubmit={handleSubmit}
          isPending={updateMutation.isPending}
        />
      </div>
    </PageWrapper>
  );
}
