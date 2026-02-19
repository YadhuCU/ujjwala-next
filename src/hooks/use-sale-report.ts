import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface SaleReportParams {
  from: string;
  to: string;
  customerId?: string;
  staffId?: string;
  page?: number;
  limit?: number;
}

export interface SaleReportSummary {
  invoiceCount: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalNetTotal: number;
}

export interface SaleReportItem {
  id: number;
  trNo: string | null;
  quantity: string | null;
  salePrice: string | null;
  netTotal: string | null;
  discount: number | null;
  createdAt: string;
  customer: { id: number; name: string | null } | null;
  product: { name: string | null } | null;
  stock: { batchNo: string | null } | null;
  createdBy: { id: number; name: string | null } | null;
}

export interface SaleReportResponse {
  summary: SaleReportSummary;
  data: SaleReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useSaleReport(params: SaleReportParams, enabled: boolean) {
  return useQuery<SaleReportResponse>({
    queryKey: queryKeys.saleReport.list(params),
    queryFn: () => api.getSaleReport(params),
    enabled,
  });
}
