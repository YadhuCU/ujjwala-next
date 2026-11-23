import { prisma } from "@/lib/prisma";
import { endOfBusinessDay, startOfBusinessDay } from "@/lib/business-day";
import { BadRequestError } from "@/lib/errors";
import { SCOPES } from "@/lib/permissions";
import { resolveScope, scopeFilter, type Actor } from "@/lib/access-scope";
import {
  CommercialSaleType,
  LedgerEntryType,
  RefType,
  TxnType,
  type ProductType,
} from "@/generated/client";
import { isCylinderTypeProduct } from "@/module/product/product.rules";
import {
  buildCustomerWiseRows,
  summarizeCustomerWiseRows,
  type CylinderEvent,
  type MoneyEvent,
} from "./report.rollup";
import type {
  ExpenseReportQuery,
  PurchaseReportQuery,
  CustomerWiseQuery,
  ProductWiseQuery,
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

// A domestic sale belongs to the field staff member who made the round
const domSaleInclude = {
  ...saleInclude,
  fieldStaff: { select: { id: true, name: true } },
} as const;

/**
 * Whose a sale is, for scoping and the staff filter. A domestic sale is the
 * field staff member's — the office often enters it for them — so it scopes on
 * that rather than on its author.
 */
function ownerColumn(kind: SaleReportKind) {
  return kind === "DOM" ? "fieldStaffId" : "createdById";
}

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

// The UI sends plain dates — the end date has to cover the whole day, in India
// time rather than the server's (business-day.ts explains why that matters).
function assertAndNormalizeRange(from: Date, to: Date) {
  const fromDate = startOfBusinessDay(new Date(from));
  const toDate = endOfBusinessDay(new Date(to));

  if (fromDate > toDate)
    throw new BadRequestError("from date must not be after to date");

  return { fromDate, toDate };
}

function authorFilter(
  actor: ReportActor,
  staffId?: number,
  column: "createdById" | "fieldStaffId" = "createdById",
) {
  const scope = resolveScope(actor, SCOPES.REPORT);

  // Own-scope users are pinned to their own rows; a staffId they send by hand
  // is ignored rather than honoured. "none" must not fall through to {}, which
  // would read as agency-wide.
  if (scope !== "all") return scopeFilter(actor, scope, column);
  if (staffId) return { [column]: staffId };
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

const round2 = (value: number) => Math.round(value * 100) / 100;

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

function buildSaleWhere(
  kind: SaleReportKind,
  query: SaleReportQuery,
  actor: ReportActor,
) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);

  return {
    isDeleted: false,
    createdAt: { gte: fromDate, lte: toDate },
    ...authorFilter(actor, query.staffId, ownerColumn(kind)),
    // A domestic sale has no customer to filter on
    ...(kind !== "DOM" &&
      query.customerId && { customerId: query.customerId }),
  };
}

function saleIncludeFor(kind: SaleReportKind) {
  return kind === "DOM" ? domSaleInclude : saleInclude;
}

