"use client";

import * as React from "react";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Wallet,
  Users,
  Package,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  IndianRupee,
  BarChart3,
} from "lucide-react";
import { dashboardOptions } from "@/lib/query-options";

const COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(160, 60%, 45%)",
  "hsl(280, 65%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(350, 80%, 55%)",
  "hsl(190, 70%, 50%)",
  "hsl(45, 85%, 55%)",
  "hsl(320, 70%, 55%)",
];

interface DashboardData {
  role: "admin" | "staff";
  kpis: {
    totalRevenue: number;
    totalProfit: number;
    totalExpenses: number;
    totalCollections: number;
    totalQtySold: number;
    customerCount: number;
    todayRevenue: number;
    comSaleCount: number;
    domSaleCount: number;
  };
  dailyTrend: {
    date: string;
    revenue: number;
    cost: number;
    expense: number;
    profit: number;
    collections: number;
    comSales: number;
    domSales: number;
  }[];
  productBreakdown: {
    name: string;
    revenue: number;
    qty: number;
    fill: string;
  }[];
  lowStock: {
    id: number;
    batchNo: string;
    productName: string;
    quantity: number;
  }[];
  recentTxns: {
    id: number;
    trNo: string | null;
    customer: string;
    product: string;
    amount: number;
    date: string;
    type: string;
  }[];
}

const trendConfig = {
  revenue: { label: "Revenue", color: "hsl(221, 83%, 53%)" },
  profit: { label: "Profit", color: "hsl(160, 60%, 45%)" },
  expense: { label: "Expenses", color: "hsl(350, 80%, 55%)" },
} satisfies ChartConfig;

const salesTypeConfig = {
  comSales: { label: "Commercial", color: "hsl(221, 83%, 53%)" },
  domSales: { label: "Domestic", color: "hsl(160, 60%, 45%)" },
} satisfies ChartConfig;

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

  // Build product chart config dynamically
  const productConfig = React.useMemo(() => {
    if (!data) return {} as ChartConfig;
    const cfg: ChartConfig = {};
    data.productBreakdown.forEach((p, i) => {
      // cfg[`product${i}`] = { label: p.name, color: COLORS[i % COLORS.length] };
      cfg[p.name] = { label: p.name, color: COLORS[i % COLORS.length] };
    });
    return cfg;
  }, [data]);

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

  const { kpis, dailyTrend, productBreakdown, lowStock, recentTxns, role } =
    data;
  const isStaff = role === "staff";
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
      gradient: "from-blue-600 to-indigo-700",
      shadow: "shadow-blue-500/20",
      staffVisible: true,
    },
    {
      title: "Net Profit",
      value: `₹${kpis.totalProfit.toLocaleString("en-IN")}`,
      subtitle: `Margin: ${profitMargin}%`,
      icon: kpis.totalProfit >= 0 ? TrendingUp : TrendingDown,
      gradient:
        kpis.totalProfit >= 0
          ? "from-emerald-500 to-teal-600"
          : "from-red-500 to-rose-600",
      shadow:
        kpis.totalProfit >= 0 ? "shadow-emerald-500/20" : "shadow-red-500/20",
      staffVisible: false,
    },
    {
      title: "Total Expenses",
      value: `₹${kpis.totalExpenses.toLocaleString("en-IN")}`,
      subtitle: `${kpis.comSaleCount + kpis.domSaleCount} total sales`,
      icon: Wallet,
      gradient: "from-rose-500 to-pink-600",
      shadow: "shadow-rose-500/20",
      staffVisible: false,
    },
    {
      title: "Collections",
      value: `₹${kpis.totalCollections.toLocaleString("en-IN")}`,
      subtitle: `${kpis.totalQtySold} cylinders sold`,
      icon: DollarSign,
      gradient: "from-violet-500 to-purple-600",
      shadow: "shadow-violet-500/20",
      staffVisible: true,
    },
  ];

  const visibleKpiCards = isStaff
    ? kpiCards.filter((c) => c.staffVisible)
    : kpiCards;

  console.log({ productConfig, data });

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

      {/* KPI Cards */}
      <div
        className={`grid gap-4 sm:grid-cols-2 ${isStaff ? "lg:grid-cols-2" : "lg:grid-cols-4"}`}
      >
        {visibleKpiCards.map((card) => (
          <Card
            key={card.title}
            className={`relative overflow-hidden border-0 bg-linear-to-br ${card.gradient} text-white shadow-lg ${card.shadow}`}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white/80">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">
                    {card.value}
                  </p>
                  <p className="text-xs text-white/60">{card.subtitle}</p>
                </div>
                <card.icon className="w-9 h-9 text-white/20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue & Profit Trend + Sales by Type */}
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
                Commercial vs. Domestic sales distribution
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
                    dataKey="comSales"
                    stackId="s"
                    fill="var(--color-comSales)"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="domSales"
                    stackId="s"
                    fill="var(--color-domSales)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Product Breakdown + Collections Trend (admin-only product breakdown) */}
      <div className={`grid gap-6 ${isStaff ? "" : "lg:grid-cols-5"}`}>
        {/* Product Revenue Breakdown — Pie Chart (admin only) */}
        {!isStaff && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-500" />
                Revenue by Product
              </CardTitle>
              <CardDescription>
                Product-wise revenue distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productBreakdown.length === 0 ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                  No product data available
                </div>
              ) : (
                <ChartContainer
                  config={productConfig}
                  className="mx-auto h-[280px] w-full"
                >
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
                                {productConfig[
                                  name as keyof typeof productConfig
                                ]?.label || name}
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
                          // formatter={(value) => {
                          //   return `₹${Number(value).toLocaleString("en-IN")}`;
                          // }}
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
                    <ChartLegend
                      content={<ChartLegendContent nameKey="name" />}
                    />
                  </PieChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Low Stock (admin only) + Recent Transactions */}
      <div className={`grid gap-6 ${isStaff ? "" : "lg:grid-cols-2"}`}>
        {/* Low Stock Alert (admin only) */}
        {!isStaff && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Low Stock Alert
              </CardTitle>
              <CardDescription>Products with quantity below 10</CardDescription>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Package className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-sm">All stock levels are healthy</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Batch</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowStock.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.batchNo}
                        </TableCell>
                        <TableCell>{s.productName}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              s.quantity <= 3 ? "destructive" : "secondary"
                            }
                            className="tabular-nums"
                          >
                            {s.quantity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-500" />
                Recent Transactions
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sales" className="text-xs">
                  View All <ArrowUpRight className="ml-1 w-3 h-3" />
                </Link>
              </Button>
            </div>
            <CardDescription>Latest commercial sales</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTxns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ShoppingCart className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm">No transactions yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>TR No</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTxns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium font-mono text-xs">
                        {t.trNo}
                      </TableCell>
                      <TableCell>{t.customer}</TableCell>
                      <TableCell>{t.product}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ₹{t.amount.toLocaleString("en-IN")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/sales/add">
                <Plus className="w-4 h-4 mr-2" />
                New Commercial Sale
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/dom-sales/add">
                <Plus className="w-4 h-4 mr-2" />
                New Domestic Sale
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/expenses/add">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/stock">
                <Package className="w-4 h-4 mr-2" />
                Manage Stock
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
