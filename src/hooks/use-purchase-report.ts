import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface PurchaseReportParams {
  from: string;
  to: string;
  vendorId?: string;
  page?: number;
  limit?: number;
}

export interface PurchaseReportSummary {
  invoiceCount: number;
  totalAmount: number;
}

export interface PurchaseReportItem {
  id: number;
  invoiceNo: string | null;
  totalAmount: string | null;
  purchaseDate: string;
  createdAt: string;
  vendor: { id: number; name: string | null } | null;
  items: {
    id: number;
    batchNo: string;
    quantity: number;
    unitCost: string | null;
    totalCost: string | null;
    product: { name: string | null } | null;
  }[];
}

export interface PurchaseReportResponse {
  summary: PurchaseReportSummary;
  data: PurchaseReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function usePurchaseReport(params: PurchaseReportParams, enabled: boolean) {
  return useQuery<PurchaseReportResponse>({
    queryKey: queryKeys.purchaseReport.list(params),
    queryFn: () => api.getPurchaseReport(params),
    enabled,
  });
}
