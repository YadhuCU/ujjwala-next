"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { DomSaleForm } from "../components/dom-sale-form";
import type { DomSaleFormValues } from "../components/dom-sale-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddDomSalePage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/dom-sales",
    invalidateKeys: [queryKeys.domSales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Domestic sale added");
      router.push("/dom-sales");
    },
  });

  return (
    <PageWrapper title="Add Domestic Sale" showBackButton>
      <DomSaleForm
        onSubmit={(values: DomSaleFormValues) => createMutation.mutate(values)}
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
