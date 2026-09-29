import { prisma } from "@/lib/prisma";
import { businessDayKey } from "@/lib/business-day";
import {
  CommercialSaleType,
  LedgerEntryType,
  Prisma,
  RefType,
  TxnType,
} from "@/generated/client";
import { NotFoundError, BadRequestError, ConflictError } from "@/lib/errors";
import type {
  CreateDomSaleInput,
  UpdateDomSaleInput,
  DomSaleQuery,
} from "./dom-sale.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const domSaleInclude = {
  customer: true,
  items: {
    include: {
      product: true,
      stock: true,
    },
  },
} as const;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type StockInfo = { productId: number; batchNo: string; quantity: number };
type ProductQty = { productId: number; quantity: number };

// Prisma-inferred item shape from domSaleInclude
type OriginalSaleItem = {
  stockId: number | null;
  productId: number | null;
  quantity: number;
  cylindersDispatched: number;
  emptiesCollected: number;
};

/** What an invoice does to the customer's domestic holding, per product. */
type CustodyEffect = {
  /** Empties handed back — checked against what the customer already held. */
  collected: ProductQty[];
  /** Net change to the holding: cylinders out minus empties back. */
  net: ProductQty[];
};

// =============================================================================
// PURE HELPERS
// =============================================================================

function computeTotals(
  items: CreateDomSaleInput["items"],
  discount = 0,
): { totalAmount: number } {
  const subtotal = items.reduce(
    (sum, item) => sum + Math.round(item.quantity * item.salePrice * 100) / 100,
    0,
  );
  return { totalAmount: Math.round((subtotal - discount) * 100) / 100 };
}

function generateTrNo(saleId: number): string {
  // India time: toISOString() is UTC, which dated a 02:00 sale the day before
  const date = businessDayKey(new Date()).replace(/-/g, "");
  return `DOM-${date}-${String(saleId).padStart(5, "0")}`;
}

// Builds { productId -> total qty } from new items using stockMap
function resolveProductQtys(
  items: CreateDomSaleInput["items"],
  stockMap: Map<number, StockInfo>,
): ProductQty[] {
  const acc: Record<number, number> = {};
  for (const item of items) {
    const productId = stockMap.get(item.stockId)!.productId;
    acc[productId] = (acc[productId] ?? 0) + item.quantity;
  }
  return Object.entries(acc).map(([productId, quantity]) => ({
    productId: Number(productId),
    quantity,
  }));
}

