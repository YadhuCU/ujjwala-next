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

interface DomSaleItem {
  id: number;
  stockId: number | null;
  productId: number | null;
  quantity: number;
  salePrice: number | null;
  netTotal: number | null;
  stock?: {
    id: number;
    batchNo: string | null;
  };
  product?: {
    id: number;
    name: string | null;
  };
}

interface DomSaleDetail {
  id: number;
  trNo: string | null;
  totalAmount: number | null;
  customerId: number | null;
  paymentType: "cash" | "cheque";
  discount: number | null;
  notes: string | null;
  items: DomSaleItem[];
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
    customerId: domSale.customerId ? String(domSale.customerId) : null,
    paymentType: domSale.paymentType || "cash",
    discount: domSale.discount ? Number(domSale.discount) : 0,
    notes: domSale.notes || "",
    totalAmount: domSale.totalAmount ? Number(domSale.totalAmount) : 0,
    items: domSale.items.map((item) => ({
      stockId: item.stockId ? String(item.stockId) : "",
      productId: item.productId ?? undefined,
      quantity: item.quantity ?? 0,
      salePrice: item.salePrice ? Number(item.salePrice) : 0,
      netTotal: item.netTotal ? Number(item.netTotal) : 0,
    })),
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
