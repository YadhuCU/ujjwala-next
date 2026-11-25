"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { profitReportOptions } from "@/lib/query-options";
import { cn } from "@/lib/utils";
import {
  PROFIT_CATEGORIES,
  PROFIT_CATEGORY_LABEL,
  type ProfitRow,
  type ProfitView,
} from "@/module/report/report.profit";
import { ReportFilterCard } from "../../_components/report-filter-card";
import {
  ReportResults,
  ReportSummary,
  type ReportColumn,
  type SummaryTile,
} from "../../_components/report-results";
import {
  formatCurrency,
  useReportFilters,
} from "../../_components/use-report-filters";

const VIEWS: { value: ProfitView; label: string }[] = [
  { value: "category", label: "Category wise" },
  { value: "item", label: "Item wise" },
];

const formatMargin = (value: number) => `${value.toFixed(1)}%`;

/** A loss reads as a loss: red, with the sign the currency format keeps. */
function Money({ value, strong }: { value: number; strong?: boolean }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        strong && "font-semibold",
        value < 0 && "text-destructive",
      )}
    >
      {formatCurrency(value)}
    </span>
  );
}

export function ProfitReportView() {
  const filters = useReportFilters();
  const [view, setView] = useState<ProfitView>("category");
  const [category, setCategory] = useState("all");

  const params = {
    from: filters.fromDate,
    to: filters.toDate,
    view,
    category,
  };
  const { data: report, isLoading, isFetching } = useQuery({
    ...profitReportOptions(params),
    enabled: filters.searchTriggered,
  });

  const money: ReportColumn<ProfitRow>[] = [
    { header: "Qty Sold", align: "right", cell: (row) => row.qty },
    { header: "Sales", align: "right", cell: (row) => <Money value={row.sales} /> },
    { header: "Cost", align: "right", cell: (row) => <Money value={row.cost} /> },
    {
      header: "Gross Profit",
      align: "right",
      cell: (row) => <Money value={row.profit} strong />,
    },
    {
      header: "Margin",
      align: "right",
      cell: (row) => (row.margin === null ? "—" : formatMargin(row.margin)),
    },
  ];

  const columns: ReportColumn<ProfitRow>[] =
    view === "category"
      ? [
          {
            header: "Category",
            cell: (row) => <span className="font-medium">{row.categoryLabel}</span>,
          },
          { header: "Invoices", align: "right", cell: (row) => row.invoiceCount },
          ...money,
        ]
      : [
          { header: "Item", cell: (row) => row.productName },
          { header: "Category", cell: (row) => row.categoryLabel },
          ...money,
        ];

  const summary = report?.summary;
  const tiles: SummaryTile[] = [
    { title: "Sales", value: summary?.sales, format: formatCurrency },
    { title: "Cost of goods sold", value: summary?.cost, format: formatCurrency },
    {
      title: "Gross profit",
      value: summary?.grossProfit,
      format: formatCurrency,
      highlight: true,
    },
    { title: "Margin", value: summary?.margin ?? undefined, format: formatMargin },
  ];
  // Expenses belong to no category, so net profit only exists for all of them
  if (category === "all") {
    tiles.push(
      { title: "Expenses", value: summary?.expenses ?? undefined, format: formatCurrency },
      { title: "Net profit", value: summary?.netProfit ?? undefined, format: formatCurrency },
    );
  }

  return (
    <div className="space-y-6">
      <ReportFilterCard filters={filters}>
        <div className="col-span-2 space-y-2 md:col-span-1">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PROFIT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {PROFIT_CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ReportFilterCard>

      {filters.searchTriggered && (
        <>
          <div
            role="group"
            aria-label="Group the report by"
            className="bg-muted inline-flex rounded-lg p-1"
          >
            {VIEWS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={view === option.value ? "default" : "ghost"}
                aria-pressed={view === option.value}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <ReportSummary isLoading={isLoading} tiles={tiles} />

          {summary && summary.uncostedQty > 0 && (
            <p className="border-warning/40 bg-warning/10 text-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
              <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {summary.uncostedQty} sold{" "}
                {summary.uncostedQty === 1 ? "unit came" : "units came"} from
                stock batches with no cost recorded. Their cost counts as ₹0, so
                profit is overstated by that much. The Qty Without Cost column
                in the export shows which rows.
              </span>
            </p>
          )}

          <ReportResults
            columns={columns}
            rows={report?.data ?? []}
            rowKey={(row) => row.key}
            pagination={report?.pagination}
            countNoun={view === "category" ? "categories" : "items"}
            isLoading={isLoading}
            isFetching={isFetching}
            onPageChange={filters.setPage}
            onExport={(format) => api.exportProfitReport({ ...params, format })}
          />

          <p className="text-muted-foreground text-xs">
            Sales are what customers were charged, after discount; an
            invoice&apos;s discount is shared across its items. Cost is what the
            stock batch each item came from cost to buy. Gross profit = Sales −
            Cost. Net profit also takes off the period&apos;s expenses, which
            belong to no single category. Sales are dated by when they were
            entered, like the sale reports and the dashboard.
          </p>
        </>
      )}
    </div>
  );
}
