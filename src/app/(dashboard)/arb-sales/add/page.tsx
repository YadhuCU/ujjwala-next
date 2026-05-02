"use client";

import { useRouter } from "next/navigation";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { PageWrapper } from "@/components/page-wrapper";
import { ArbSaleForm, ArbSaleFormValues } from "../components/arb-sale-form";
import { toast } from "sonner";

export default function AddArbSalePage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/arb-sales",
    method: "POST",
    invalidateKeys: [queryKeys.arbSales.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("ARB Sale created successfully");
      router.push("/arb-sales");
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "Failed to create ARB sale";
      toast.error(msg);
    }
  });

  const handleSubmit = (values: ArbSaleFormValues) => {
    createMutation.mutate(values);
  };

  return (
    <PageWrapper
      title="Create ARB Sale"
      description="Add a new ARB sale with multiple product line items."
      showBackButton
    >
      <div className="max-h-[75vh] overflow-y-auto pr-4 scrollbar-thin">
        <ArbSaleForm
          onSubmit={handleSubmit}
          isPending={createMutation.isPending}
        />
      </div>
    </PageWrapper>
  );
}
