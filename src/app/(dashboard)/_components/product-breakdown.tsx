"use client";

import * as React from "react";
import { Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Package } from "lucide-react";
import { DashboardData } from "./types";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-5)",
  "var(--chart-4)",
  "#7c93b1",
  "#9f1e1a",
  "#0b3a6b",
];

export function ProductBreakdown({ data }: { data: DashboardData }) {
  const { productBreakdown, cards } = data;

  const productConfig = React.useMemo(() => {
    if (!productBreakdown) return {} as ChartConfig;
    const cfg: ChartConfig = {};
    productBreakdown.forEach((p, i) => {
      cfg[p.name] = { label: p.name, color: COLORS[i % COLORS.length] };
    });
    return cfg;
  }, [productBreakdown]);

  if (!cards.productBreakdown) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Revenue by Product
        </CardTitle>
        <CardDescription>Revenue per product over the period</CardDescription>
      </CardHeader>
      <CardContent>
        {productBreakdown.length === 0 ? (
          <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
            No product data available
          </div>
        ) : (
          <ChartContainer config={productConfig} className="mx-auto h-[280px] w-full">
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, item) => (
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-0.5 items-center border-b pb-0.5">
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-(--color-bg)"
                            style={
                              {
                                "--color-bg": item.payload.fill,
                              } as React.CSSProperties
                            }
                          />
                          {productConfig[name as keyof typeof productConfig]?.label || name}
                        </div>
                        <div className="flex gap-1">
                          <div className="flex-1 text-foreground flex flex-col gap-0.5 font-medium  tabular-nums">
                            <div>Revenue</div>
                            <div className="font-mono font-semibold">{`₹ ${Number(item.payload.revenue).toLocaleString("en-IN")}`}</div>
                          </div>
                          <div className="flex-1 text-foreground flex flex-col gap-0.5 font-medium  tabular-nums">
                            <div>Total Qty</div>
                            <div className="font-mono font-semibold">
                              {item.payload.qty}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={productBreakdown.map((p, i) => ({
                  ...p,
                  fill: COLORS[i % COLORS.length],
                }))}
                dataKey="revenue"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                strokeWidth={2}
                paddingAngle={2}
              >
                {productBreakdown.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
