"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardOptions } from "@/lib/query-options";
import { cn } from "@/lib/utils";
import { KpiCards } from "./_components/kpi-cards";
import { TrendCharts } from "./_components/trend-charts";
import { ProductBreakdown } from "./_components/product-breakdown";
import { LowStockCard } from "./_components/low-stock";
import { CommercialAlerts } from "./_components/commercial-alerts";
import { QuickActions } from "./_components/quick-actions";
import { GodownPreview } from "./_components/godown-preview";
import { DashboardHero } from "./_components/dashboard-hero";
import { PeriodPicker } from "./_components/period-picker";
import { rangeLabel, type PeriodSelection } from "./_components/period";

export default function DashboardPage() {
  const { data: session } = useSession();
  // Month view by default. No dates means the view's own default range; the
  // server resolves it and sends back exactly what it covered.
  const [selection, setSelection] = React.useState<PeriodSelection>({
    view: "month",
  });

  const { data, isLoading, isFetching } = useQuery(
    dashboardOptions(selection.view, selection.from, selection.to),
  );

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-[320px]" />
        </div>
        <Skeleton className="h-44 rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
      </div>
    );
  }

  const { period, cards } = data;
  const isStaff = data.scope !== "all";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-[22px] leading-tight font-bold tracking-[-0.02em] sm:text-[26px]">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            {isStaff ? "Your sales & collections" : "Your gas agency"},{" "}
            {rangeLabel(period.view, period.from, period.to)}
          </p>
        </div>
        <PeriodPicker
          view={period.view}
          from={period.from}
          to={period.to}
          onChange={setSelection}
        />
      </div>

      <DashboardHero name={session?.user?.name} />

      {/* Cylinder position first — it is the question the agency asks most */}
      {cards.cylinderPosition && <GodownPreview />}

      <QuickActions />

      {/* Everything below follows the period; dim it while a new one loads */}
      <div
        aria-busy={isFetching}
        className={cn(
          "space-y-6 transition-opacity",
          isFetching && "opacity-60",
        )}
      >
        <KpiCards data={data} />

        <TrendCharts data={data} onDrill={setSelection} />

        {(cards.productBreakdown || cards.lowStock) && (
          <div
            className={cn(
              "grid grid-cols-1 gap-6",
              cards.productBreakdown && cards.lowStock && "lg:grid-cols-2",
            )}
          >
            <ProductBreakdown data={data} />
            <LowStockCard data={data} />
          </div>
        )}
      </div>

      {cards.commercialAlerts && <CommercialAlerts />}
    </div>
  );
}
