"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVendors } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { purchaseReportOptions } from "@/lib/query-options";
import type { PurchaseReportResponse } from "@/module/report/report.serializer";
import { Badge } from "@/components/ui/badge";
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

  // One row per invoice: its number, date, vendor and total are single cells
  // spanning its items, and each item is a line of its own beside them — so an
  // invoice's items read as one group, with nothing repeated.
  type Purchase = PurchaseReportResponse["data"][number];
  type Item = Purchase["items"][number];

  const money = (value: number | undefined) =>
    value === undefined ? "—" : formatCurrency(value);
  const none = () => null;

  const columns: ReportColumn<Purchase, Item>[] = [
    { header: "Invoice No", merge: true, cell: (p) => p.invoiceNo ?? "—" },
    {
      header: "Date",
      merge: true,
      cell: (p) => new Date(p.purchaseDate).toLocaleDateString("en-IN"),
    },
    { header: "Vendor", merge: true, cell: (p) => p.vendor?.name ?? "—" },
    { header: "Item", cell: none, sub: (item) => item.product?.name ?? "—" },
    { header: "Qty", align: "right", cell: none, sub: (item) => item.quantity },
    {
      header: "Type",
      cell: none,
      sub: (item) => <Badge variant="outline">{item.purchaseType}</Badge>,
    },
    { header: "Batch", cell: none, sub: (item) => item.batchNo || "—" },
    {
      header: "Unit Cost",
      align: "right",
      cell: none,
      sub: (item) => money(item.unitCost),
    },
    {
      header: "Line Total",
      align: "right",
      cell: none,
      sub: (item) => money(item.totalCost),
    },
    {
      header: "Invoice Total",
      align: "right",
      merge: true,
      cell: (p) => (
        <span className="font-semibold">{formatCurrency(p.totalCost)}</span>
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
            rowKey={(p) => p.id}
            lines={(p) => p.items}
            subRowKey={(item) => item.id}
            countNoun="invoices"
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
