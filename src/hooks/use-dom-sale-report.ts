import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface DomSaleReportParams {
  from: string;
  to: string;
  customerId?: string;
  staffId?: string;
  page?: number;
  limit?: number;
}

export interface DomSaleReportSummary {
  invoiceCount: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalNetTotal: number;
}

export interface DomSaleReportItem {
  id: number;
  trNo: string | null;
  totalAmount: string | null;
  discount: string | null;
  paymentType: string;
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

export interface DomSaleReportResponse {
  summary: DomSaleReportSummary;
  data: DomSaleReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useDomSaleReport(params: DomSaleReportParams, enabled: boolean) {
  return useQuery<DomSaleReportResponse>({
    queryKey: queryKeys.domSaleReport.list(params),
    queryFn: () => api.getDomSaleReport(params),
    enabled,
  });
}
