import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface ExpenseReportParams {
  from: string;
  to: string;
  staffId?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseReportSummary {
  expenseCount: number;
  totalAmount: number;
}

export interface ExpenseReportItem {
  id: number;
  expense: string | null;
  date: string | null;
  amount: string | null;
  createdAt: string;
  createdBy: { id: number; name: string | null } | null;
}

export interface ExpenseReportResponse {
  summary: ExpenseReportSummary;
  data: ExpenseReportItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useExpenseReport(params: ExpenseReportParams, enabled: boolean) {
  return useQuery<ExpenseReportResponse>({
    queryKey: queryKeys.expenseReport.list(params),
    queryFn: () => api.getExpenseReport(params),
    enabled,
  });
}
