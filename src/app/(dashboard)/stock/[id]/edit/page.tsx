"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { StockForm } from "../../components/stock-form";
import type { StockFormValues } from "../../components/stock-form";
import { PageWrapper } from "@/components/page-wrapper";

interface StockDetail {
  id: number;
  batchNo: string | null;
  productId: number | null;
  invoiceNo: string | null;
  quantity: string | null;
  productCost: string | null;
  salePrice: string | null;
}

export default function EditStockPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: stock, isLoading } = useQuery({
    queryKey: queryKeys.stocks.detail(id),
    queryFn: () => api.getById<StockDetail>("stock", id),
    enabled: !!id,
  });

  const updateMutation = useApiMutation({
    url: `/api/stock/${id}`,
    method: "PUT",
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Stock updated");
      router.push("/stock");
    },
  });

  if (isLoading || !stock) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading stock...</p></div>;
  }

  const formDefaults: StockFormValues = {
    batchNo: stock.batchNo || "",
    productId: stock.productId ? String(stock.productId) : "",
    invoiceNo: stock.invoiceNo || "",
    quantity: stock.quantity || "",
    productCost: stock.productCost || "",
    salePrice: stock.salePrice || "",
  };

  return (
    <PageWrapper title="Edit Stock" showBackButton>
      <StockForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(v: StockFormValues) => updateMutation.mutate(v)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
