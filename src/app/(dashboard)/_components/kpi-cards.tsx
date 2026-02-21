"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Wallet, IndianRupee } from "lucide-react";
import { DashboardData } from "./types";

export function KpiCards({ data }: { data: DashboardData }) {
  const { kpis, role } = data;
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

  return (
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
  );
}
