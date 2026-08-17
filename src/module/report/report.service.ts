import { prisma } from "@/lib/prisma";
import { BadRequestError } from "@/lib/errors";
import { SCOPES } from "@/lib/permissions";
import { resolveScope, scopeFilter, type Actor } from "@/lib/access-scope";
import { CommercialSaleType } from "@/generated/client";
import type {
  ExpenseReportQuery,
  PurchaseReportQuery,
  SaleByProductQuery,
  SaleReportQuery,
} from "./report.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const saleInclude = {
  customer: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { name: true } },
      stock: { select: { batchNo: true } },
    },
  },
} as const;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

// Whether a user reports on the whole agency or only their own paperwork is a
// granted permission (report.read.all vs report.read.own). Agency-wide sight
// also unlocks narrowing to a single staff member.
export type ReportActor = Actor;

type SaleHeader = {
  totalAmount: { toNumber(): number } | null;
  discount: { toNumber(): number } | null;
};

// =============================================================================
// PURE HELPERS
// =============================================================================

// The UI sends plain dates — the end date has to cover the whole day.
function assertAndNormalizeRange(from: Date, to: Date) {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  if (fromDate > toDate)
    throw new BadRequestError("from date must not be after to date");

  return { fromDate, toDate };
}

function authorFilter(actor: ReportActor, staffId?: number) {
  const scope = resolveScope(actor, SCOPES.REPORT);

  // Own-scope users are pinned to their own rows; a staffId they send by hand
  // is ignored rather than honoured. "none" must not fall through to {}, which
  // would read as agency-wide.
  if (scope !== "all") return scopeFilter(actor, scope);
  if (staffId) return { createdById: staffId };
  return {};
}

function summarizeSales(sales: SaleHeader[]) {
  let totalSubtotal = 0;
  let totalDiscount = 0;

  for (const sale of sales) {
    totalSubtotal += Number(sale.totalAmount ?? 0);
    totalDiscount += Number(sale.discount ?? 0);
  }

  return {
    invoiceCount: sales.length,
    totalSubtotal: Math.round(totalSubtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    // totalAmount is already net of discount on every sale model
    totalNetTotal: Math.round(totalSubtotal * 100) / 100,
  };
}

function paginate(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// =============================================================================
// SALE REPORTS — dom / arb / commercial share one shape
// =============================================================================

export type SaleReportKind = "DOM" | "ARB" | "COMMERCIAL";

function saleDelegate(kind: SaleReportKind) {
  if (kind === "DOM") return prisma.domSale;
  if (kind === "ARB") return prisma.arbSale;
  return prisma.commercialSale;
}

function buildSaleWhere(query: SaleReportQuery, actor: ReportActor) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);

  return {
    isDeleted: false,
    createdAt: { gte: fromDate, lte: toDate },
    ...authorFilter(actor, query.staffId),
    ...(query.customerId && { customerId: query.customerId }),
  };
}

export async function getSaleReport(
  kind: SaleReportKind,
  query: SaleReportQuery,
  actor: ReportActor,
) {
  const where = buildSaleWhere(query, actor);
  const { page, limit } = query;

  const delegate = saleDelegate(kind);

  const [data, total, all] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (delegate as any).findMany({
      where,
      include: saleInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (delegate as any).count({ where }),
    // Summary covers the whole filtered range, not just the current page
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (delegate as any).findMany({
      where,
      select: { totalAmount: true, discount: true },
    }),
  ]);

  return {
    summary: summarizeSales(all as SaleHeader[]),
    data,
    pagination: paginate(page, limit, total as number),
  };
}

// Every row of a sale report, unpaginated — used by the export routes.
export async function getSaleReportRows(
  kind: SaleReportKind,
  query: SaleReportQuery,
  actor: ReportActor,
) {
  const where = buildSaleWhere(query, actor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (saleDelegate(kind) as any).findMany({
    where,
    include: saleInclude,
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// PURCHASE REPORT
// =============================================================================

function buildPurchaseWhere(query: PurchaseReportQuery, actor: ReportActor) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);

  return {
    isDeleted: false,
    purchaseDate: { gte: fromDate, lte: toDate },
    ...(query.vendorId && { vendorId: query.vendorId }),
    ...authorFilter(actor, query.staffId),
  };
}

const purchaseInclude = {
  vendor: { select: { id: true, name: true } },
  items: { include: { product: { select: { name: true } } } },
} as const;

export async function getPurchaseReport(
  query: PurchaseReportQuery,
  actor: ReportActor,
) {
  const where = buildPurchaseWhere(query, actor);
  const { page, limit } = query;

  const [data, total, aggregate] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: purchaseInclude,
      orderBy: { purchaseDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchase.count({ where }),
    prisma.purchase.aggregate({ where, _sum: { totalCost: true } }),
  ]);

  return {
    summary: {
      invoiceCount: total,
      totalAmount: Number(aggregate._sum.totalCost ?? 0),
    },
    data,
    pagination: paginate(page, limit, total),
  };
}

export async function getPurchaseReportRows(
  query: PurchaseReportQuery,
  actor: ReportActor,
) {
  return prisma.purchase.findMany({
    where: buildPurchaseWhere(query, actor),
    include: purchaseInclude,
    orderBy: { purchaseDate: "desc" },
  });
}

// =============================================================================
// EXPENSE REPORT
// =============================================================================

function buildExpenseWhere(query: ExpenseReportQuery, actor: ReportActor) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);

  return {
    isDeleted: false,
    date: { gte: fromDate, lte: toDate },
    ...authorFilter(actor, query.staffId),
  };
}

