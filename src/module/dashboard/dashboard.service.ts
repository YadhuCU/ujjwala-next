import { prisma } from "@/lib/prisma";
import { businessDayKey } from "@/lib/business-day";
import { PERMISSIONS, SCOPES, type Permission } from "@/lib/permissions";
import { resolveScope, scopeFilter, type Actor } from "@/lib/access-scope";
import { LedgerEntryType, ProductType } from "@/generated/client";
import { getGodownStatus } from "@/module/godown/godown.service";
import type {
  DashboardAlertsQuery,
  DashboardQuery,
} from "./dashboard.payload.schema";
import {
  bucketKeyOf,
  resolvePeriod,
  type DashboardView,
} from "./dashboard.period";

// =============================================================================
// CONSTANTS
// =============================================================================

// A batch at or below this many cylinders is worth flagging on the dashboard.
const LOW_STOCK_THRESHOLD = 10;

// Customers holding cylinders / owing money for longer than this are "long
// pending" — the two alert lists. The viewer can change either; this is where
// they start.
const DEFAULT_PENDING_DAYS = 30;

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

// Whether the figures cover the whole agency or only this user's own records
// is a granted permission, as is whether money totals are shown at all.
export type DashboardActor = Actor;

type TrendBucket = {
  /** `yyyy-mm-dd`, `yyyy-mm` or `yyyy`, depending on the view. */
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

type SaleForTotals = {
  createdAt: Date;
  totalAmount: { toNumber(): number } | null;
  items: {
    quantity: number;
    product: { id: number; name: string } | null;
    stock: { productCost: { toNumber(): number } | null } | null;
  }[];
};

// =============================================================================
// PURE HELPERS
// =============================================================================

// Which bucket a row belongs to — its India day (not the server's: see
// business-day.ts for why that matters on Vercel), cut down to the view.
function bucketOf(view: DashboardView, date: Date): string {
  return bucketKeyOf(view, businessDayKey(date));
}

/** Whether the actor may see a dashboard card. A system role sees them all. */
function canSee(actor: DashboardActor, permission: Permission): boolean {
  return actor.isOwner === true || actor.permissions.includes(permission);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysSince(date: Date | null | undefined): number {
  if (!date) return 0;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// One bucket per day, month or year in the period, so the chart has no gaps.
function emptyTrend(keys: string[]): Map<string, TrendBucket> {
  const buckets = new Map<string, TrendBucket>();

  for (const key of keys) {
    buckets.set(key, {
      date: key,
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
// Everything that follows the picked period: headline figures, the two trend
// charts, revenue by product — plus low stock, which does not.
// =============================================================================

export async function getDashboard(
  query: DashboardQuery,
  actor: DashboardActor,
) {
  const period = resolvePeriod(query.view ?? "month", query.from, query.to);
  const { view, startDate, endDate, currentKey } = period;
  const range = { gte: startDate, lte: endDate };

  // Each card is its own grant, and its data is only gathered for a holder.
  const canSeeFinancials = canSee(actor, PERMISSIONS.DASHBOARD_FINANCIALS);
  const cards = {
    cylinderPosition: canSee(actor, PERMISSIONS.DASHBOARD_CYLINDER_POSITION),
    kpis: canSee(actor, PERMISSIONS.DASHBOARD_KPIS),
    revenueTrend: canSee(actor, PERMISSIONS.DASHBOARD_REVENUE_TREND),
    salesByType: canSee(actor, PERMISSIONS.DASHBOARD_SALES_BY_TYPE),
    // Nothing but money, so it needs the money grant as well
    productBreakdown:
      canSee(actor, PERMISSIONS.DASHBOARD_PRODUCT_BREAKDOWN) && canSeeFinancials,
    lowStock: canSee(actor, PERMISSIONS.DASHBOARD_LOW_STOCK),
    commercialAlerts: canSee(actor, PERMISSIONS.DASHBOARD_COMMERCIAL_ALERTS),
  };
  const needsSales =
    cards.kpis ||
    cards.revenueTrend ||
    cards.salesByType ||
    cards.productBreakdown;

  // "all" adds nothing; "own" narrows to this user; "none" throws.
  const accessScope = resolveScope(actor, SCOPES.DASHBOARD);
  const scope = scopeFilter(actor, accessScope);
  const saleWhere = { isDeleted: false, createdAt: range, ...scope };
  // A domestic sale is the field staff member's round, whoever entered it
  const domSaleWhere = {
    isDeleted: false,
    createdAt: range,
    ...scopeFilter(actor, accessScope, "fieldStaffId"),
  };

  const saleInclude = {
    customer: { select: { name: true } },
    items: {
      include: {
        product: { select: { id: true, name: true } },
        stock: { select: { productCost: true } },
      },
    },
  } as const;

  // A card the actor cannot see costs no query
  const [
    domSales,
    arbSales,
    comSales,
    expenses,
    payments,
    customerCount,
    lowStock,
  ] = await Promise.all([
    needsSales
      ? prisma.domSale.findMany({ where: domSaleWhere, include: saleInclude })
      : [],
    needsSales
      ? prisma.arbSale.findMany({ where: saleWhere, include: saleInclude })
      : [],
    needsSales
      ? prisma.commercialSale.findMany({
          where: saleWhere,
          include: saleInclude,
        })
      : [],
    needsSales
      ? prisma.expense.findMany({
          where: { isDeleted: false, date: range, ...scope },
          select: { amount: true, date: true },
        })
      : [],
    // Collections = every credit on the money ledger, invoice-linked or not.
    // Scoped like the sales above: staff see what they collected, not the
    // agency's whole intake.
    needsSales
      ? prisma.customerPaymentLedger.findMany({
          where: {
            entryType: LedgerEntryType.PAYMENT,
            createdAt: range,
            ...scope,
          },
          select: { amount: true, createdAt: true },
        })
      : [],
    prisma.customer.count({ where: { isDeleted: false } }),
    cards.lowStock
      ? prisma.stock.findMany({
          where: { isDeleted: false, quantity: { lte: LOW_STOCK_THRESHOLD } },
          include: { product: { select: { name: true } } },
          orderBy: { quantity: "asc" },
          take: 10,
        })
      : [],
  ]);

  // ─── Trend + KPIs ──────────────────────────────────────────────────────────

  const trend = emptyTrend(period.buckets);
  const productTotals = new Map<
    number,
    { name: string; revenue: number; qty: number }
  >();

  let totalRevenue = 0;
  let totalCost = 0;
  let totalQtySold = 0;
  // Revenue in the bucket holding today: today, this month or this year
  let currentRevenue = 0;

  const accumulateSales = (
    sales: SaleForTotals[],
    counterKey: "domSales" | "arbSales" | "newComSales",
  ) => {
    for (const sale of sales) {
      const revenue = Number(sale.totalAmount ?? 0);
      const key = bucketOf(view, sale.createdAt);
      const bucket = trend.get(key);

      totalRevenue += revenue;
      if (key === currentKey) currentRevenue += revenue;

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
    const bucket = expense.date
      ? trend.get(bucketOf(view, expense.date))
      : undefined;
    if (bucket) bucket.expense += amount;
  }

  let totalCollections = 0;
  for (const payment of payments) {
    // PAYMENT rows are negative on the ledger — collections are their magnitude
    const amount = Math.abs(Number(payment.amount));
    totalCollections += amount;
    const bucket = trend.get(bucketOf(view, payment.createdAt));
    if (bucket) bucket.collections += amount;
  }

  // A domestic round is paid in full at the door and has no customer, so its
  // cash never reaches the money ledger above. Older domestic sales were
  // charged to a customer and their payments are already counted there.
  for (const sale of domSales) {
    if (sale.customerId) continue;
    const amount = Number(sale.paidAmount ?? 0);
    totalCollections += amount;
    const bucket = trend.get(bucketOf(view, sale.createdAt));
    if (bucket) bucket.collections += amount;
  }

  const trendRows = [...trend.values()].map((bucket) => ({
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

  return {
    period: {
      view,
      from: period.from,
      to: period.to,
      currentLabel: period.currentLabel,
    },
    cards,
    // The client used to receive a role name and compare it to "OWNER".
    // These two flags say what it actually needs to know.
    scope: accessScope,
    canSeeFinancials,
    kpis: {
      totalRevenue: round2(totalRevenue),
      totalProfit: round2(totalRevenue - totalCost - totalExpenses),
      totalExpenses: round2(totalExpenses),
      totalCollections: round2(totalCollections),
      totalQtySold,
      customerCount,
      currentRevenue: round2(currentRevenue),
      domSaleCount: domSales.length,
      arbSaleCount: arbSales.length,
      newComSaleCount: comSales.length,
    },
    trend: cards.revenueTrend || cards.salesByType ? trendRows : [],
    productBreakdown: cards.productBreakdown ? productBreakdown : [],
    lowStock: lowStock.map((stock) => ({
      id: stock.id,
      batchNo: stock.batchNo,
      productName: stock.product?.name ?? "—",
      quantity: stock.quantity,
    })),
  };
}

export type DashboardResponse = Awaited<ReturnType<typeof getDashboard>>;

// =============================================================================
// CYLINDER POSITION
// Commercial cylinders only: those are the ones the agency rents out and has
// to get back. Agency-wide, like the godown itself — who is asking does not
// change what it holds. Served here rather than from /api/godown so the card
// can be granted without the whole godown page.
// =============================================================================

export async function getCylinderPosition() {
  const { rows } = await getGodownStatus();
  const commercial = rows.filter(
    (row) => row.productType === ProductType.COMMERCIAL,
  );

  const totals = commercial.reduce(
    (acc, row) => ({
      filledQty: acc.filledQty + row.filledQty,
      emptyQty: acc.emptyQty + row.emptyQty,
      withCustomers: acc.withCustomers + row.withCustomers,
      outOfSync: acc.outOfSync + (row.inSync ? 0 : 1),
    }),
    { filledQty: 0, emptyQty: 0, withCustomers: 0, outOfSync: 0 },
  );

  return {
    rows: commercial.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      filledQty: row.filledQty,
      emptyQty: row.emptyQty,
      withCustomers: row.withCustomers,
    })),
    totals,
  };
}

export type CylinderPositionResponse = Awaited<
  ReturnType<typeof getCylinderPosition>
>;

// =============================================================================
// COMMERCIAL ALERTS
// Agency-wide customer lists. How long counts as "too long" is the viewer's
// call, separately for cylinders and for money.
// =============================================================================

export async function getCommercialAlerts(query: DashboardAlertsQuery = {}) {
  const cylinderDays = Number(query.cylinderDays ?? DEFAULT_PENDING_DAYS);
  const paymentDays = Number(query.paymentDays ?? DEFAULT_PENDING_DAYS);

  const [cylinderLedgers, balances] = await Promise.all([
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

  // How long each customer's cylinders have gone without a return.
  const custodyCustomerIds = [
    ...new Set(cylinderLedgers.map((l) => l.customerId)),
  ];
  const { lastReturn, custodySince } =
    await custodyTimelines(custodyCustomerIds);

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

  // Since the last return; a customer who has never returned one is timed
  // from when they first held cylinders. Counting "never" as 0 days hid
  // exactly the customers who have held them longest.
  const pendingCylindersLong = [...cylindersByCustomer.values()]
    .map((entry) => {
      const returnedAt = lastReturn.get(entry.id);
      return {
        ...entry,
        neverReturned: !returnedAt,
        daysSinceLastReturn: daysSince(returnedAt ?? custodySince.get(entry.id)),
      };
    })
    .filter((entry) => entry.daysSinceLastReturn >= cylinderDays)
    .sort((a, b) => b.daysSinceLastReturn - a.daysSinceLastReturn);

  // How long each balance has gone unpaid: since the customer's last payment
  // that still stands (a reversed one never happened), or — for a customer
  // who has never paid — since the first charge that started the debt.
  // Counting "no payment" as 0 days hid exactly the customers who owe longest.
  const balanceCustomerIds = balances.map((b) => b.customerId);
  const [lastPayments, firstCharges] = await Promise.all([
    prisma.customerPaymentLedger.groupBy({
      by: ["customerId"],
      where: {
        entryType: LedgerEntryType.PAYMENT,
        customerId: { in: balanceCustomerIds },
        voidedBy: { none: {} },
      },
      _max: { createdAt: true },
    }),
    prisma.customerPaymentLedger.groupBy({
      by: ["customerId"],
      where: {
        customerId: { in: balanceCustomerIds },
        amount: { gt: 0 },
      },
      _min: { createdAt: true },
    }),
  ]);

  const lastPaymentByCustomer = new Map(
    lastPayments.map((p) => [p.customerId, p._max.createdAt]),
  );
  const firstChargeByCustomer = new Map(
    firstCharges.map((c) => [c.customerId, c._min.createdAt]),
  );

  const balanceRows = balances.map((balance) => {
    const lastPayment = lastPaymentByCustomer.get(balance.customerId);
    return {
      id: balance.customerId,
      name: balance.customer.name,
      phone: balance.customer.phone ?? "",
      pendingAmount: round2(Number(balance.pendingAmount)),
      neverPaid: !lastPayment,
      daysSinceLastPayment: daysSince(
        lastPayment ?? firstChargeByCustomer.get(balance.customerId),
      ),
    };
  });

  return {
    cylinderDays,
    paymentDays,
    pendingCylindersLong,
    // Biggest balance first, like the list below it
    pendingPaymentLong: balanceRows.filter(
      (row) => row.daysSinceLastPayment >= paymentDays,
    ),
    highBalanceCustomers: balanceRows.slice(0, 5),
  };
}

/**
 * Per customer: when they last returned a cylinder, and when they first held
 * one. Read from the documents, not the cylinder ledger — its `refId` is
 * shared by dom, ARB and commercial invoices, so it cannot be tied to a
 * customer on its own.
 *
 * Returns: a collection recorded on any invoice (`CommercialSaleReturn`), a
 * return against one line (`PATCH …/return` bumps the line's
 * `cylindersReturned`, so its `updatedAt` is that moment), and empties
 * collected on a domestic sale from before 2026-11-02, when those still had a
 * customer. Custody began at the opening holding, or the first rental.
 */
async function custodyTimelines(customerIds: number[]) {
  const lastReturn = new Map<number, Date>();
  const custodySince = new Map<number, Date>();
  if (customerIds.length === 0) return { lastReturn, custodySince };

  const latest = (map: Map<number, Date>, id: number | null, at: Date) => {
    if (id == null) return;
    const current = map.get(id);
    if (!current || at > current) map.set(id, at);
  };
  const earliest = (map: Map<number, Date>, id: number | null, at: Date) => {
    if (id == null) return;
    const current = map.get(id);
    if (!current || at < current) map.set(id, at);
  };

  const live = { isDeleted: false, customerId: { in: customerIds } };
  const [collections, lineReturns, domReturns, openings, rentals, domRentals] =
    await Promise.all([
      prisma.commercialSaleReturn.findMany({
        where: { commercialSale: live },
        select: { createdAt: true, commercialSale: { select: { customerId: true } } },
      }),
      prisma.commercialSaleItem.findMany({
        where: { cylindersReturned: { gt: 0 }, commercialSale: live },
        select: { updatedAt: true, commercialSale: { select: { customerId: true } } },
      }),
      prisma.domSale.findMany({
        where: { ...live, items: { some: { emptiesCollected: { gt: 0 } } } },
        select: { createdAt: true, customerId: true },
      }),
      prisma.customerInitialCylinderBalance.findMany({
        where: { customerId: { in: customerIds }, qty: { gt: 0 } },
        select: { createdAt: true, customerId: true },
      }),
      prisma.commercialSale.findMany({
        where: { ...live, items: { some: { cylindersDispatched: { gt: 0 } } } },
        select: { createdAt: true, customerId: true },
      }),
      prisma.domSale.findMany({
        where: { ...live, items: { some: { cylindersDispatched: { gt: 0 } } } },
        select: { createdAt: true, customerId: true },
      }),
    ]);

  for (const r of collections) latest(lastReturn, r.commercialSale.customerId, r.createdAt);
  for (const r of lineReturns) latest(lastReturn, r.commercialSale.customerId, r.updatedAt);
  for (const r of domReturns) latest(lastReturn, r.customerId, r.createdAt);
  for (const r of [...openings, ...rentals, ...domRentals])
    earliest(custodySince, r.customerId, r.createdAt);

  return { lastReturn, custodySince };
}

export type CommercialAlertsResponse = Awaited<
  ReturnType<typeof getCommercialAlerts>
>;
