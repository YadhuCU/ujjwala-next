"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { useCustomers, useUsers } from "@/hooks/use-api";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { api } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { SaleReportParams } from "@/lib/query-options";
import type { SaleReportResponse } from "@/module/report/report.serializer";
import {
  ReportFilterCard,
  ReportSelectFilter,
} from "./report-filter-card";
import {
  ReportResults,
  ReportSummary,
  type ReportColumn,
} from "./report-results";
import {
  formatCurrency,
  REPORT_PAGE_LIMIT,
  useReportFilters,
} from "./use-report-filters";

type SaleRow = SaleReportResponse["data"][number];

export type SaleReportKind = "dom" | "arb" | "commercial";

// One fetcher and one query key per kind — the rest of the report is identical
const FETCHERS: Record<
  SaleReportKind,
  (params: SaleReportParams) => Promise<SaleReportResponse>
> = {
  dom: api.getDomSaleReport,
  arb: api.getArbSaleReport,
  commercial: api.getCommercialSaleReport,
};

const KEYS: Record<SaleReportKind, (params: object) => readonly unknown[]> = {
  dom: queryKeys.domSaleReport.list,
  arb: queryKeys.arbSaleReport.list,
  commercial: queryKeys.commercialSaleReport.list,
};

const EXPORTS = {
  dom: api.exportDomSaleReport,
  arb: api.exportArbSaleReport,
  commercial: api.exportCommercialSaleReport,
} as const;

const ALL = "all";

/**
 * Domestic, ARB and commercial reports are the same report over different
 * models — only the custody column differs, so they share this view.
 */
export function SaleReportView({ kind }: { kind: SaleReportKind }) {
  const filters = useReportFilters();
  // The staff drill-down only means something to someone who can see the
  // whole agency; the service ignores a staffId sent by anyone else.
  const { hasPermission } = usePermission();
  const canFilterByStaff = hasPermission(PERMISSIONS.REPORT_READ_ALL);

  const [customerId, setCustomerId] = useState(ALL);
  const [staffId, setStaffId] = useState(ALL);

  const { data: customers } = useCustomers();
  const { data: staffUsers = [] } = useUsers();

  const params: SaleReportParams = {
    from: filters.fromDate,
    to: filters.toDate,
    customerId: customerId !== ALL ? customerId : undefined,
    staffId: staffId !== ALL ? staffId : undefined,
    page: filters.page,
    limit: REPORT_PAGE_LIMIT,
  };

  const { data: report, isLoading, isFetching } = useQuery({
    queryKey: KEYS[kind](params),
    queryFn: () => FETCHERS[kind](params),
    enabled: filters.searchTriggered,
  });

  const rows = report?.data ?? [];
  const showCustody = kind === "commercial";

  const columns: ReportColumn<SaleRow>[] = [
    { header: "Tr No", cell: (row) => row.trNo ?? "—" },
    {
      header: "Date",
      cell: (row) => new Date(row.createdAt).toLocaleDateString("en-IN"),
    },
    { header: "Customer", cell: (row) => row.customer?.name ?? "—" },
    { header: "Staff", cell: (row) => row.createdBy?.name ?? "—" },
    {
      header: "Products (Qty)",
      cell: (row) =>
        row.items
          .map((item) => `${item.product?.name ?? ""} (${item.quantity})`)
          .join(", "),
    },
    {
      header: "Batches",
      cell: (row) =>
        row.items
          .map((item) => item.stock?.batchNo)
          .filter(Boolean)
          .join(", ") || "—",
    },
    ...(showCustody
      ? [
          {
            header: "With Customer",
            align: "right" as const,
            cell: (row: SaleRow) => {
              const outstanding = row.items.reduce(
                (sum, item) =>
                  sum +
                  ((item.cylindersDispatched ?? 0) -
                    (item.cylindersReturned ?? 0)),
                0,
              );
              return outstanding > 0 ? (
                <Badge variant="outline">{outstanding}</Badge>
              ) : (
                "—"
              );
            },
          },
        ]
      : []),
    {
      header: "Discount",
      align: "right",
      cell: (row) => (row.discount ? formatCurrency(row.discount) : "—"),
    },
    {
      header: "Paid",
      align: "right",
      cell: (row) => formatCurrency(row.paidAmount),
    },
    {
      header: "Total",
      align: "right",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.totalAmount)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFilterCard filters={filters}>
        <ReportSelectFilter
          label="Customer"
          value={customerId}
          onChange={setCustomerId}
          options={customers}
        />
        {canFilterByStaff && (
          <ReportSelectFilter
            label="Staff"
            value={staffId}
            onChange={setStaffId}
            options={staffUsers}
            allLabel="All Staff"
          />
        )}
      </ReportFilterCard>

      {filters.searchTriggered && (
        <>
          <ReportSummary
            isLoading={isLoading}
            tiles={[
              {
                title: "Total Invoices",
                value: report?.summary.invoiceCount,
              },
              {
                title: "Total Amount",
                value: report?.summary.totalSubtotal,
                format: formatCurrency,
              },
              {
                title: "Total Discount",
                value: report?.summary.totalDiscount,
                format: formatCurrency,
              },
              {
                title: "Net Total",
                value: report?.summary.totalNetTotal,
                format: formatCurrency,
                highlight: true,
              },
            ]}
          />

          <ReportResults
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            pagination={report?.pagination}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={filters.setPage}
            onExport={(format) =>
              EXPORTS[kind]({
                from: filters.fromDate,
                to: filters.toDate,
                customerId: customerId !== ALL ? customerId : undefined,
                staffId: staffId !== ALL ? staffId : undefined,
                format,
              })
            }
          />
        </>
      )}
    </div>
  );
}
