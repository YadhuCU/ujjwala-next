"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { StockForm } from "../components/stock-form";
import type { StockFormValues } from "../components/stock-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddStockPage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/stock",
    invalidateKeys: [queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Stock added");
      router.push("/stock");
    },
  });

  return (
    <PageWrapper title="Add Stock" showBackButton>
      <StockForm
        onSubmit={(v: StockFormValues) => createMutation.mutate(v)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
