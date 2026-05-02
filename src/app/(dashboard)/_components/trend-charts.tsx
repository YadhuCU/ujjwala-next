"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { TrendingUp, BarChart3 } from "lucide-react";
import { DashboardData } from "./types";

const trendConfig = {
  revenue: { label: "Revenue", color: "hsl(221, 83%, 53%)" },
  profit: { label: "Profit", color: "hsl(160, 60%, 45%)" },
  expense: { label: "Expenses", color: "hsl(350, 80%, 55%)" },
} satisfies ChartConfig;

const salesTypeConfig = {
  newComSales: { label: "Commercial", color: "hsl(221, 83%, 53%)" },
  domSales:    { label: "Domestic",   color: "hsl(160, 60%, 45%)" },
  arbSales:    { label: "ARB",        color: "hsl(35, 90%, 55%)"  },
} satisfies ChartConfig;

export function TrendCharts({ data }: { data: DashboardData }) {
  const { dailyTrend, role } = data;
  const isStaff = role !== "Owner";

  return (
    <div className={`grid gap-6 ${isStaff ? "" : "lg:grid-cols-7"}`}>
      {/* Revenue & Profit Trend — Area Chart */}
      <Card className={isStaff ? "" : "lg:col-span-4"}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            {isStaff ? "Your Sales Trend" : "Revenue & Profit Trend"}
          </CardTitle>
          <CardDescription>
            {isStaff
              ? "Daily revenue from your sales"
              : "Daily revenue, profit, and expenses over the selected period"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={trendConfig} className="h-[300px] w-full">
            <AreaChart
              data={dailyTrend}
              margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-revenue)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
                <linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-profit)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-profit)"
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => {
                  const d = new Date(v);
                  return `${d.getDate()}/${d.getMonth() + 1}`;
                }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v) => `₹${v}`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-revenue)"
                fill="url(#fillRevenue)"
                strokeWidth={2}
              />
              {!isStaff && (
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="var(--color-profit)"
                  fill="url(#fillProfit)"
                  strokeWidth={2}
                />
              )}
              {!isStaff && (
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="var(--color-expense)"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              )}
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Sales by Type — Bar Chart (admin only) */}
      {!isStaff && (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-500" />
              Sales by Type
            </CardTitle>
            <CardDescription>
              Commercial, Domestic &amp; ARB sales distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={salesTypeConfig}
              className="h-[300px] w-full"
            >
              <BarChart
                data={dailyTrend}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="newComSales"
                  stackId="s"
                  fill="var(--color-newComSales)"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="domSales"
                  stackId="s"
                  fill="var(--color-domSales)"
                  radius={[0, 0, 0, 0]}
                />
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
