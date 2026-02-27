import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface ArbSaleReportParams {
  from: string;
  to: string;
  customerId?: string;
  staffId?: string;
  page?: number;
  limit?: number;
}

export interface ArbSaleReportSummary {
  invoiceCount: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalNetTotal: number;
}

export interface ArbSaleReportItem {
  id: number;
  trNo: string | null;
  totalAmount: string | null;
  discount: string | null;
  createdAt: string;
  customer: { id: number; name: string | null } | null;
  createdBy: { id: number; name: string | null } | null;
  items: {
    id: number;
    quantity: number;
    salePrice: string | null;
    netTotal: string | null;
    product: { name: string | null } | null;
    stock: { batchNo: string | null } | null;
  }[];
}

export interface ArbSaleReportResponse {
  summary: ArbSaleReportSummary;
  data: ArbSaleReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useArbSaleReport(params: ArbSaleReportParams, enabled: boolean) {
  return useQuery<ArbSaleReportResponse>({
    queryKey: queryKeys.arbSaleReport.list(params),
    queryFn: () => api.getArbSaleReport(params),
    enabled,
  });
}
