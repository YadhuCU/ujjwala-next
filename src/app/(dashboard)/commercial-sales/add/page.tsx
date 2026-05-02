"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { CommercialSaleForm, type CommercialSaleFormValues } from "../components/commercial-sale-form";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

/**
 * Add Commercial Sale page — wraps the CommercialSaleForm with a create mutation.
 */
export default function AddCommercialSalePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: CommercialSaleFormValues) =>
      axios.post("/api/commercial-sales", values).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.commercialSales.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerTxn.all });
      toast.success("Commercial sale created");
      router.push("/commercial-sales");
    },
    onError: (error: unknown) => {
      const message =
        axios.isAxiosError(error) && error.response?.data?.error
          ? error.response.data.error
          : "Failed to create commercial sale";
      toast.error(message);
    },
  });

  return (
    <div className="container mx-auto py-6">
      <CommercialSaleForm
        onSubmit={(values) => createMutation.mutate(values)}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
