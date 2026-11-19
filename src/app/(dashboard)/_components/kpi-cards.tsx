"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, HandCoins, Wallet, IndianRupee } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardData } from "./types";

export function KpiCards({ data }: { data: DashboardData }) {
  const { kpis, canSeeFinancials } = data;
  const profitMargin =
    kpis.totalRevenue > 0
      ? ((kpis.totalProfit / kpis.totalRevenue) * 100).toFixed(1)
      : "0";

  const kpiCards = [
    {
      title: "Total Revenue",
      value: `₹${kpis.totalRevenue.toLocaleString("en-IN")}`,
      subtitle: `Today: ₹${kpis.todayRevenue.toLocaleString("en-IN")}`,
      icon: IndianRupee,
      negative: false,
      financial: true,
    },
    {
      title: "Net Profit",
      value: `₹${kpis.totalProfit.toLocaleString("en-IN")}`,
      subtitle: `Margin: ${profitMargin}%`,
      icon: kpis.totalProfit >= 0 ? TrendingUp : TrendingDown,
      negative: kpis.totalProfit < 0,
      financial: true,
    },
    {
      title: "Total Expenses",
      value: `₹${kpis.totalExpenses.toLocaleString("en-IN")}`,
      subtitle: `${kpis.domSaleCount + kpis.arbSaleCount + kpis.newComSaleCount} total sales`,
      icon: Wallet,
      negative: false,
      financial: true,
    },
    {
      title: "Collections",
      value: `₹${kpis.totalCollections.toLocaleString("en-IN")}`,
      subtitle: `${kpis.totalQtySold} cylinders sold`,
      icon: HandCoins,
      negative: false,
      financial: false,
    },
  ];

  // Money totals are their own grant, separate from how far the figures reach.
  const visibleKpiCards = canSeeFinancials
    ? kpiCards
    : kpiCards.filter((card) => !card.financial);

  return (
    <div
      className={`grid grid-cols-2 gap-3 sm:gap-4 ${canSeeFinancials ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}
    >
      {/* White stat cards: label and icon, the figure, then what it covers */}
      {visibleKpiCards.map((card) => (
        <Card key={card.title} className="gap-0 py-0 max-sm:py-0">
          <CardContent className="p-4 max-sm:p-3 sm:p-5">
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs sm:text-[13px]">
              <span className="min-w-0 truncate">{card.title}</span>
              <card.icon
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0",
                  card.negative ? "text-destructive" : "text-primary",
                )}
              />
            </div>
            <p
              className={cn(
                "mt-2 text-lg font-bold tracking-tight tabular-nums break-all sm:text-2xl",
                card.negative && "text-destructive",
              )}
            >
              {card.value}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">{card.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
