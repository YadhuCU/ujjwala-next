import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface SaleByProductReportParams {
  from: string;
  to: string;
  page?: number;
  limit?: number;
}

export interface SaleByProductReportSummary {
  totalQuantity: number;
  totalAmount: number;
}

export interface SaleByProductReportItem {
  productId: number;
  productName: string | null;
  totalQuantity: number;
  totalAmount: number;
}

export interface SaleByProductReportResponse {
  summary: SaleByProductReportSummary;
  data: SaleByProductReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useSaleByProductReport(params: SaleByProductReportParams, enabled: boolean) {
  return useQuery<SaleByProductReportResponse>({
    queryKey: queryKeys.saleByProductReport.list(params),
    queryFn: () => api.getSaleByProductReport(params),
    enabled,
  });
}
