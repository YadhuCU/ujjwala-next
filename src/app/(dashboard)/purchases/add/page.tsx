"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { PurchaseForm } from "../components/purchase-form";
import type { PurchaseFormValues } from "../components/purchase-form";
import { PageWrapper } from "@/components/page-wrapper";

export default function AddPurchasePage() {
  const router = useRouter();

  const createMutation = useApiMutation({
    url: "/api/purchases",
    invalidateKeys: [queryKeys.purchases.all, queryKeys.stocks.all],
    onSuccess: () => {
      toast.success("Purchase created & stock updated");
      router.push("/purchases");
    },
  });

  return (
    <PageWrapper title="Add Purchase" showBackButton>
      <PurchaseForm
        onSubmit={(v: PurchaseFormValues & { totalAmount: number }) =>
          createMutation.mutate(v)
        }
        isPending={createMutation.isPending}
      />
    </PageWrapper>
  );
}