export async function getSaleReport(
  kind: SaleReportKind,
  query: SaleReportQuery,
  actor: ReportActor,
) {
  const where = buildSaleWhere(kind, query, actor);
  const { page, limit } = query;

  const delegate = saleDelegate(kind);

  const [data, total, all] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (delegate as any).findMany({
      where,
      include: saleIncludeFor(kind),
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
  const where = buildSaleWhere(kind, query, actor);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (saleDelegate(kind) as any).findMany({
    where,
    include: saleIncludeFor(kind),
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
// PRODUCT WISE
// Per product: Opening + Purchases − Sales ± Adjustments = Closing, for the
// range. Agency-wide by design — stock is the agency's, not one person's.
//
// Cylinders (domestic, commercial) read the cylinder ledger, which can say how
// many filled cylinders the godown held at any moment: every movement is a
// dated, append-only row, reversals included. ARB and other products have no
// ledger, so their stock is walked back from today's batch quantities through
// the purchases, sales and manual batches recorded since.
// =============================================================================

type ProductStockRow = {
  productId: number;
  productName: string;
  productType: ProductType;
  openingStock: number;
  purchaseQty: number;
  salesQty: number;
  totalAmount: number;
  /** Manual corrections: stock adjustments, or a manually added batch. */
  adjustments: number;
  closingStock: number;
};

type QtyByProduct = Map<number, number>;

const addTo = (map: QtyByProduct, productId: number | null, qty: number) => {
  if (productId === null) return;
  map.set(productId, (map.get(productId) ?? 0) + qty);
};

/** Sale lines by product over a window, across all three sale models. */
async function saleLineTotals(window: { gte?: Date; gt?: Date; lte?: Date }) {
  const parent = { isDeleted: false, createdAt: window };
  const select = { productId: true, quantity: true, netTotal: true } as const;

  const lines = (
    await Promise.all([
      prisma.domSaleItem.findMany({ where: { domSale: parent }, select }),
      prisma.arbSaleItem.findMany({ where: { arbSale: parent }, select }),
      prisma.commercialSaleItem.findMany({
        where: { commercialSale: parent },
        select,
      }),
    ])
  ).flat();

  const qty: QtyByProduct = new Map();
  const amount: QtyByProduct = new Map();
  for (const line of lines) {
    addTo(qty, line.productId, line.quantity);
    addTo(amount, line.productId, Number(line.netTotal ?? 0));
  }
  return { qty, amount };
}

/** Purchased quantities by product, dated by when the purchase was entered. */
async function purchaseTotals(window: { gte?: Date; gt?: Date; lte?: Date }) {
  const rows = await prisma.purchaseItem.groupBy({
    by: ["productId"],
    where: { purchase: { isDeleted: false, createdAt: window } },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

/**
 * Manually added batches (opening stock — no purchase behind them) by product,
 * at the quantity they started with: what is left plus what has been sold from
 * them. Only ARB and other products need this; a cylinder batch posts a stock
 * adjustment to the ledger instead.
 */
async function manualBatchTotals(window: { gte?: Date; gt?: Date; lte?: Date }) {
  const batches = await prisma.stock.findMany({
    where: { purchaseId: null, isDeleted: false, createdAt: window },
    select: {
      productId: true,
      quantity: true,
      domSaleItems: {
        where: { domSale: { isDeleted: false } },
        select: { quantity: true },
      },
      arbSaleItems: {
        where: { arbSale: { isDeleted: false } },
        select: { quantity: true },
      },
      commercialSaleItems: {
        where: { commercialSale: { isDeleted: false } },
        select: { quantity: true },
      },
    },
  });

  const totals: QtyByProduct = new Map();
  for (const batch of batches) {
    const sold = [
      ...batch.domSaleItems,
      ...batch.arbSaleItems,
      ...batch.commercialSaleItems,
    ].reduce((sum, line) => sum + line.quantity, 0);
    addTo(totals, batch.productId, batch.quantity + sold);
  }
  return totals;
}

export async function getProductWiseReport(query: ProductWiseQuery) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);
  const inRange = { gte: fromDate, lte: toDate };
  const afterRange = { gt: toDate };

  const [
    products,
    ledgerBefore,
    ledgerInRange,
    batchesNow,
    salesInRange,
    salesAfter,
    purchasesInRange,
    purchasesAfter,
    manualInRange,
    manualAfter,
  ] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, name: true, type: true, isDeleted: true },
    }),
    prisma.cylinderTransaction.groupBy({
      by: ["productId"],
      where: { createdAt: { lt: fromDate } },
      _sum: { filledDelta: true },
    }),
    prisma.cylinderTransaction.groupBy({
      by: ["productId", "txnType"],
      where: { createdAt: inRange },
      _sum: { filledDelta: true },
    }),
    prisma.stock.groupBy({
      by: ["productId"],
      where: { isDeleted: false },
      _sum: { quantity: true },
    }),
    saleLineTotals(inRange),
    saleLineTotals(afterRange),
    purchaseTotals(inRange),
    purchaseTotals(afterRange),
    manualBatchTotals(inRange),
    manualBatchTotals(afterRange),
  ]);

  const openingFilled = new Map(
    ledgerBefore.map((r) => [r.productId, r._sum.filledDelta ?? 0]),
  );
  const ledgerMoves = (productId: number, types: TxnType[]) =>
    ledgerInRange
      .filter((r) => r.productId === productId && types.includes(r.txnType))
      .reduce((sum, r) => sum + (r._sum.filledDelta ?? 0), 0);
  const batchQty = new Map(
    batchesNow.map((r) => [r.productId, r._sum.quantity ?? 0]),
  );

  const data: ProductStockRow[] = products
    .map((product) => {
      const id = product.id;
      const totalAmount = round2(salesInRange.amount.get(id) ?? 0);

      if (isCylinderTypeProduct(product.type)) {
        // Reversal rows carry their original type with the sign flipped, so a
        // sale voided inside the range nets to nothing here.
        const openingStock = openingFilled.get(id) ?? 0;
        const purchaseQty = ledgerMoves(id, [
          TxnType.PURCHASE_FULL,
          TxnType.PURCHASE_FILL,
        ]);
        // `0 -`, not unary minus: −0 would print as "-0" in the export
        const salesQty =
          0 -
          ledgerMoves(id, [
            TxnType.SALE_OUT,
            TxnType.RENT_DELIVERY,
            TxnType.REFILL,
          ]);
        const adjustments = ledgerMoves(id, [TxnType.ADJUSTMENT]);
        return {
          productId: id,
          productName: product.name,
          productType: product.type,
          openingStock,
          purchaseQty,
          salesQty,
          totalAmount,
          adjustments,
          closingStock: openingStock + purchaseQty - salesQty + adjustments,
        };
      }

      // Walk today's batches back to the end of the range, then to its start
      const closingStock =
        (batchQty.get(id) ?? 0) -
        (purchasesAfter.get(id) ?? 0) +
        (salesAfter.qty.get(id) ?? 0) -
        (manualAfter.get(id) ?? 0);
      const purchaseQty = purchasesInRange.get(id) ?? 0;
      const salesQty = salesInRange.qty.get(id) ?? 0;
      const adjustments = manualInRange.get(id) ?? 0;
      return {
        productId: id,
        productName: product.name,
        productType: product.type,
        openingStock: closingStock - purchaseQty + salesQty - adjustments,
        purchaseQty,
        salesQty,
        totalAmount,
        adjustments,
        closingStock,
      };
    })
    // A deleted product only appears while it still has something to report
    .filter((row) => {
      const product = products.find((p) => p.id === row.productId)!;
      const active =
        row.openingStock !== 0 ||
        row.purchaseQty !== 0 ||
        row.salesQty !== 0 ||
        row.adjustments !== 0 ||
        row.closingStock !== 0 ||
        row.totalAmount !== 0;
      return !product.isDeleted || active;
    })
    .sort(
      (a, b) =>
        a.productType.localeCompare(b.productType) ||
        a.productName.localeCompare(b.productName),
    );

  const sum = (pick: (row: ProductStockRow) => number) =>
    data.reduce((total, row) => total + pick(row), 0);

  return {
    summary: {
      purchaseQty: sum((r) => r.purchaseQty),
      salesQty: sum((r) => r.salesQty),
      totalAmount: round2(sum((r) => r.totalAmount)),
      adjustments: sum((r) => r.adjustments),
    },
    data,
    pagination: paginate(1, data.length || 1, data.length),
  };
}

// =============================================================================
// CUSTOMER WISE
// Per customer, over the range: the cylinders they hold (Opening + Rented −
// Taken back = Balance, per cylinder size) and their money (Opening + Sales −
// Receipts = Outstanding). Agency-wide by design — a customer's balance is
// theirs, not any one staff member's.
//
// Money comes straight from the append-only money ledger. Cylinder custody has
// no ledger of its own, so it is rebuilt from the dated records behind every
// change to it — see customerCylinderEvents.
// =============================================================================

/** Money ledger rows as report events. */
async function customerMoneyEvents(toDate: Date): Promise<MoneyEvent[]> {
  const rows = await prisma.customerPaymentLedger.findMany({
    where: { createdAt: { lte: toDate } },
    select: {
      customerId: true,
      entryType: true,
      amount: true,
      voidedEntryId: true,
      paymentMethod: true,
      createdAt: true,
    },
  });

  return rows.map((row) => {
    const amount = Number(row.amount);
    const base = { customerId: row.customerId, at: row.createdAt };

    switch (row.entryType) {
      case LedgerEntryType.OPENING:
        return { ...base, kind: "opening" as const, amount };
      case LedgerEntryType.PAYMENT:
        // Negative on the ledger; a receipt is its size
        return {
          ...base,
          kind: "receipt" as const,
          amount: -amount,
          method: row.paymentMethod,
        };
      case LedgerEntryType.ADJUSTMENT:
        // A reversed payment gives back a receipt; anything else — a voided or
        // corrected invoice — changes what was sold
        return row.voidedEntryId
          ? { ...base, kind: "receipt" as const, amount: -amount }
          : { ...base, kind: "sale" as const, amount };
      default:
        return { ...base, kind: "sale" as const, amount };
    }
  });
}

/**
 * Every dated change to what customers hold, plus outright sales:
 * - the opening holding captured at onboarding;
 * - commercial RENT lines (out); SALE and REFILL lines (sold, never held);
 * - cylinders collected on an invoice (`CommercialSaleReturn`);
 * - returns recorded against one line (`PATCH …/return`). The line only keeps
 *   a running count, so their dates come from the cylinder ledger rows that
 *   path writes; any part the ledger cannot account for is dated by the line's
 *   last change;
 * - domestic sales from before 2026-11-02, which were charged to a customer
 *   and moved their holding.
 * Deleted invoices contribute nothing: their effect has been reversed.
 */
async function customerCylinderEvents(
  toDate: Date,
): Promise<CylinderEvent[]> {
  const live = { isDeleted: false, createdAt: { lte: toDate } };

  const [openings, commercialLines, collections, lineReturnTxns, domLines] =
    await Promise.all([
      prisma.customerInitialCylinderBalance.findMany({
        select: {
          customerId: true,
          productId: true,
          qty: true,
          customer: { select: { createdAt: true } },
        },
      }),
      prisma.commercialSaleItem.findMany({
        where: { commercialSale: { ...live, customerId: { not: null } } },
        select: {
          id: true,
          productId: true,
          saleType: true,
          quantity: true,
          cylindersDispatched: true,
          cylindersReturned: true,
          updatedAt: true,
          commercialSale: {
            select: { id: true, customerId: true, createdAt: true },
          },
        },
      }),
      prisma.commercialSaleReturn.findMany({
        where: {
          createdAt: { lte: toDate },
          commercialSale: { isDeleted: false, customerId: { not: null } },
        },
        select: {
          productId: true,
          quantity: true,
          createdAt: true,
          commercialSale: { select: { customerId: true } },
        },
      }),
      prisma.cylinderTransaction.findMany({
        where: {
          txnType: TxnType.CYLINDER_RETURN,
          refType: RefType.INVOICE,
          voidedTxnId: null,
          voidedBy: { none: {} },
          notes: { startsWith: "Cylinder return — COM #" },
        },
        select: { emptyDelta: true, notes: true, createdAt: true },
      }),
      prisma.domSaleItem.findMany({
        where: { domSale: { ...live, customerId: { not: null } } },
        select: {
          productId: true,
          cylindersDispatched: true,
          emptiesCollected: true,
          domSale: { select: { customerId: true, createdAt: true } },
        },
      }),
    ]);

  const events: CylinderEvent[] = [];

  for (const opening of openings)
    events.push({
      customerId: opening.customerId,
      productId: opening.productId,
      at: opening.customer.createdAt,
      kind: "opening",
      quantity: opening.qty,
    });

  // `notes` is written by recordReturn as "Cylinder return — COM #<sale> item #<line>"
  const returnsByLine = new Map<number, { at: Date; quantity: number }[]>();
  for (const txn of lineReturnTxns) {
    const match = /item #(\d+)$/.exec(txn.notes ?? "");
    if (!match) continue;
    const lineId = Number(match[1]);
    const list = returnsByLine.get(lineId) ?? [];
    list.push({ at: txn.createdAt, quantity: txn.emptyDelta });
    returnsByLine.set(lineId, list);
  }

  for (const line of commercialLines) {
    const customerId = line.commercialSale.customerId!;
    if (!line.productId) continue;
    const productId = line.productId;
    const at = line.commercialSale.createdAt;

    // An outright sale and a refill swap both leave nothing with the customer
    if (line.saleType !== CommercialSaleType.RENT) {
      events.push({ customerId, productId, at, kind: "sold", quantity: line.quantity });
      continue;
    }

    events.push({
      customerId,
      productId,
      at,
      kind: "rent",
      quantity: line.cylindersDispatched,
    });

    let accounted = 0;
    for (const ret of returnsByLine.get(line.id) ?? []) {
      if (accounted + ret.quantity > line.cylindersReturned) break;
      accounted += ret.quantity;
      if (ret.at <= toDate)
        events.push({ customerId, productId, at: ret.at, kind: "back", quantity: ret.quantity });
    }
    const unaccounted = line.cylindersReturned - accounted;
    if (unaccounted > 0 && line.updatedAt <= toDate)
      events.push({
        customerId,
        productId,
        at: line.updatedAt,
        kind: "back",
        quantity: unaccounted,
      });
  }

  for (const collection of collections)
    events.push({
      customerId: collection.commercialSale.customerId!,
      productId: collection.productId,
      at: collection.createdAt,
      kind: "back",
      quantity: collection.quantity,
    });

  for (const line of domLines) {
    const customerId = line.domSale.customerId!;
    const at = line.domSale.createdAt;
    if (line.cylindersDispatched > 0)
      events.push({
        customerId,
        productId: line.productId,
        at,
        kind: "rent",
        quantity: line.cylindersDispatched,
      });
    if (line.emptiesCollected > 0)
      events.push({
        customerId,
        productId: line.productId,
        at,
        kind: "back",
        quantity: line.emptiesCollected,
      });
  }

  return events;
}

async function buildCustomerWiseReport(query: CustomerWiseQuery) {
  const { fromDate, toDate } = assertAndNormalizeRange(query.from, query.to);

  const [customers, products, money, cylinders] = await Promise.all([
    prisma.customer.findMany({
      where: {
        isDeleted: false,
        // A customer registered after the range had nothing in it
        createdAt: { lte: toDate },
        ...(query.customerId && { id: query.customerId }),
      },
      select: { id: true, name: true, phone: true },
    }),
    prisma.product.findMany({ select: { id: true, name: true } }),
    customerMoneyEvents(toDate),
    customerCylinderEvents(toDate),
  ]);

  return buildCustomerWiseRows({
    customers,
    productNames: new Map(products.map((p) => [p.id, p.name])),
    money,
    cylinders,
    from: fromDate,
    to: toDate,
  });
}

export async function getCustomerWiseReport(query: CustomerWiseQuery) {
  const rows = await buildCustomerWiseReport(query);
  const { page, limit } = query;

  return {
    // The whole filtered range, not just this page
    summary: summarizeCustomerWiseRows(rows),
    data: rows.slice((page - 1) * limit, page * limit),
    pagination: paginate(page, limit, rows.length),
  };
}

/** Every row, unpaginated — for the export. */
export async function getCustomerWiseReportRows(query: CustomerWiseQuery) {
  return buildCustomerWiseReport(query);
}
