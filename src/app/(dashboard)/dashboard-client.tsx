"use client";

import * as React from "react";
import { DateRange } from "react-day-picker";
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

export default function DashboardPage() {
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(
    () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from, to };
    },
  );

  const fromStr = dateRange?.from
    ? dateRange.from.toISOString().split("T")[0]
    : undefined;
  const toStr = dateRange?.to
    ? dateRange.to.toISOString().split("T")[0]
    : undefined;

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

  const isStaff = data.role === "staff";

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

      <KpiCards data={data} />
      
      <TrendCharts data={data} />

      <div className={`grid gap-6 ${isStaff ? "" : "lg:grid-cols-5"}`}>
        <ProductBreakdown data={data} />
      </div>

      <InventoryAndTransactions data={data} />
      
      <CommercialAlerts data={data} />
      
      <QuickActions />
    </div>
  );
}
