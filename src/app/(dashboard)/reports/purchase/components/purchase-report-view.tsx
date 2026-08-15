"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVendors } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { purchaseReportOptions } from "@/lib/query-options";
import type { PurchaseReportResponse } from "@/module/report/report.serializer";
import {
  ReportFilterCard,
  ReportSelectFilter,
} from "../../_components/report-filter-card";
import {
  ReportResults,
  ReportSummary,
  type ReportColumn,
} from "../../_components/report-results";
import {
  formatCurrency,
  REPORT_PAGE_LIMIT,
  useReportFilters,
} from "../../_components/use-report-filters";

type PurchaseRow = PurchaseReportResponse["data"][number];

const ALL = "all";

export function PurchaseReportView() {
  const filters = useReportFilters();
  const [vendorId, setVendorId] = useState(ALL);

  const { data: vendors } = useVendors();

  const { data: report, isLoading, isFetching } = useQuery({
    ...purchaseReportOptions({
      from: filters.fromDate,
      to: filters.toDate,
      vendorId: vendorId !== ALL ? vendorId : undefined,
      page: filters.page,
      limit: REPORT_PAGE_LIMIT,
    }),
    enabled: filters.searchTriggered,
  });

  const columns: ReportColumn<PurchaseRow>[] = [
    { header: "Invoice No", cell: (row) => row.invoiceNo ?? "—" },
    {
      header: "Date",
      cell: (row) => new Date(row.purchaseDate).toLocaleDateString("en-IN"),
    },
    { header: "Vendor", cell: (row) => row.vendor?.name ?? "—" },
    {
      header: "Products (Qty)",
      cell: (row) =>
        row.items
          .map((item) => `${item.product?.name ?? ""} (${item.quantity})`)
          .join(", "),
    },
    {
      header: "Type",
      cell: (row) =>
        [...new Set(row.items.map((item) => item.purchaseType))].join(", "),
    },
    {
      header: "Batches",
      cell: (row) =>
        row.items
          .map((item) => item.batchNo)
          .filter(Boolean)
          .join(", ") || "—",
    },
    {
      header: "Total Cost",
      align: "right",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.totalCost)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFilterCard filters={filters}>
        <ReportSelectFilter
          label="Vendor"
          value={vendorId}
          onChange={setVendorId}
          options={vendors}
        />
      </ReportFilterCard>

      {filters.searchTriggered && (
        <>
          <ReportSummary
            isLoading={isLoading}
            tiles={[
              { title: "Total Invoices", value: report?.summary.invoiceCount },
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
            rowKey={(row) => row.id}
            pagination={report?.pagination}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={filters.setPage}
            onExport={(format) =>
              api.exportPurchaseReport({
                from: filters.fromDate,
                to: filters.toDate,
                vendorId: vendorId !== ALL ? vendorId : undefined,
                format,
              })
            }
          />
        </>
      )}
    </div>
  );
}
