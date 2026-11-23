"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { TrendingUp, BarChart3 } from "lucide-react";
import { DashboardData } from "./types";
import { bucketLabel, drillInto, stepWord, tickLabel, type PeriodSelection } from "./period";

const trendConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  profit: { label: "Profit", color: "var(--chart-4)" },
  expense: { label: "Expenses", color: "var(--chart-2)" },
} satisfies ChartConfig;

const salesTypeConfig = {
  newComSales: { label: "Commercial", color: "var(--chart-1)" },
  domSales:    { label: "Domestic",   color: "var(--chart-3)" },
  arbSales:    { label: "ARB",        color: "var(--chart-5)" },
} satisfies ChartConfig;

// ₹1.9L rather than ₹187298 — the full figure crowds a phone-width axis
const compact = new Intl.NumberFormat("en-IN", { notation: "compact" });

export function TrendCharts({
  data,
  onDrill,
}: {
  data: DashboardData;
  /** Opens the period behind a clicked bar (a year's months, a month's days) */
  onDrill: (next: PeriodSelection) => void;
}) {
  const { trend, canSeeFinancials, scope, cards, period } = data;
  const view = period.view;
  // Cost and profit series are money; the wording follows how far the
  // figures reach, which is a different grant.
  const hideMoney = !canSeeFinancials;
  const ownOnly = scope === "own";
  const both = cards.revenueTrend && cards.salesByType;

  if (!cards.revenueTrend && !cards.salesByType) return null;

  const canDrill = view !== "day";
  // Recharts hands the clicked bucket's key back as the active label
  const handleClick = (state: unknown) => {
    const key = (state as { activeLabel?: string | number } | null)?.activeLabel;
    if (key === undefined || key === null) return;
    const next = drillInto(view, String(key));
    if (next) onDrill(next);
  };
  const drillHint =
    view === "year"
      ? " Click a year to see its months."
      : view === "month"
        ? " Click a month to see its days."
        : "";

  const xAxis = (
    <XAxis
      dataKey="date"
      tickFormatter={(v) => tickLabel(view, String(v))}
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={16}
    />
  );
  const tooltipLabel = (v: unknown) => bucketLabel(view, String(v));

  return (
    <div className={`grid grid-cols-1 gap-6 ${both ? "lg:grid-cols-7" : ""}`}>
      {cards.revenueTrend && (
        <Card className={both ? "lg:col-span-4" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="text-success h-5 w-5" />
              {ownOnly ? "Your Sales Trend" : "Revenue & Profit Trend"}
            </CardTitle>
            <CardDescription>
              {hideMoney
                ? `${stepWord(view)} revenue from your sales.`
                : `${stepWord(view)} revenue, profit and expenses.`}
              {drillHint}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={trendConfig} className="h-[240px] w-full sm:h-[300px]">
              <BarChart
                data={trend}
                margin={{ top: 5, right: 4, left: 0, bottom: 0 }}
                onClick={canDrill ? handleClick : undefined}
                className={canDrill ? "cursor-pointer" : undefined}
                barGap={2}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                {xAxis}
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={44}
                  tickFormatter={(v) => `₹${compact.format(v)}`}
                />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={tooltipLabel} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} />
                {!hideMoney && (
                  <Bar dataKey="profit" fill="var(--color-profit)" radius={[3, 3, 0, 0]} />
                )}
                {!hideMoney && (
                  <Bar dataKey="expense" fill="var(--color-expense)" radius={[3, 3, 0, 0]} />
                )}
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {cards.salesByType && (
        <Card className={both ? "lg:col-span-3" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="text-primary h-5 w-5" />
              Sales by Type
            </CardTitle>
            <CardDescription>
              {stepWord(view)} commercial, domestic &amp; ARB invoices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={salesTypeConfig}
              className="h-[240px] w-full sm:h-[300px]"
            >
              <BarChart
                data={trend}
                margin={{ top: 5, right: 4, left: 0, bottom: 0 }}
                onClick={canDrill ? handleClick : undefined}
                className={canDrill ? "cursor-pointer" : undefined}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                {xAxis}
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  width={32}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent labelFormatter={tooltipLabel} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="newComSales" stackId="s" fill="var(--color-newComSales)" />
                <Bar dataKey="domSales" stackId="s" fill="var(--color-domSales)" />
                <Bar
                  dataKey="arbSales"
                  stackId="s"
                  fill="var(--color-arbSales)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
