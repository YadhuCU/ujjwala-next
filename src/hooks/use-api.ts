import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { toast } from "sonner";
import { api, apiClient } from "@/lib/api-client";
import {
  stocksOptions,
  customersOptions,
  locationsOptions,
  productsOptions,
  usersOptions,
  vendorsOptions,
  purchasesOptions,
  arbSalesOptions,
} from "@/lib/query-options";
import { ProductType } from "@prisma/client";

// ─── Custom Query Hooks (reused in ≥2 components) ───────────────────────────

export function useStocks(type?: ProductType) {
  return useQuery(stocksOptions(type));
}

export function useCustomers() {
  return useQuery(customersOptions);
}

export function useLocations() {
  return useQuery(locationsOptions);
}

export function useProducts(type?: ProductType) {
  return useQuery(productsOptions(type));
}

export function useUsers() {
  return useQuery(usersOptions);
}

export function useVendors() {
  return useQuery(vendorsOptions);
}

export function usePurchases() {
  return useQuery(purchasesOptions);
}

export function useArbSales() {
  return useQuery(arbSalesOptions);
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

function getAxiosError(error: unknown): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.error || error.message || "Operation failed";
  }
  if (error instanceof Error) return error.message;
  return "Operation failed";
}

export function useApiMutation<T = Record<string, unknown>>({
  url,
  method = "POST",
  invalidateKeys = [],
  onSuccess,
  onError,
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
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      if (onError) onError(error);
      else toast.error(getAxiosError(error));
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
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: [...key] });
      });
      toast.success("Deleted successfully");
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast.error(getAxiosError(error));
    },
  });
}
