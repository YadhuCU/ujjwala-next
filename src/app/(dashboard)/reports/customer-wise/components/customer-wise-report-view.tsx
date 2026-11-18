"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCustomers } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { customerWiseReportOptions } from "@/lib/query-options";
import type { CustomerWiseResponse } from "@/module/report/report.serializer";
import {
  receiptTypeLabel,
  type CustomerProductRow,
} from "@/module/report/report.rollup";
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

type CustomerRow = CustomerWiseResponse["data"][number];

const ALL = "all";

/** A negative balance is money the agency holds for the customer. */
const balance = (value: number) =>
  value < 0 ? (
    <span className="text-emerald-700 dark:text-emerald-400">
      {formatCurrency(-value)} credit
    </span>
  ) : (
    formatCurrency(value)
  );

/** Rented, with outright sales noted under it — they are never held. */
function SalesQty({ rented, sold }: { rented: number; sold: number }) {
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span>{rented}</span>
      {sold > 0 && (
        <span className="text-muted-foreground text-[11px]">
          +{sold} sold outright
        </span>
      )}
    </span>
  );
}

export function CustomerWiseReportView() {
  const filters = useReportFilters();
  const [customerId, setCustomerId] = useState(ALL);
  const { data: customers } = useCustomers();

  const params = {
    from: filters.fromDate,
    to: filters.toDate,
    customerId: customerId !== ALL ? customerId : undefined,
    page: filters.page,
    limit: REPORT_PAGE_LIMIT,
  };

  const { data: report, isLoading, isFetching } = useQuery({
    ...customerWiseReportOptions(params),
    enabled: filters.searchTriggered,
  });

  // Cylinder columns read per size on a sub row; money belongs to the customer
  // and stays on the main row, so it is never counted twice.
  const columns: ReportColumn<CustomerRow, CustomerProductRow>[] = [
    {
      header: "Customer",
      cell: (row) => (
        <span className="flex flex-col leading-tight">
          <span className="font-medium">{row.customerName}</span>
          {row.products.length === 1 && (
            <span className="text-muted-foreground text-xs">
              {row.products[0].productName}
            </span>
          )}
        </span>
      ),
      sub: (product) => product.productName,
    },
    {
      header: "Opening Empty",
      align: "right",
      cell: (row) => row.openingEmpty,
      sub: (product) => product.openingEmpty,
    },
    {
      header: "Sales Qty",
      align: "right",
      cell: (row) => <SalesQty rented={row.rentedQty} sold={row.soldQty} />,
      sub: (product) => (
        <SalesQty rented={product.rentedQty} sold={product.soldQty} />
      ),
    },
    {
      header: "Empty Back",
      align: "right",
      cell: (row) => row.emptyBack,
      sub: (product) => product.emptyBack,
    },
    {
      header: "Balance Empty",
      align: "right",
      cell: (row) => <span className="font-semibold">{row.balanceEmpty}</span>,
      sub: (product) => product.balanceEmpty,
    },
    {
      header: "Opening Balance",
      align: "right",
      cell: (row) => balance(row.openingBalance),
    },
    {
      header: "Sales Amount",
      align: "right",
      cell: (row) => formatCurrency(row.salesAmount),
    },
    {
      header: "Receipt",
      align: "right",
      cell: (row) => formatCurrency(row.receipts),
    },
    {
      header: "Receipt Type",
      cell: (row) => receiptTypeLabel(row.receiptTypes),
    },
    {
      header: "Outstanding",
      align: "right",
      cell: (row) => (
        <span className="font-semibold">{balance(row.outstanding)}</span>
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
      </ReportFilterCard>

      {filters.searchTriggered && (
        <>
          <ReportSummary
            isLoading={isLoading}
            tiles={[
              { title: "Customers", value: report?.summary.customerCount },
              {
                title: "Sales Amount",
                value: report?.summary.salesAmount,
                format: formatCurrency,
              },
              {
                title: "Received",
                value: report?.summary.receipts,
                format: formatCurrency,
              },
              {
                title: "Outstanding",
                value: report?.summary.outstanding,
                format: formatCurrency,
                highlight: true,
              },
            ]}
          />

          <ReportResults
            columns={columns}
            rows={report?.data ?? []}
            rowKey={(row) => row.customerId}
            // One line per cylinder size, only when there is more than one
            subRows={(row) => (row.products.length > 1 ? row.products : [])}
            subRowKey={(product) => product.productId}
            countNoun="customers"
            pagination={report?.pagination}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={filters.setPage}
            onExport={(format) =>
              api.exportCustomerWiseReport({
                from: filters.fromDate,
                to: filters.toDate,
                customerId: params.customerId,
                format,
              })
            }
          />

          <p className="text-muted-foreground text-xs">
            Opening Empty + Sales Qty − Empty Back = Balance Empty, per cylinder
            size. Sales Qty counts rented cylinders, the ones that come back
            empty; outright sales are noted under it and included in Sales
            Amount. Opening Balance + Sales Amount − Receipt = Outstanding.
          </p>
        </>
      )}
    </div>
  );
}
