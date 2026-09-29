"use client";

import * as React from "react";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import { dashboardOptions } from "@/lib/query-options";
import { DashboardData } from "./_components/types";
import { KpiCards } from "./_components/kpi-cards";
import { TrendCharts } from "./_components/trend-charts";
import { ProductBreakdown } from "./_components/product-breakdown";
import { InventoryAndTransactions } from "./_components/inventory-txns";
import { CommercialAlerts } from "./_components/commercial-alerts";
import { QuickActions } from "./_components/quick-actions";
import { GodownPreview } from "./_components/godown-preview";

export default function DashboardPage() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from, to };
    },
  );

  // The calendar date the user picked, in their own timezone. This used to be
  // `toISOString().split("T")[0]`, which converts local midnight to UTC first —
  // in India that is the previous day, so picking "today" asked the server for
  // yesterday and today's sales never showed. The reports already did this
  // correctly with `format`.
  const fromStr = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : undefined;
  const toStr = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined;

  const { data, isLoading: loading } = useQuery({
    ...dashboardOptions(fromStr, toStr),
    select: (d) => d as unknown as DashboardData,
  });

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-[280px]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const isStaff = data.scope !== "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            {isStaff
              ? "Your personal sales & collections overview"
              : "Analytics overview for your gas agency"}
          </p>
        </div>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
        />
      </div>

      {/* Cylinder position first — it is the question the agency asks most */}
      <GodownPreview />

      <QuickActions />

      <KpiCards data={data} />
      
      <TrendCharts data={data} />

      <div className={`grid gap-6 ${isStaff ? "" : "lg:grid-cols-5"}`}>
        <ProductBreakdown data={data} />
      </div>

      <InventoryAndTransactions data={data} />
      
      <CommercialAlerts data={data} />
      
    </div>
  );
}
