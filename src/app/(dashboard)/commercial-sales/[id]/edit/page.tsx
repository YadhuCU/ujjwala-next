"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { useApiMutation } from "@/hooks/use-api";
import { PageWrapper } from "@/components/page-wrapper";
import { CommercialSaleForm, CommercialSaleFormValues } from "../../components/commercial-sale-form";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { CommercialSalePayload } from "@/lib/api-client";

/**
 * Edit page for a commercial sale.
 * Only header-level fields (notes, paymentType, customerId, discount, totalAmount)
 * are editable. Items are locked to preserve ledger integrity.
 */
export default function EditCommercialSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = use(params);

  const { data: sale, isLoading } = useQuery<CommercialSalePayload>({
    queryKey: queryKeys.commercialSales.detail(resolvedParams.id),
    queryFn: () => api.getById("commercial-sales", resolvedParams.id),
  });

  const updateMutation = useApiMutation({
    url: `/api/commercial-sales/${resolvedParams.id}`,
    method: "PUT",
    invalidateKeys: [
      queryKeys.commercialSales.all,
      queryKeys.commercialSales.detail(resolvedParams.id),
    ],
    onSuccess: () => {
      toast.success("Commercial sale updated.");
      router.push("/commercial-sales");
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to update commercial sale";
      toast.error(msg);
    },
  });

  const handleSubmit = (values: CommercialSaleFormValues) => {
    // Items are read-only in edit mode; only send header fields
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
      <PageWrapper title="Loading Commercial Sale..." showBackButton>
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

  const saleType = (sale.items?.[0]?.saleType as "rent" | "sale") ?? "rent";

  const formDefaults: CommercialSaleFormValues = {
    saleType,
    customerId: sale.customerId ? String(sale.customerId) : null,
    paymentType: (sale.paymentType as "cash" | "cheque") ?? "cash",
    discount: Number(sale.discount ?? 0),
    notes: sale.notes ?? "",
    paidAmount: Number(sale.paidAmount ?? 0),
    totalAmount: Number(sale.totalAmount ?? 0),
    items: (sale.items ?? []).map((item) => ({
      stockId: String(item.stockId ?? ""),
      quantity: item.quantity ?? 0,
      salePrice: Number(item.salePrice ?? 0),
      netTotal: Number(item.netTotal ?? 0),
      cylindersDispatched: item.cylindersDispatched ?? 0,
      cylindersReturned: item.cylindersReturned ?? 0,
    })),
  };

  return (
    <PageWrapper
      title={`Commercial Sale ${sale.trNo ?? ""}`}
      description="Items are locked. You can update notes, customer, payment type, discount, and total amount."
      showBackButton
    >
      <div className="max-h-[75vh] overflow-y-auto pr-4 scrollbar-thin">
        <CommercialSaleForm
          defaultValues={formDefaults}
          isEditMode={true}
          onSubmit={handleSubmit}
          isPending={updateMutation.isPending}
        />
      </div>
    </PageWrapper>
  );
}