function toProductQtys(acc: Map<number, number>): ProductQty[] {
  return [...acc]
    .filter(([, quantity]) => quantity !== 0)
    .map(([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Every domestic cylinder that goes out adds to what the customer holds —
 * outright SALE included, so that a customer who bought one can later hand
 * its empty back for a refill. Empties collected on a RENT line come off.
 */
function resolveCustody(
  items: CreateDomSaleInput["items"],
  stockMap: Map<number, StockInfo>,
): CustodyEffect {
  const collected = new Map<number, number>();
  const net = new Map<number, number>();

  for (const item of items) {
    const productId = stockMap.get(item.stockId)!.productId;
    collected.set(productId, (collected.get(productId) ?? 0) + item.emptiesCollected);
    net.set(
      productId,
      (net.get(productId) ?? 0) + item.quantity - item.emptiesCollected,
    );
  }

  return { collected: toProductQtys(collected), net: toProductQtys(net) };
}

/**
 * What a saved invoice did to the holding, read from what each line recorded.
 * Sales from before domestic custody was tracked recorded 0 for both, so
 * reversing one leaves the holding alone — as it should, since it never
 * touched it.
 */
function resolveOriginalCustody(items: OriginalSaleItem[]): ProductQty[] {
  const net = new Map<number, number>();

  for (const item of items) {
    if (!item.productId) continue;
    net.set(
      item.productId,
      (net.get(item.productId) ?? 0) +
        item.cylindersDispatched -
        item.emptiesCollected,
    );
  }

  return toProductQtys(net);
}

// =============================================================================
// GUARDS
// =============================================================================

async function assertDomSaleExists(tx: Prisma.TransactionClient, id: number) {
  const sale = await tx.domSale.findFirst({
    where: { id, isDeleted: false },
    include: domSaleInclude,
  });
  if (!sale) throw new NotFoundError(`Domestic sale #${id} not found`);
  return sale;
}

// Validates each stock batch has enough qty and returns a stockMap
// Groups by stockId so multiple items from the same batch are checked together
async function assertAndFetchStocks(
  tx: Prisma.TransactionClient,
  items: CreateDomSaleInput["items"],
): Promise<Map<number, StockInfo>> {
  const qtyByStock = items.reduce<Record<number, number>>((acc, item) => {
    acc[item.stockId] = (acc[item.stockId] ?? 0) + item.quantity;
    return acc;
  }, {});

  const stockMap = new Map<number, StockInfo>();

  for (const [stockId, requestedQty] of Object.entries(qtyByStock)) {
    const stock = await tx.stock.findFirst({
      where: { id: Number(stockId), isDeleted: false },
    });

    if (!stock || !stock.productId) {
      throw new NotFoundError(`Stock batch #${stockId} not found`);
    }

    if (stock.quantity < requestedQty) {
      throw new ConflictError(
        `Insufficient quantity in batch "${stock.batchNo}"`,
        {
          stockId: Number(stockId),
          batchNo: stock.batchNo,
          available: stock.quantity,
          requested: requestedQty,
        },
      );
    }

    stockMap.set(Number(stockId), {
      productId: stock.productId,
      batchNo: stock.batchNo,
      quantity: stock.quantity,
    });
  }

  return stockMap;
}

async function customerHoldings(
  tx: Prisma.TransactionClient,
  customerId: number,
): Promise<Map<number, number>> {
  const ledgers = await tx.customerCylinderLedger.findMany({
    where: { customerId },
    select: { productId: true, pendingCylinder: true },
  });
  return new Map(ledgers.map((l) => [l.productId, l.pendingCylinder]));
}

async function productName(tx: Prisma.TransactionClient, productId: number) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { name: true },
  });
  return product?.name ?? `product #${productId}`;
}

/**
 * Empties handed back must be ones the customer already held before this
 * invoice. Cylinders delivered full on the same visit cannot be the empties
 * handed back on it.
 */
async function assertCustomerHoldsEmpties(
  tx: Prisma.TransactionClient,
  customerId: number,
  collected: ProductQty[],
) {
  if (collected.length === 0) return;

  const held = await customerHoldings(tx, customerId);

  for (const { productId, quantity } of collected) {
    const holding = held.get(productId) ?? 0;
    if (quantity > holding)
      throw new ConflictError(
        `Cannot collect ${quantity} empty ${await productName(tx, productId)} — the customer holds ${holding}. Record their existing cylinders on the customer, or collect fewer.`,
        { productId, holding, quantity },
      );
  }
}

/**
 * Reversing an invoice gives back what it did to the holding. If those
 * cylinders have since come back on a later invoice, taking them off again
 * would leave the customer holding a negative number — refuse, and say which
 * invoice has to be corrected first.
 */
async function assertReversalKeepsCustody(
  tx: Prisma.TransactionClient,
  customerId: number,
  net: ProductQty[],
) {
  const held = await customerHoldings(tx, customerId);

  for (const { productId, quantity } of net) {
    if (quantity <= 0) continue;
    const holding = held.get(productId) ?? 0;
    if (holding - quantity < 0)
      throw new ConflictError(
        `${await productName(tx, productId)} from this invoice have since been handed back on a later invoice. Correct that one first.`,
        { productId, holding, reversing: quantity },
      );
  }
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// Creates DomSaleItems, decrements Stock.quantity, appends CylinderTransactions
async function writeSaleItems(
  tx: Prisma.TransactionClient,
  domSaleId: number,
  items: CreateDomSaleInput["items"],
  stockMap: Map<number, StockInfo>,
) {
  // 1. DomSaleItem rows — productId derived from stock, not trusted from client.
  //    Each records what it did to the customer's holding, so a later reversal
  //    undoes exactly that.
  await tx.domSaleItem.createMany({
    data: items.map((item) => ({
      domSaleId,
      stockId: item.stockId,
      productId: stockMap.get(item.stockId)!.productId,
      quantity: item.quantity,
      salePrice: item.salePrice,
      netTotal: Math.round(item.quantity * item.salePrice * 100) / 100,
      saleType: item.saleType,
      cylindersDispatched: item.quantity,
      emptiesCollected: item.emptiesCollected,
    })),
  });

  // 2. Decrement Stock.quantity — grouped by stockId
  const qtyByStock = items.reduce<Record<number, number>>((acc, item) => {
    acc[item.stockId] = (acc[item.stockId] ?? 0) + item.quantity;
    return acc;
  }, {});

  for (const [stockId, qty] of Object.entries(qtyByStock)) {
    await tx.stock.update({
      where: { id: Number(stockId) },
      data: { quantity: { decrement: qty } },
    });
  }

  // 3. Full cylinders out — one row per product and kind, since a refill
  //    (RENT_DELIVERY) and an outright sale (SALE_OUT) are different movements
  const outgoing = new Map<string, { productId: number; txnType: TxnType; quantity: number }>();

  for (const item of items) {
    const productId = stockMap.get(item.stockId)!.productId;
    const txnType =
      item.saleType === CommercialSaleType.RENT
        ? TxnType.RENT_DELIVERY
        : TxnType.SALE_OUT;
    const key = `${productId}:${txnType}`;
    const row = outgoing.get(key) ?? { productId, txnType, quantity: 0 };
    row.quantity += item.quantity;
    outgoing.set(key, row);
  }

  await tx.cylinderTransaction.createMany({
    data: [...outgoing.values()].map(({ productId, txnType, quantity }) => ({
      productId,
      txnType,
      filledDelta: -quantity,
      emptyDelta: 0,
      refType: RefType.INVOICE,
      refId: domSaleId,
      notes: `DomSale #${domSaleId}`,
    })),
  });

  // 4. Empties handed back — one row per product
  const { collected } = resolveCustody(items, stockMap);

  if (collected.length > 0)
    await tx.cylinderTransaction.createMany({
      data: collected.map(({ productId, quantity }) => ({
        productId,
        txnType: TxnType.CYLINDER_RETURN,
        filledDelta: 0,
        emptyDelta: quantity,
        refType: RefType.INVOICE,
        refId: domSaleId,
        notes: `Empties collected — DomSale #${domSaleId}`,
      })),
    });
}

// Empties handed back arrive in the godown
async function applyGodownEmpties(
  tx: Prisma.TransactionClient,
  collected: ProductQty[],
) {
  for (const { productId, quantity } of collected) {
    await tx.godownInventory.update({
      where: { productId },
      data: { emptyQty: { increment: quantity } },
    });
  }
}

// The customer's domestic holding, per product
async function applyDomesticCustody(
  tx: Prisma.TransactionClient,
  customerId: number,
  net: ProductQty[],
  direction: 1 | -1,
) {
  for (const { productId, quantity } of net) {
    const change = direction * quantity;
    await tx.customerCylinderLedger.upsert({
      where: { productId_customerId: { productId, customerId } },
      update: { pendingCylinder: { increment: change } },
      // The guards guarantee a missing row is only ever created by a gain
      create: { customerId, productId, pendingCylinder: Math.max(change, 0) },
    });
  }
}

// Updates GodownInventory.filledQty by direction (+1 restore, -1 deduct)
async function applyGodownDelta(
  tx: Prisma.TransactionClient,
  productQtys: ProductQty[],
  direction: 1 | -1,
) {
  for (const { productId, quantity } of productQtys) {
    await tx.godownInventory.update({
      where: { productId },
      data: { filledQty: { increment: direction * quantity } },
    });
  }
}

// Restores Stock.quantity when reversing a sale (update or delete)
async function restoreStockQuantities(
  tx: Prisma.TransactionClient,
  saleItems: OriginalSaleItem[],
) {
  const qtyByStock = saleItems.reduce<Record<number, number>>((acc, item) => {
    if (!item.stockId) return acc;
    acc[item.stockId] = (acc[item.stockId] ?? 0) + item.quantity;
    return acc;
  }, {});

  for (const [stockId, qty] of Object.entries(qtyByStock)) {
    await tx.stock.update({
      where: { id: Number(stockId) },
      data: { quantity: { increment: qty } },
    });
  }
}

// Appends SALE_CHARGE + optional PAYMENT to CustomerPaymentLedger, updates CustomerBalance
async function applyCustomerLedger(
  tx: Prisma.TransactionClient,
  customerId: number,
  domSaleId: number,
  totalAmount: number,
  paidAmount: number,
  userId: number,
) {
  if (!customerId) {
    throw new NotFoundError(`Customer not found`);
  }

  await tx.customerPaymentLedger.create({
    data: {
      customerId,
      entryType: LedgerEntryType.SALE_CHARGE,
      amount: totalAmount,
      refType: RefType.INVOICE,
      refId: domSaleId,
      createdById: userId,
    },
  });

  if (paidAmount > 0) {
    await tx.customerPaymentLedger.create({
      data: {
        customerId,
        entryType: LedgerEntryType.PAYMENT,
        amount: -paidAmount,
        refType: RefType.INVOICE,
        refId: domSaleId,
        createdById: userId,
      },
    });
  }

  const netCharge = Math.round((totalAmount - paidAmount) * 100) / 100;
  await tx.customerBalance.upsert({
    where: { customerId },
    update: { pendingAmount: { increment: netCharge } },
    create: { customerId, pendingAmount: netCharge },
  });
}

// Appends a single ADJUSTMENT reversal row, decrements CustomerBalance
async function reverseCustomerLedger(
  tx: Prisma.TransactionClient,
  customerId: number,
  domSaleId: number,
  totalAmount: number,
  paidAmount: number,
  userId: number,
) {
  const netCharge = Math.round((totalAmount - paidAmount) * 100) / 100;

  await tx.customerPaymentLedger.create({
    data: {
      customerId,
      entryType: LedgerEntryType.ADJUSTMENT,
      amount: -netCharge,
      refType: RefType.INVOICE,
      refId: domSaleId,
      notes: `Reversal — DomSale #${domSaleId}`,
      createdById: userId,
    },
  });

  await tx.customerBalance.update({
    where: { customerId },
    data: { pendingAmount: { decrement: netCharge } },
  });
}

// Fetches and voids all active CylinderTransactions for a sale
async function reverseCylinderTransactions(
  tx: Prisma.TransactionClient,
  domSaleId: number,
  note: string,
) {
  const originalTxns = await tx.cylinderTransaction.findMany({
    where: {
      refType: RefType.INVOICE,
      refId: domSaleId,
      voidedTxnId: null,
      voidedBy: { none: {} },
    },
  });

  for (const txn of originalTxns) {
    await tx.cylinderTransaction.create({
      data: {
        productId: txn.productId,
        txnType: txn.txnType,
        filledDelta: -txn.filledDelta,
        emptyDelta: -txn.emptyDelta,
        refType: RefType.INVOICE,
        refId: domSaleId,
        voidedTxnId: txn.id,
        notes: note,
      },
    });

    // Undo exactly the godown movement this row caused — filled and empty.
    // This used to be a separate filled-only restore, which would have left
    // behind any empties a refill brought in.
    await tx.godownInventory.update({
      where: { productId: txn.productId },
      data: {
        filledQty: { increment: -txn.filledDelta },
        emptyQty: { increment: -txn.emptyDelta },
      },
    });
  }
}

// =============================================================================
// CREATE
// =============================================================================

export async function createDomSale(input: CreateDomSaleInput, userId: number) {
  const { items, customerId, paidAmount, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (paidAmount > totalAmount)
    throw new BadRequestError("Paid amount cannot exceed total amount");

  return prisma.$transaction(async (tx) => {
    // 1. Validate stock batches + build stockMap { stockId → { productId, batchNo, qty } }
    const stockMap = await assertAndFetchStocks(tx, items);
    const productQtys = resolveProductQtys(items, stockMap);
    const custody = resolveCustody(items, stockMap);

    // 1b. Empties handed back must be ones the customer already held
    await assertCustomerHoldsEmpties(tx, customerId, custody.collected);

    // 2. Create sale header
    const sale = await tx.domSale.create({
      data: {
        ...header,
        customerId: customerId ?? null,
        totalAmount,
        paidAmount,
        discount: discount ?? null,
        createdById: userId,
        updatedById: userId,
      },
    });

    // 3. Set trNo now that we have the sale id
    await tx.domSale.update({
      where: { id: sale.id },
      data: { trNo: generateTrNo(sale.id) },
    });

    // 4. DomSaleItems + Stock.quantity-- + CylinderTransactions
    await writeSaleItems(tx, sale.id, items, stockMap);

    // 5. GodownInventory cache — fulls out, empties in
    await applyGodownDelta(tx, productQtys, -1);
    await applyGodownEmpties(tx, custody.collected);

    // 5b. What the customer now holds
    await applyDomesticCustody(tx, customerId, custody.net, 1);

    // 6. Customer money ledger + balance (skipped for walk-in / no customer)
    await applyCustomerLedger(
      tx,
      customerId,
      sale.id,
      totalAmount,
      paidAmount,
      userId,
    );

    return tx.domSale.findUniqueOrThrow({
      where: { id: sale.id },
      include: domSaleInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getDomSales(query: DomSaleQuery) {
  const { customerId, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    ...(customerId && { customerId }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.domSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: domSaleInclude,
    }),
    prisma.domSale.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getDomSaleById(id: number) {
  const sale = await prisma.domSale.findFirst({
    where: { id, isDeleted: false },
    include: domSaleInclude,
  });
  if (!sale) throw new NotFoundError(`Domestic sale #${id} not found`);
  return sale;
}

// =============================================================================
// UPDATE
// Strategy: reverse everything from the original sale, then repost with new data.
// The DomSale row keeps its original id and trNo.
// =============================================================================

export async function updateDomSale(
  id: number,
  input: UpdateDomSaleInput,
  userId: number,
) {
  const { items, customerId, paidAmount, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (paidAmount > totalAmount)
    throw new BadRequestError("Paid amount cannot exceed total amount");

  return prisma.$transaction(async (tx) => {
    const original = await assertDomSaleExists(tx, id);
    const originalCustody = resolveOriginalCustody(original.items);

    // Refuse before touching anything if its cylinders have since come back
    if (original.customerId)
      await assertReversalKeepsCustody(tx, original.customerId, originalCustody);

    // ── REVERSE PHASE ────────────────────────────────────────────────────────

    // 1. Void original CylinderTransactions and undo their godown movement
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — DomSale #${id} update`,
    );

    // 2. Restore Stock.quantity from original items
    await restoreStockQuantities(tx, original.items);

    // 3. Give back what the original did to the customer's holding
    if (original.customerId)
      await applyDomesticCustody(tx, original.customerId, originalCustody, -1);

    // 4. Reverse customer ledger (if original had a customer)
    if (original.customerId) {
      await reverseCustomerLedger(
        tx,
        original.customerId,
        id,
        Number(original.totalAmount),
        Number(original.paidAmount),
        userId,
      );
    }

    // 5. Delete original sale items (child rows, no independent ledger value)
    await tx.domSaleItem.deleteMany({ where: { domSaleId: id } });

    // ── REPOST PHASE ─────────────────────────────────────────────────────────

    // 6. Validate new stock batches + build stockMap
    const stockMap = await assertAndFetchStocks(tx, items);
    const productQtys = resolveProductQtys(items, stockMap);
    const custody = resolveCustody(items, stockMap);
    const newCustomerId = customerId ?? original.customerId;

    // 6b. Checked after the reversal, so the holding is the pre-invoice figure
    if (newCustomerId)
      await assertCustomerHoldsEmpties(tx, newCustomerId, custody.collected);

    // 7. Write corrected items + Stock.quantity-- + CylinderTransactions
    await writeSaleItems(tx, id, items, stockMap);

    // 8. Apply new GodownInventory delta — fulls out, empties in
    await applyGodownDelta(tx, productQtys, -1);
    await applyGodownEmpties(tx, custody.collected);

    // 8b. What the customer now holds
    if (newCustomerId)
      await applyDomesticCustody(tx, newCustomerId, custody.net, 1);

    // 9. Apply new customer ledger (falls back to original customer if not changed)
    if (newCustomerId) {
      await applyCustomerLedger(
        tx,
        newCustomerId,
        id,
        totalAmount,
        paidAmount,
        userId,
      );
    }

    // 10. Update sale header in place (keeps original id and trNo)
    return tx.domSale.update({
      where: { id },
      data: {
        ...header,
        customerId: newCustomerId ?? null,
        totalAmount,
        paidAmount,
        discount: discount ?? null,
        updatedById: userId,
      },
      include: domSaleInclude,
    });
  });
}

// =============================================================================
// DELETE
// Strategy: same reverse phase as update, then soft-delete the header.
// =============================================================================

export async function deleteDomSale(id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const original = await assertDomSaleExists(tx, id);
    const originalCustody = resolveOriginalCustody(original.items);

    if (original.customerId)
      await assertReversalKeepsCustody(tx, original.customerId, originalCustody);

    // 1. Void original CylinderTransactions and undo their godown movement
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — DomSale #${id} deleted`,
    );

    // 2. Restore Stock.quantity
    await restoreStockQuantities(tx, original.items);

    // 3. Give back what it did to the customer's holding
    if (original.customerId)
      await applyDomesticCustody(tx, original.customerId, originalCustody, -1);

    // 4. Reverse customer ledger
    if (original.customerId) {
      await reverseCustomerLedger(
        tx,
        original.customerId,
        id,
        Number(original.totalAmount),
        Number(original.paidAmount),
        userId,
      );
    }

    // 5. Soft-delete (items stay for audit, sale header hidden from queries)
    return tx.domSale.update({
      where: { id },
      data: { isDeleted: true, updatedById: userId },
    });
  });
}
