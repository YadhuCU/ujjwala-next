"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { saleByProductReportOptions } from "@/lib/query-options";
import type { SaleByProductResponse } from "@/module/report/report.serializer";
import { ReportFilterCard } from "../../_components/report-filter-card";
import {
  ReportResults,
  ReportSummary,
  type ReportColumn,
} from "../../_components/report-results";
import {
  formatCurrency,
  useReportFilters,
} from "../../_components/use-report-filters";

type ProductRow = SaleByProductResponse["data"][number];

export function SaleByProductReportView() {
  const filters = useReportFilters();

  const { data: report, isLoading, isFetching } = useQuery({
    ...saleByProductReportOptions({
      from: filters.fromDate,
      to: filters.toDate,
    }),
    enabled: filters.searchTriggered,
  });

  const totalAmount = report?.summary.totalAmount ?? 0;

  const columns: ReportColumn<ProductRow>[] = [
    { header: "Product", cell: (row) => row.productName },
    {
      header: "Quantity Sold",
      align: "right",
      cell: (row) => row.totalQuantity,
    },
    {
      header: "Share",
      align: "right",
      cell: (row) =>
        totalAmount > 0
          ? `${((row.totalAmount / totalAmount) * 100).toFixed(1)}%`
          : "—",
    },
    {
      header: "Total Amount",
      align: "right",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.totalAmount)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* This report rolls every product up, so it takes no extra filters */}
      <ReportFilterCard filters={filters} />

      {filters.searchTriggered && (
        <>
          <ReportSummary
            isLoading={isLoading}
            tiles={[
              {
                title: "Total Quantity",
                value: report?.summary.totalQuantity,
              },
              {
                title: "Rented Cylinders",
                value: report?.summary.rentedQuantity,
              },
              {
                title: "Total Amount",
                value: report?.summary.totalAmount,
                format: formatCurrency,
                highlight: true,
              },
            ]}
          />

          <ReportResults
            columns={columns}
            rows={report?.data ?? []}
            rowKey={(row) => row.productId}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={filters.setPage}
            onExport={(format) =>
              api.exportSaleByProductReport({
                from: filters.fromDate,
                to: filters.toDate,
                format,
              })
            }
          />
        </>
      )}
    </div>
  );
}
