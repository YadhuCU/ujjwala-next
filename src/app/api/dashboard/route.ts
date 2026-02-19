import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  return withAuth(async ({ userId, role }) => {
    const sp = req.nextUrl.searchParams;
    const from = sp.get("from");
    const to = sp.get("to");

    // Default to last 30 days
    const endDate = to ? new Date(to) : new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = from ? new Date(from) : new Date(endDate);
    if (!from) startDate.setDate(startDate.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Staff-scoped filtering
    const isStaff = role === "staff";
    const ownerFilter = isStaff ? { createdById: userId } : {};

    // ─── Range data ───
    const rangeSales = await prisma.sale.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, isDeleted: false, ...ownerFilter },
      include: { product: true },
    });
    const rangeDomSales = await prisma.domSale.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, isDeleted: false, ...ownerFilter },
      include: { product: true, stock: true },
    });
    const rangeExpenses = isStaff ? [] : await prisma.expense.findMany({
      where: { date: { gte: startDate, lte: endDate }, isDeleted: false },
    });
    const rangeCollections = await prisma.collection.findMany({
      where: { createdAt: { gte: startDate, lte: endDate }, isDeleted: false, ...ownerFilter },
    });

    // ─── KPIs ───
    const totalRevenue = rangeSales.reduce((s, r) => s + parseFloat(r.netTotal || "0"), 0)
      + rangeDomSales.reduce((s, r) => s + parseFloat(r.netTotal || "0"), 0);
    const totalCost = rangeSales.reduce((s, r) => s + parseFloat(r.quantity || "0") * parseFloat(r.productCost || "0"), 0)
      + rangeDomSales.reduce((s, r) => s + parseFloat(r.quantity || "0") * parseFloat(r.stock?.productCost || "0"), 0);
    const totalExpenses = rangeExpenses.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
    const totalProfit = totalRevenue - totalCost - totalExpenses;
    const totalCollections = rangeCollections.reduce((s, r) => s + parseFloat(r.amount || "0"), 0);
    const totalQtySold = rangeSales.reduce((s, r) => s + parseInt(r.quantity || "0"), 0)
      + rangeDomSales.reduce((s, r) => s + parseInt(r.quantity || "0"), 0);
    const customerCount = isStaff ? 0 : await prisma.customer.count({ where: { isDeleted: false } });

    // ─── Today KPIs ───
    const todaySales = rangeSales.filter(s => s.createdAt >= today && s.createdAt < tomorrow);
    const todayDomSales = rangeDomSales.filter(s => s.createdAt >= today && s.createdAt < tomorrow);
    const todayRevenue = todaySales.reduce((s, r) => s + parseFloat(r.netTotal || "0"), 0)
      + todayDomSales.reduce((s, r) => s + parseFloat(r.netTotal || "0"), 0);

    // ─── Daily trend data ───
    const dailyMap: Record<string, { revenue: number; cost: number; expense: number; collections: number; comSales: number; domSales: number }> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dailyMap[d.toISOString().split("T")[0]] = { revenue: 0, cost: 0, expense: 0, collections: 0, comSales: 0, domSales: 0 };
    }
    for (const s of rangeSales) {
      const k = s.createdAt.toISOString().split("T")[0];
      if (dailyMap[k]) {
        dailyMap[k].revenue += parseFloat(s.netTotal || "0");
        dailyMap[k].cost += parseFloat(s.quantity || "0") * parseFloat(s.productCost || "0");
        dailyMap[k].comSales++;
      }
    }
    for (const s of rangeDomSales) {
      const k = s.createdAt.toISOString().split("T")[0];
      if (dailyMap[k]) {
        dailyMap[k].revenue += parseFloat(s.netTotal || "0");
        dailyMap[k].cost += parseFloat(s.quantity || "0") * parseFloat(s.stock?.productCost || "0");
        dailyMap[k].domSales++;
      }
    }
    for (const e of rangeExpenses) {
      if (e.date) {
        const k = e.date.toISOString().split("T")[0];
        if (dailyMap[k]) dailyMap[k].expense += parseFloat(e.amount || "0");
      }
    }
    for (const c of rangeCollections) {
      const k = c.createdAt.toISOString().split("T")[0];
      if (dailyMap[k]) dailyMap[k].collections += parseFloat(c.amount || "0");
    }
    const dailyTrend = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({
      date,
      revenue: Math.round(v.revenue),
      cost: Math.round(v.cost),
      expense: Math.round(v.expense),
      profit: Math.round(v.revenue - v.cost - v.expense),
      collections: Math.round(v.collections),
      comSales: v.comSales,
      domSales: v.domSales,
    }));

    // ─── Product breakdown (admin only) ───
    const productBreakdown = isStaff ? [] : (() => {
      const productMap: Record<string, { name: string; revenue: number; qty: number }> = {};
      for (const s of rangeSales) {
        const name = s.product?.name || "Unknown";
        if (!productMap[name]) productMap[name] = { name, revenue: 0, qty: 0 };
        productMap[name].revenue += parseFloat(s.netTotal || "0");
        productMap[name].qty += parseInt(s.quantity || "0");
      }
      for (const s of rangeDomSales) {
        const name = s.product?.name || "Unknown";
        if (!productMap[name]) productMap[name] = { name, revenue: 0, qty: 0 };
        productMap[name].revenue += parseFloat(s.netTotal || "0");
        productMap[name].qty += parseInt(s.quantity || "0");
      }
      return Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map((p, i) => ({ ...p, revenue: Math.round(p.revenue), fill: `var(--color-product${i})` }));
    })();

    // ─── Low stock (admin only) ───
    const lowStock = isStaff ? [] : await (async () => {
      const allStocks = await prisma.stock.findMany({ where: { isDeleted: false }, include: { product: true } });
      return allStocks
        .filter(s => parseInt(s.quantity || "0") < 10)
        .map(s => ({ id: s.id, batchNo: s.batchNo || "", productName: s.product?.name || "", quantity: parseInt(s.quantity || "0") }));
    })();

    // ─── Recent transactions ───
    const recentSales = await prisma.sale.findMany({
      where: { isDeleted: false, ...ownerFilter },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { customer: true, product: true },
    });
    const recentTxns = recentSales.map(s => ({
      id: s.id,
      trNo: s.trNo,
      customer: s.customer?.name || "N/A",
      product: s.product?.name || "N/A",
      amount: parseFloat(s.netTotal || "0"),
      date: s.createdAt.toISOString(),
      type: "Commercial" as const,
    }));

    return NextResponse.json({
      role,
      kpis: {
        totalRevenue: Math.round(totalRevenue),
        totalProfit: Math.round(totalProfit),
        totalExpenses: Math.round(totalExpenses),
        totalCollections: Math.round(totalCollections),
        totalQtySold,
        customerCount,
        todayRevenue: Math.round(todayRevenue),
        comSaleCount: rangeSales.length,
        domSaleCount: rangeDomSales.length,
      },
      dailyTrend,
      productBreakdown,
      lowStock,
      recentTxns,
    });
  });
}
