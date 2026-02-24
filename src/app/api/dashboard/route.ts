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
    const isStaff = role !== "Owner";
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
    const totalRevenue = rangeSales.reduce((s, r) => s + Number(r.netTotal ?? 0), 0)
      + rangeDomSales.reduce((s, r) => s + Number(r.netTotal ?? 0), 0);
    const totalCost = rangeSales.reduce((s, r) => s + r.quantity * Number(r.productCost ?? 0), 0)
      + rangeDomSales.reduce((s, r) => s + r.quantity * Number(r.stock?.productCost ?? 0), 0);
    const totalExpenses = rangeExpenses.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalProfit = totalRevenue - totalCost - totalExpenses;
    const totalCollections = rangeCollections.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalQtySold = rangeSales.reduce((s, r) => s + r.quantity, 0)
      + rangeDomSales.reduce((s, r) => s + r.quantity, 0);
    const customerCount = isStaff ? 0 : await prisma.customer.count({ where: { isDeleted: false } });

    // ─── Today KPIs ───
    const todaySales = rangeSales.filter(s => s.createdAt >= today && s.createdAt < tomorrow);
    const todayDomSales = rangeDomSales.filter(s => s.createdAt >= today && s.createdAt < tomorrow);
    const todayRevenue = todaySales.reduce((s, r) => s + Number(r.netTotal ?? 0), 0)
      + todayDomSales.reduce((s, r) => s + Number(r.netTotal ?? 0), 0);

    // ─── Daily trend data ───
    const dailyMap: Record<string, { revenue: number; cost: number; expense: number; collections: number; comSales: number; domSales: number }> = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dailyMap[d.toISOString().split("T")[0]] = { revenue: 0, cost: 0, expense: 0, collections: 0, comSales: 0, domSales: 0 };
    }
    for (const s of rangeSales) {
      const k = s.createdAt.toISOString().split("T")[0];
      if (dailyMap[k]) {
        dailyMap[k].revenue += Number(s.netTotal ?? 0);
        dailyMap[k].cost += s.quantity * Number(s.productCost ?? 0);
        dailyMap[k].comSales++;
      }
    }
    for (const s of rangeDomSales) {
      const k = s.createdAt.toISOString().split("T")[0];
      if (dailyMap[k]) {
        dailyMap[k].revenue += Number(s.netTotal ?? 0);
        dailyMap[k].cost += s.quantity * Number(s.stock?.productCost ?? 0);
        dailyMap[k].domSales++;
      }
    }
    for (const e of rangeExpenses) {
      if (e.date) {
        const k = e.date.toISOString().split("T")[0];
        if (dailyMap[k]) dailyMap[k].expense += Number(e.amount ?? 0);
      }
    }
    for (const c of rangeCollections) {
      const k = c.createdAt.toISOString().split("T")[0];
      if (dailyMap[k]) dailyMap[k].collections += Number(c.amount ?? 0);
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
        productMap[name].revenue += Number(s.netTotal ?? 0);
        productMap[name].qty += s.quantity;
      }
      for (const s of rangeDomSales) {
        const name = s.product?.name || "Unknown";
        if (!productMap[name]) productMap[name] = { name, revenue: 0, qty: 0 };
        productMap[name].revenue += Number(s.netTotal ?? 0);
        productMap[name].qty += s.quantity;
      }
      return Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .map((p, i) => ({ ...p, revenue: Math.round(p.revenue), fill: `var(--color-product${i})` }));
    })();

    // ─── Low stock (admin only) ───
    const lowStock = isStaff ? [] : await (async () => {
      const allStocks = await prisma.stock.findMany({ where: { isDeleted: false }, include: { product: true } });
      return allStocks
        .filter(s => s.quantity < 10)
        .map(s => ({ id: s.id, batchNo: s.batchNo || "", productName: s.product?.name || "", quantity: s.quantity }));
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
      amount: Number(s.netTotal ?? 0),
      date: s.createdAt.toISOString(),
      type: "Commercial" as const,
    }));

    // ─── Commercial Sales Analytics Configuration ───
    // Threshold in days to flag a customer who hasn't returned empty cylinders
    const PENDING_CYLINDER_DAYS_THRESHOLD = 30;
    // Threshold in days to flag a customer who hasn't made any payment
    const PENDING_PAYMENT_DAYS_THRESHOLD = 30;
    // Threshold amount (in ₹) to flag a customer with a high pending balance
    const HIGH_BALANCE_AMOUNT_THRESHOLD = 5000;
    // Maximum number of customers to return in each alert category
    const ALERT_CUSTOMER_LIMIT = 5;

    // ─── Commercial Sales Analytics ───
    const thiryDaysAgo = new Date();
    thiryDaysAgo.setDate(thiryDaysAgo.getDate() - 30);
    const nowMs = new Date().getTime();

    // Fetch slim customer data to calculate balances
    const allCustomers = await prisma.customer.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        phone: true,
        createdAt: true,
        initialCylinderBalance: true,
        initialPendingAmount: true,
        sales: {
          where: { isDeleted: false, saleType: "rent" },
          select: { netTotal: true, createdAt: true }
        },
        collections: {
          where: { isDeleted: false },
          select: { amount: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        },
        rentProducts: {
          where: { isDeleted: false },
          select: { quantity: true }
        },
        rentTransactions: {
          select: { emptyIn: true, createdAt: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    const customerMetrics = allCustomers.map(c => {
      const rentQty = c.rentProducts.reduce((sum, rp) => sum + rp.quantity, 0) + c.initialCylinderBalance;
      const totalSale = c.sales.reduce((sum, s) => sum + Number(s.netTotal ?? 0), 0);
      const totalCollection = c.collections.reduce((sum, col) => sum + Number(col.amount ?? 0), 0);
      const pendingAmount = totalSale - totalCollection + Number(c.initialPendingAmount);

      // Determine the reference date for pending cylinders
      const lastReturnTxn = c.rentTransactions.find(rt => rt.emptyIn > 0);
      const oldestRentTxn = c.rentTransactions[c.rentTransactions.length - 1]; // Ordered desc, so last is oldest
      const referenceReturnDate = lastReturnTxn 
        ? lastReturnTxn.createdAt 
        : (oldestRentTxn ? oldestRentTxn.createdAt : c.createdAt);
      const daysSinceLastReturn = (nowMs - referenceReturnDate.getTime()) / (1000 * 3600 * 24);

      // Determine the reference date for pending payments
      const lastCollection = c.collections[0];
      const oldestSale = c.sales.length > 0 
        ? c.sales.reduce((oldest, s) => s.createdAt < oldest.createdAt ? s : oldest, c.sales[0])
        : null;
      const referencePaymentDate = lastCollection 
        ? lastCollection.createdAt 
        : (oldestSale ? oldestSale.createdAt : c.createdAt);
      const daysSinceLastPayment = (nowMs - referencePaymentDate.getTime()) / (1000 * 3600 * 24);

      return {
        id: c.id,
        name: c.name || "Unknown",
        phone: c.phone || "N/A",
        rentQty,
        pendingAmount: Math.round(pendingAmount),
        daysSinceLastReturn: Math.round(daysSinceLastReturn),
        daysSinceLastPayment: Math.round(daysSinceLastPayment),
      };
    });

    const pendingCylindersLong = customerMetrics
      .filter(c => c.rentQty > 0 && c.daysSinceLastReturn > PENDING_CYLINDER_DAYS_THRESHOLD)
      .sort((a, b) => b.rentQty - a.rentQty)
      .slice(0, ALERT_CUSTOMER_LIMIT);

    const pendingPaymentLong = customerMetrics
      .filter(c => c.pendingAmount > 0 && c.daysSinceLastPayment > PENDING_PAYMENT_DAYS_THRESHOLD)
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
      .slice(0, ALERT_CUSTOMER_LIMIT);

    const highBalanceCustomers = customerMetrics
      .filter(c => c.pendingAmount > HIGH_BALANCE_AMOUNT_THRESHOLD)
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
      .slice(0, ALERT_CUSTOMER_LIMIT);

    const commercialAnalytics = {
      pendingCylindersLong,
      pendingPaymentLong,
      highBalanceCustomers
    };

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
      commercialAnalytics,
    });
  });
}
