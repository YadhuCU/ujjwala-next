import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { LedgerEntryType } from "@/generated/client";
import type { DashboardQuery } from "./dashboard.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

// A batch at or below this many cylinders is worth flagging on the dashboard.
const LOW_STOCK_THRESHOLD = 10;

// Customers holding cylinders / owing money for longer than this are "long
// pending" — the two alert lists on the dashboard.
const LONG_PENDING_DAYS = 30;

const RECENT_TXN_COUNT = 10;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

// =============================================================================
// INTERNAL TYPES
// =============================================================================

export type DashboardActor = { userId: number; roles: string[] };

type DailyBucket = {
  date: string;
  revenue: number;
  cost: number;
  expense: number;
  profit: number;
  collections: number;
  domSales: number;
  arbSales: number;
  newComSales: number;
};

// =============================================================================
// PURE HELPERS
// =============================================================================

function isOwner(actor: DashboardActor): boolean {
  return actor.roles.includes(ROLES.OWNER);
}

function dayKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysSince(date: Date | null | undefined): number {
  if (!date) return 0;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function resolveRange(query: DashboardQuery) {
  const endDate = query.to ? new Date(query.to) : new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = query.from ? new Date(query.from) : new Date(endDate);
  if (!query.from) startDate.setDate(startDate.getDate() - 29);
  startDate.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return { startDate, endDate, todayStart };
}

// One bucket per day in the range, so the chart has no gaps.
function emptyTrend(startDate: Date, endDate: Date): Map<string, DailyBucket> {
  const buckets = new Map<string, DailyBucket>();

  for (
    const cursor = new Date(startDate);
    cursor <= endDate;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    buckets.set(dayKey(cursor), {
      date: dayKey(cursor),
      revenue: 0,
      cost: 0,
      expense: 0,
      profit: 0,
      collections: 0,
      domSales: 0,
      arbSales: 0,
      newComSales: 0,
    });
  }

  return buckets;
}

// =============================================================================
// SUMMARY
// =============================================================================

export async function getDashboard(
  query: DashboardQuery,
  actor: DashboardActor,
) {
  const { startDate, endDate, todayStart } = resolveRange(query);
  const range = { gte: startDate, lte: endDate };

  // Staff see only what they recorded themselves
  const scope = isOwner(actor) ? {} : { createdById: actor.userId };
  const saleWhere = { isDeleted: false, createdAt: range, ...scope };

  const saleInclude = {
    customer: { select: { name: true } },
    items: {
      include: {
        product: { select: { id: true, name: true } },
        stock: { select: { productCost: true } },
      },
    },
  } as const;

  const [
    domSales,
    arbSales,
    comSales,
    expenses,
    payments,
    customerCount,
    lowStock,
    cylinderLedgers,
    balances,
  ] = await Promise.all([
    prisma.domSale.findMany({ where: saleWhere, include: saleInclude }),
    prisma.arbSale.findMany({ where: saleWhere, include: saleInclude }),
    prisma.commercialSale.findMany({ where: saleWhere, include: saleInclude }),
    prisma.expense.findMany({
      where: { isDeleted: false, date: range, ...scope },
      select: { amount: true, date: true },
    }),
    // Collections = every credit on the money ledger, invoice-linked or not
    prisma.customerPaymentLedger.findMany({
      where: { entryType: LedgerEntryType.PAYMENT, createdAt: range },
      select: { amount: true, createdAt: true },
    }),
    prisma.customer.count({ where: { isDeleted: false } }),
    prisma.stock.findMany({
      where: { isDeleted: false, quantity: { lte: LOW_STOCK_THRESHOLD } },
      include: { product: { select: { name: true } } },
      orderBy: { quantity: "asc" },
      take: 10,
    }),
    prisma.customerCylinderLedger.findMany({
      where: { pendingCylinder: { gt: 0 } },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    }),
    prisma.customerBalance.findMany({
      where: { pendingAmount: { gt: 0 } },
      include: { customer: { select: { id: true, name: true, phone: true } } },
      orderBy: { pendingAmount: "desc" },
    }),
  ]);

  // ─── Trend + KPIs ──────────────────────────────────────────────────────────

  const trend = emptyTrend(startDate, endDate);
  const productTotals = new Map<
    number,
    { name: string; revenue: number; qty: number }
  >();

  let totalRevenue = 0;
  let totalCost = 0;
  let totalQtySold = 0;
  let todayRevenue = 0;

  const accumulateSales = (
    sales: {
      createdAt: Date;
      totalAmount: { toNumber(): number } | null;
      items: {
        quantity: number;
        product: { id: number; name: string } | null;
        stock: { productCost: { toNumber(): number } | null } | null;
      }[];
    }[],
    counterKey: "domSales" | "arbSales" | "newComSales",
  ) => {
    for (const sale of sales) {
      const revenue = Number(sale.totalAmount ?? 0);
      const bucket = trend.get(dayKey(sale.createdAt));

      totalRevenue += revenue;
      if (sale.createdAt >= todayStart) todayRevenue += revenue;

      if (bucket) {
        bucket.revenue += revenue;
        bucket[counterKey] += 1;
      }

      for (const item of sale.items) {
        // Cost of goods sold comes from the batch the line drew from
        const cost = Number(item.stock?.productCost ?? 0) * item.quantity;
        totalCost += cost;
        totalQtySold += item.quantity;
        if (bucket) bucket.cost += cost;

        if (!item.product) continue;

        const entry = productTotals.get(item.product.id) ?? {
          name: item.product.name,
          revenue: 0,
          qty: 0,
        };
        entry.qty += item.quantity;
        productTotals.set(item.product.id, entry);
      }

      // Attribute invoice revenue to products by quantity share
      const saleQty = sale.items.reduce((sum, i) => sum + i.quantity, 0);
      if (saleQty > 0) {
        for (const item of sale.items) {
          if (!item.product) continue;
          const entry = productTotals.get(item.product.id)!;
          entry.revenue += (revenue * item.quantity) / saleQty;
        }
      }
    }
  };

  accumulateSales(domSales, "domSales");
  accumulateSales(arbSales, "arbSales");
  accumulateSales(comSales, "newComSales");

  let totalExpenses = 0;
  for (const expense of expenses) {
    const amount = Number(expense.amount ?? 0);
    totalExpenses += amount;
    const bucket = expense.date ? trend.get(dayKey(expense.date)) : undefined;
    if (bucket) bucket.expense += amount;
  }

  let totalCollections = 0;
  for (const payment of payments) {
    // PAYMENT rows are negative on the ledger — collections are their magnitude
    const amount = Math.abs(Number(payment.amount));
    totalCollections += amount;
    const bucket = trend.get(dayKey(payment.createdAt));
    if (bucket) bucket.collections += amount;
  }

  const dailyTrend = [...trend.values()].map((bucket) => ({
    ...bucket,
    revenue: round2(bucket.revenue),
    cost: round2(bucket.cost),
    expense: round2(bucket.expense),
    collections: round2(bucket.collections),
    profit: round2(bucket.revenue - bucket.cost - bucket.expense),
  }));

  // ─── Product breakdown ─────────────────────────────────────────────────────

  const productBreakdown = [...productTotals.values()]
    .map((entry) => ({
      name: entry.name,
      revenue: round2(entry.revenue),
      qty: entry.qty,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .map((entry, index) => ({
      ...entry,
      fill: CHART_COLORS[index % CHART_COLORS.length],
    }));

  // ─── Recent transactions ───────────────────────────────────────────────────

  const recentTxns = [
    ...domSales.map((s) => ({ sale: s, type: "Domestic" })),
    ...arbSales.map((s) => ({ sale: s, type: "ARB" })),
    ...comSales.map((s) => ({ sale: s, type: "Commercial" })),
  ]
    .sort(
      (a, b) => b.sale.createdAt.getTime() - a.sale.createdAt.getTime(),
    )
    .slice(0, RECENT_TXN_COUNT)
    .map(({ sale, type }) => ({
      id: sale.id,
      trNo: sale.trNo,
      customer: sale.customer?.name ?? "—",
      product: sale.items
        .map((i) => i.product?.name)
        .filter(Boolean)
        .join(", "),
      amount: round2(Number(sale.totalAmount ?? 0)),
      date: sale.createdAt.toISOString(),
      type,
    }));

  // ─── Commercial alerts ─────────────────────────────────────────────────────

  // How long each customer's cylinders have been out: the newest rent line they
  // have, since a return updates that row.
  const custodyCustomerIds = [
    ...new Set(cylinderLedgers.map((l) => l.customerId)),
  ];

  const lastRentActivity = await prisma.commercialSaleItem.groupBy({
    by: ["commercialSaleId"],
    where: {
      commercialSale: {
        isDeleted: false,
        customerId: { in: custodyCustomerIds },
      },
    },
    _max: { updatedAt: true },
  });

  const saleOwners = await prisma.commercialSale.findMany({
    where: { id: { in: lastRentActivity.map((r) => r.commercialSaleId) } },
    select: { id: true, customerId: true },
  });

  const lastActivityByCustomer = new Map<number, Date>();
  for (const row of lastRentActivity) {
    const customerId = saleOwners.find(
      (s) => s.id === row.commercialSaleId,
    )?.customerId;
    if (!customerId || !row._max.updatedAt) continue;

    const current = lastActivityByCustomer.get(customerId);
    if (!current || row._max.updatedAt > current)
      lastActivityByCustomer.set(customerId, row._max.updatedAt);
  }

  const cylindersByCustomer = new Map<
    number,
    { id: number; name: string; phone: string; rentQty: number }
  >();

  for (const ledger of cylinderLedgers) {
    const entry = cylindersByCustomer.get(ledger.customerId) ?? {
      id: ledger.customerId,
      name: ledger.customer.name,
      phone: ledger.customer.phone ?? "",
      rentQty: 0,
    };
    entry.rentQty += ledger.pendingCylinder;
    cylindersByCustomer.set(ledger.customerId, entry);
  }

  const pendingCylindersLong = [...cylindersByCustomer.values()]
    .map((entry) => ({
      ...entry,
      daysSinceLastReturn: daysSince(lastActivityByCustomer.get(entry.id)),
    }))
    .filter((entry) => entry.daysSinceLastReturn >= LONG_PENDING_DAYS)
    .sort((a, b) => b.daysSinceLastReturn - a.daysSinceLastReturn);

  // Last payment per customer, for the money-side alerts
  const lastPayments = await prisma.customerPaymentLedger.groupBy({
    by: ["customerId"],
    where: {
      entryType: LedgerEntryType.PAYMENT,
      customerId: { in: balances.map((b) => b.customerId) },
    },
    _max: { createdAt: true },
  });

  const lastPaymentByCustomer = new Map(
    lastPayments.map((p) => [p.customerId, p._max.createdAt]),
  );

  const balanceRows = balances.map((balance) => ({
    id: balance.customerId,
    name: balance.customer.name,
    phone: balance.customer.phone ?? "",
    pendingAmount: round2(Number(balance.pendingAmount)),
    daysSinceLastPayment: daysSince(
      lastPaymentByCustomer.get(balance.customerId),
    ),
  }));

  return {
    role: isOwner(actor) ? ROLES.OWNER : (actor.roles[0] ?? ""),
    kpis: {
      totalRevenue: round2(totalRevenue),
      totalProfit: round2(totalRevenue - totalCost - totalExpenses),
      totalExpenses: round2(totalExpenses),
      totalCollections: round2(totalCollections),
      totalQtySold,
      customerCount,
      todayRevenue: round2(todayRevenue),
      domSaleCount: domSales.length,
      arbSaleCount: arbSales.length,
      newComSaleCount: comSales.length,
    },
    dailyTrend,
    productBreakdown,
    lowStock: lowStock.map((stock) => ({
      id: stock.id,
      batchNo: stock.batchNo,
      productName: stock.product?.name ?? "—",
      quantity: stock.quantity,
    })),
    recentTxns,
    commercialAnalytics: {
      pendingCylindersLong,
      pendingPaymentLong: balanceRows.filter(
        (row) => row.daysSinceLastPayment >= LONG_PENDING_DAYS,
      ),
      highBalanceCustomers: balanceRows.slice(0, 5),
    },
  };
}

export type DashboardResponse = Awaited<ReturnType<typeof getDashboard>>;
