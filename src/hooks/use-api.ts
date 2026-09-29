import {
  useQuery,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  stocksOptions,
  customersOptions,
  locationsOptions,
  usersOptions,
  vendorsOptions,
  purchasesOptions,
  arbSalesOptions,
  commercialSalesOptions,
} from "@/lib/query-options";
import { ProductType } from "@/generated/enums";

// ─── Custom Query Hooks (reused in ≥2 components) ───────────────────────────

export function useStocks(type?: ProductType, includeEmpty = false) {
  return useSuspenseQuery(stocksOptions(type, includeEmpty));
}

export function useCustomers() {
  return useSuspenseQuery(customersOptions);
}

export function useLocations() {
  return useSuspenseQuery(locationsOptions);
}

export function useUsers() {
  return useQuery(usersOptions);
}

export function useVendors() {
  return useSuspenseQuery(vendorsOptions);
}

export function usePurchases() {
  return useSuspenseQuery(purchasesOptions);
}

export function useArbSales() {
  return useQuery(arbSalesOptions);
}

export function useCommercialSales() {
  return useQuery(commercialSalesOptions);
}

// ─── Generic Mutation Hook ──────────────────────────────────────────────────

interface MutationOptions {
  /** Full URL or path prefix, e.g. "/api/sales" */
  url: string;
  method?: "POST" | "PUT" | "DELETE" | "PATCH";
  /** Query keys to invalidate on success */
  invalidateKeys?: readonly (readonly string[])[];
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * The dashboard and the godown are aggregates over almost everything — a sale,
 * a purchase, an expense, a payment, a return or a stock correction all move
 * them. Listing them on every mutation was easy to forget, and was forgotten
 * everywhere: after recording a sale the dashboard kept showing the old totals
 * until a hard reload. So every successful write refreshes them, whatever else
 * it lists. Invalidation is cheap — a query only refetches if it is on screen
 * or next time it is looked at.
 */
const ALWAYS_INVALIDATE = [queryKeys.dashboard.all, queryKeys.godown.all] as const;

function invalidateAfterWrite(
  queryClient: ReturnType<typeof useQueryClient>,
  keys: readonly (readonly string[])[],
) {
  for (const key of [...keys, ...ALWAYS_INVALIDATE]) {
    queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export function useApiMutation<T = Record<string, unknown>>({
  url,
  method = "POST",
  invalidateKeys = [],
  onSuccess,
}: MutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: T) => {
      const { data: responseData } = await apiClient({
        url,
        method,
        data,
      });
      return responseData;
    },
    onSuccess: () => {
      invalidateAfterWrite(queryClient, invalidateKeys);
      onSuccess?.();
    },
  });
}

/** Shorthand for DELETE mutations (no body) */
export function useDeleteMutation({
  invalidateKeys = [],
  onSuccess,
}: {
  invalidateKeys?: readonly (readonly string[])[];
  onSuccess?: () => void;
} = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (url: string) => {
      return api.remove(url);
    },
    onSuccess: () => {
      invalidateAfterWrite(queryClient, invalidateKeys);
      toast.success("Deleted successfully");
      onSuccess?.();
    },
  });
}
