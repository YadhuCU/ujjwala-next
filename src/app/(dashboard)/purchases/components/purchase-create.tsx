"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/use-api";
import { queryKeys } from "@/lib/query-keys";
import { PurchaseForm } from "../components/purchase-form";
import { PurchaseFormValues } from "@/module/purchase/purchase.form.schema";

export default function CreatePurchaseComponent() {
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
    <PurchaseForm
      onSubmit={(v: PurchaseFormValues) => createMutation.mutate(v)}
      isPending={createMutation.isPending}
    />
  );
}
