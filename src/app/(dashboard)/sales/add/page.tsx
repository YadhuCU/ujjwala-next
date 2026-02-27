"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { SaleForm } from "../components/sale-form";
import type { SaleFormValues, Stock } from "../components/sale-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function SaleAddPage() {
  const router = useRouter();

  const createSale = useApiMutation({
    url: "/api/sales",
    method: "POST",
    invalidateKeys: [queryKeys.sales.all, queryKeys.stocks.all, queryKeys.customerTxn.all],
    onSuccess: () => {
      toast.success("Sale created successfully");
      router.push("/sales");
      router.refresh();
    },
  });

  function handleSubmit(
    values: SaleFormValues,
    selectedStock: Stock | undefined,
  ) {
    createSale.mutate({
      ...values,
      salePrice: selectedStock?.product?.salePrice,
      productCost: selectedStock?.productCost,
    });
  }

  return (
    <PageWrapper title="New Commercial Sale" showBackButton>
      <SaleForm onSubmit={handleSubmit} isPending={createSale.isPending} />
    </PageWrapper>
  );
}
