"use client";

import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { DomSaleForm } from "../../components/dom-sale-form";
import type { DomSaleFormValues } from "../../components/dom-sale-form";
import { PageWrapper } from "@/components/page-wrapper";

interface DomSaleDetail {
  id: number;
  trNo: string | null;
  stockId: number | null;
  quantity: string | null;
  salePrice: string | null;
  collectionAmount: string | null;
}

export default function EditDomSalePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: domSale, isLoading } = useQuery({
    queryKey: queryKeys.domSales.detail(id),
    queryFn: () => api.getById<DomSaleDetail>("dom-sales", id),
    enabled: !!id,
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

  if (isLoading || !domSale) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading sale...</p>
      </div>
    );
  }

  const formDefaults: DomSaleFormValues = {
    stockId: domSale.stockId ? String(domSale.stockId) : "",
    quantity: parseInt(domSale.quantity || "0"),
    salePrice: domSale.salePrice || "",
    collectionAmount: domSale.collectionAmount
      ? parseFloat(domSale.collectionAmount)
      : 0,
  };

  return (
    <PageWrapper
      title="Edit Domestic Sale"
      showBackButton
      description={domSale.trNo ? `TR No: ${domSale.trNo}` : ""}
    >
      <DomSaleForm
        defaultValues={formDefaults}
        isEditMode
        onSubmit={(values: DomSaleFormValues) => updateMutation.mutate(values)}
        isPending={updateMutation.isPending}
      />
    </PageWrapper>
  );
}
