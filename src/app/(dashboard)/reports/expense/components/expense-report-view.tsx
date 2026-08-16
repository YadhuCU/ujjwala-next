"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUsers } from "@/hooks/use-api";
import { usePermission } from "@/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { api } from "@/lib/api-client";
import { expenseReportOptions } from "@/lib/query-options";
import type { ExpenseReportResponse } from "@/module/report/report.serializer";
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

type ExpenseRow = ExpenseReportResponse["data"][number];

const ALL = "all";

export function ExpenseReportView() {
  const filters = useReportFilters();
  // The staff drill-down only means something to someone who can see the
  // whole agency; the service ignores a staffId sent by anyone else.
  const { hasPermission } = usePermission();
  const canFilterByStaff = hasPermission(PERMISSIONS.REPORT_READ_ALL);
  const [staffId, setStaffId] = useState(ALL);

  const { data: staffUsers = [] } = useUsers();

  const { data: report, isLoading, isFetching } = useQuery({
    ...expenseReportOptions({
      from: filters.fromDate,
      to: filters.toDate,
      staffId: staffId !== ALL ? staffId : undefined,
      page: filters.page,
      limit: REPORT_PAGE_LIMIT,
    }),
    enabled: filters.searchTriggered,
  });

  const columns: ReportColumn<ExpenseRow>[] = [
    {
      header: "Date",
      cell: (row) =>
        row.date ? new Date(row.date).toLocaleDateString("en-IN") : "—",
    },
    { header: "Expense", cell: (row) => row.expense ?? "—" },
    { header: "Recorded By", cell: (row) => row.createdBy?.name ?? "—" },
    {
      header: "Amount",
      align: "right",
      cell: (row) => (
        <span className="font-semibold">{formatCurrency(row.amount)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <ReportFilterCard filters={filters}>
        {/* Staff only ever see their own spending, so the filter is owner-only */}
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
              { title: "Total Expenses", value: report?.summary.expenseCount },
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
              api.exportExpenseReport({
                from: filters.fromDate,
                to: filters.toDate,
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
