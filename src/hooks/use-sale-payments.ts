import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

export function useDomSalePayment(customerId?: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount, notes }: { id: string; amount: number; notes?: string }) =>
      api.recordDomSalePayment(id, { amount, notes }),
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      qc.invalidateQueries({ queryKey: queryKeys.domSales.all });
      if (customerId) {
        qc.invalidateQueries({ queryKey: queryKeys.customerTxn.detail(customerId) });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to record payment");
    },
  });
}

export function useArbSalePayment(customerId?: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount, notes }: { id: string; amount: number; notes?: string }) =>
      api.recordArbSalePayment(id, { amount, notes }),
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      qc.invalidateQueries({ queryKey: queryKeys.arbSales.all });
      if (customerId) {
        qc.invalidateQueries({ queryKey: queryKeys.customerTxn.detail(customerId) });
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || "Failed to record payment");
    },
  });
}
