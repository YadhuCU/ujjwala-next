"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { productWiseReportOptions } from "@/lib/query-options";
import type { ProductWiseResponse } from "@/module/report/report.serializer";
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

type ProductRow = ProductWiseResponse["data"][number];

/** +3 / −2, so a correction reads as a direction, not just a number */
const signed = (value: number) =>
  value === 0 ? "—" : value > 0 ? `+${value}` : `−${Math.abs(value)}`;

export function ProductWiseReportView() {
  const filters = useReportFilters();

  const { data: report, isLoading, isFetching } = useQuery({
    ...productWiseReportOptions({
      from: filters.fromDate,
      to: filters.toDate,
    }),
    enabled: filters.searchTriggered,
  });

  // Opening + Purchase − Sales ± Adjustments = Closing, on every row
  const columns: ReportColumn<ProductRow>[] = [
    { header: "Product", cell: (row) => row.productName },
    { header: "Opening Stock", align: "right", cell: (row) => row.openingStock },
    { header: "Purchase Qty", align: "right", cell: (row) => row.purchaseQty },
    { header: "Sales Qty", align: "right", cell: (row) => row.salesQty },
    {
      header: "Adjustments",
      align: "right",
      cell: (row) => signed(row.adjustments),
    },
    {
      header: "Closing Stock",
      align: "right",
      cell: (row) => <span className="font-semibold">{row.closingStock}</span>,
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
      {/* Stock is the agency's, so this report takes no staff filter */}
      <ReportFilterCard filters={filters} />

      {filters.searchTriggered && (
        <>
          <ReportSummary
            isLoading={isLoading}
            tiles={[
              { title: "Purchased", value: report?.summary.purchaseQty },
              { title: "Sold", value: report?.summary.salesQty },
              { title: "Adjustments", value: report?.summary.adjustments },
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
            countNoun="products"
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={filters.setPage}
            onExport={(format) =>
              api.exportProductWiseReport({
                from: filters.fromDate,
                to: filters.toDate,
                format,
              })
            }
          />

          <p className="text-muted-foreground text-xs">
            Cylinder stock is filled cylinders in the godown. Opening + Purchase
            − Sales ± Adjustments = Closing on every row. Adjustments are manual
            corrections: a stock adjustment, or a batch added by hand.
          </p>
        </>
      )}
    </div>
  );
}
