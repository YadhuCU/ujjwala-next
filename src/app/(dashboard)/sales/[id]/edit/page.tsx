"use client";

import { useRouter, useParams } from "next/navigation";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { SaleForm } from "../../components/sale-form";
import type { SaleFormValues, Stock } from "../../components/sale-form";
import { PageWrapper } from "@/components/page-wrapper";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SaleDetail {
  id: number;
  trNo: string | null;
  stockId: number | null;
  customerId: number | null;
  productId: number | null;
  quantity: string | null;
  discount: number | null;
  salePrice: string | null;
  productCost: string | null;
  netTotal: string | null;
  saleType: "sale" | "rent";
  emptyReturn: number;
  collectionAmount: number;
  collectionId: number | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SaleEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: sale, isLoading } = useQuery({
    queryKey: queryKeys.sales.detail(id),
    queryFn: () => api.getById<SaleDetail>("sales", id),
    enabled: !!id,
  });

  // Derive form defaults from fetched sale data (no setState in effect)
  const formDefaults = useMemo<SaleFormValues | undefined>(() => {
    if (!sale) return undefined;
    return {
      stockId: sale.stockId ? String(sale.stockId) : "",
      customerId: sale.customerId ? String(sale.customerId) : "",
      quantity: parseInt(sale.quantity || "0"),
      discount: sale.discount ?? 0,
      saleType: sale.saleType,
      collection: sale.collectionAmount ?? 0,
      emptyReturn: sale.emptyReturn ?? 0,
    };
  }, [sale]);

  const updateSale = useApiMutation({
    url: `/api/sales/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.sales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Sale updated successfully");
      router.push("/sales");
      router.refresh();
    },
  });

  function handleSubmit(
    values: SaleFormValues,
    selectedStock: Stock | undefined,
  ) {
    updateSale.mutate({
      ...values,
      salePrice: selectedStock?.salePrice,
      productCost: selectedStock?.productCost,
      collectionId: sale?.collectionId,
    });
  }

  if (isLoading || !formDefaults) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading sale...</p>
      </div>
    );
  }

  const originalStockAllocation = sale?.stockId
    ? { stockId: sale.stockId, quantity: parseInt(sale.quantity || "0") }
    : null;

  return (
    <PageWrapper
      title="Edit Commercial Sale"
      showBackButton
      description={sale?.trNo ? `TR No: ${sale.trNo}` : ""}
    >
      <SaleForm
        defaultValues={formDefaults}
        isEditMode
        originalStockAllocation={originalStockAllocation}
        onSubmit={handleSubmit}
        isPending={updateSale.isPending}
      />
    </PageWrapper>
  );
}
