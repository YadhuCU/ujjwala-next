"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { toSaleLines } from "@/module/report/report.lines";
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

  // One row per item sold, so item, quantity and type each get a column. The
  // export goes through the same expansion, so the file matches the screen.
  const rows = toSaleLines(report?.data ?? []);
  const showCustody = kind === "commercial";
  // Dom and commercial lines are RENT or SALE; an ARB line is neither.
  const showType = kind !== "arb";

  type Line = (typeof rows)[number];

  // Money that belongs to the invoice is shown on its first line only, so a
  // column of totals still adds up instead of counting an invoice per item.
  const onFirst = (line: Line, node: React.ReactNode) =>
    line.first ? node : null;

  const columns: ReportColumn<Line>[] = [
    { header: "Tr No", cell: (l) => l.sale.trNo ?? "—" },
    {
      header: "Date",
      cell: (l) => new Date(l.sale.createdAt).toLocaleDateString("en-IN"),
    },
    { header: "Customer", cell: (l) => l.sale.customer?.name ?? "—" },
    { header: "Staff", cell: (l) => l.sale.createdBy?.name ?? "—" },
    {
      header: "Item",
      cell: (l) =>
        l.item?.product?.name ?? (
          // An invoice with no items: a visit where cylinders were only collected
          <span className="text-muted-foreground">Collection only</span>
        ),
    },
    { header: "Batch", cell: (l) => l.item?.stock?.batchNo ?? "—" },
    ...(showType
      ? [
          {
            header: "Type",
            cell: (l: Line) =>
              l.item && "saleType" in l.item && l.item.saleType ? (
                <Badge variant="outline">{String(l.item.saleType)}</Badge>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    {
      header: "Qty",
      align: "right",
      cell: (l) => (l.item ? l.item.quantity : "—"),
    },
    ...(showCustody
      ? [
          {
            header: "With Customer",
            align: "right" as const,
            cell: (l: Line) => {
              const outstanding = l.item
                ? (l.item.cylindersDispatched ?? 0) -
                  (l.item.cylindersReturned ?? 0)
                : 0;
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
      cell: (l) =>
        onFirst(l, l.sale.discount ? formatCurrency(l.sale.discount) : "—"),
    },
    {
      header: "Paid",
      align: "right",
      cell: (l) => onFirst(l, formatCurrency(l.sale.paidAmount)),
    },
    {
      header: "Total",
      align: "right",
      cell: (l) =>
        onFirst(
          l,
          <span className="font-semibold">
            {formatCurrency(l.sale.totalAmount)}
          </span>,
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
            rowKey={(line) => `${line.sale.id}-${line.index}`}
            countNoun="invoices"
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
