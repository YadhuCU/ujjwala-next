import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface CommercialSaleReportParams {
  from: string;
  to: string;
  customerId?: string;
  staffId?: string;
  page?: number;
  limit?: number;
}

export interface CommercialSaleReportSummary {
  invoiceCount: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalNetTotal: number;
}

export interface CommercialSaleReportItem {
  id: number;
  trNo: string | null;
  totalAmount: string | null;
  paidAmount: string | null;
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
    saleType: string;
    cylindersDispatched: number;
    cylindersReturned: number;
    product: { name: string | null } | null;
    stock: { batchNo: string | null } | null;
  }[];
}

export interface CommercialSaleReportResponse {
  summary: CommercialSaleReportSummary;
  data: CommercialSaleReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useCommercialSaleReport(params: CommercialSaleReportParams, enabled: boolean) {
  return useQuery<CommercialSaleReportResponse>({
    queryKey: queryKeys.commercialSaleReport.list(params),
    queryFn: () => api.getCommercialSaleReport(params),
    enabled,
  });
}