const expenseInclude = {
  createdBy: { select: { id: true, name: true } },
} as const;

export async function getExpenseReport(
  query: ExpenseReportQuery,
  actor: ReportActor,
) {
  const where = buildExpenseWhere(query, actor);
  const { page, limit } = query;

  const [data, total, aggregate] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: expenseInclude,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return {
    summary: {
      expenseCount: total,
      totalAmount: Number(aggregate._sum.amount ?? 0),
    },
    data,
    pagination: paginate(page, limit, total),
  };
}

export async function getExpenseReportRows(
  query: ExpenseReportQuery,
  actor: ReportActor,
) {
  return prisma.expense.findMany({
    where: buildExpenseWhere(query, actor),
    include: expenseInclude,
    orderBy: { date: "desc" },
  });
}

// =============================================================================
// SALE BY PRODUCT
// Rolls the three sale models up per product. Line items carry the product, so
// this reads the *Item tables and filters on their parent invoice.
// =============================================================================

type ProductRow = {
  productId: number;
  productName: string;
  totalQuantity: number;
  totalAmount: number;
};

export async function getSaleByProductReport(
  query: SaleByProductQuery,
  actor: ReportActor,
) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);
  const range = { gte: fromDate, lte: toDate };

  // The scope applies to the parent invoice — line items carry no author.
  const author = authorFilter(actor);

  const [domItems, arbItems, comItems] = await Promise.all([
    prisma.domSaleItem.findMany({
      where: { domSale: { isDeleted: false, createdAt: range, ...author } },
      select: {
        quantity: true,
        netTotal: true,
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.arbSaleItem.findMany({
      where: { arbSale: { isDeleted: false, createdAt: range, ...author } },
      select: {
        quantity: true,
        netTotal: true,
        product: { select: { id: true, name: true } },
      },
    }),
    prisma.commercialSaleItem.findMany({
      // Rentals are billed too, so both line types count as sales revenue
      where: {
        commercialSale: { isDeleted: false, createdAt: range, ...author },
      },
      select: {
        quantity: true,
        netTotal: true,
        saleType: true,
        product: { select: { id: true, name: true } },
      },
    }),
  ]);

  const byProduct = new Map<number, ProductRow>();

  const accumulate = (rows: {
    quantity: number;
    netTotal: { toNumber(): number } | null;
    product: { id: number; name: string } | null;
  }[]) => {
    for (const row of rows) {
      if (!row.product) continue;

      const existing = byProduct.get(row.product.id) ?? {
        productId: row.product.id,
        productName: row.product.name,
        totalQuantity: 0,
        totalAmount: 0,
      };

      existing.totalQuantity += row.quantity;
      existing.totalAmount += Number(row.netTotal ?? 0);
      byProduct.set(row.product.id, existing);
    }
  };

  accumulate(domItems);
  accumulate(arbItems);
  accumulate(comItems);

  const data = [...byProduct.values()]
    .map((row) => ({
      ...row,
      totalAmount: Math.round(row.totalAmount * 100) / 100,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);

  const summary = data.reduce(
    (acc, row) => ({
      totalQuantity: acc.totalQuantity + row.totalQuantity,
      totalAmount:
        Math.round((acc.totalAmount + row.totalAmount) * 100) / 100,
    }),
    { totalQuantity: 0, totalAmount: 0 },
  );

  // Rented cylinders are worth calling out separately — they are billed revenue
  // but the cylinders are expected back.
  const rentedQuantity = comItems
    .filter((item) => item.saleType === CommercialSaleType.RENT)
    .reduce((sum, item) => sum + item.quantity, 0);

  return {
    summary: { ...summary, rentedQuantity },
    data,
    pagination: paginate(1, data.length || 1, data.length),
  };
}
