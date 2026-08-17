import { prisma } from "@/lib/prisma";
import { LedgerEntryType, Prisma, RefType, TxnType } from "@/generated/client";
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
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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

// Builds { productId -> total qty } from existing DB sale items (update/delete reversal)
function resolveOriginalProductQtys(items: OriginalSaleItem[]): ProductQty[] {
  const acc: Record<number, number> = {};
  for (const item of items) {
    if (!item.productId) continue;
    acc[item.productId] = (acc[item.productId] ?? 0) + item.quantity;
  }
  return Object.entries(acc).map(([productId, quantity]) => ({
    productId: Number(productId),
    quantity,
  }));
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
  // 1. DomSaleItem rows — productId derived from stock, not trusted from client
  await tx.domSaleItem.createMany({
    data: items.map((item) => ({
      domSaleId,
      stockId: item.stockId,
      productId: stockMap.get(item.stockId)!.productId,
      quantity: item.quantity,
      salePrice: item.salePrice,
      netTotal: Math.round(item.quantity * item.salePrice * 100) / 100,
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

  // 3. CylinderTransaction — one SALE_OUT row per product (grouped)
  const productQtys = resolveProductQtys(items, stockMap);

  await tx.cylinderTransaction.createMany({
    data: productQtys.map(({ productId, quantity }) => ({
      productId,
      txnType: TxnType.SALE_OUT,
      filledDelta: -quantity,
      emptyDelta: 0,
      refType: RefType.INVOICE,
      refId: domSaleId,
      notes: `DomSale #${domSaleId}`,
    })),
  });
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

    // 5. GodownInventory cache
    await applyGodownDelta(tx, productQtys, -1);

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

    // ── REVERSE PHASE ────────────────────────────────────────────────────────

    // 1. Void original CylinderTransactions
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — DomSale #${id} update`,
    );

    // 2. Restore Stock.quantity from original items
    await restoreStockQuantities(tx, original.items);

    // 3. Restore GodownInventory from original items
    const originalProductQtys = resolveOriginalProductQtys(original.items);
    await applyGodownDelta(tx, originalProductQtys, 1);

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

    // 7. Write corrected items + Stock.quantity-- + CylinderTransactions
    await writeSaleItems(tx, id, items, stockMap);

    // 8. Apply new GodownInventory delta
    await applyGodownDelta(tx, productQtys, -1);

    // 9. Apply new customer ledger (falls back to original customer if not changed)
    const newCustomerId = customerId ?? original.customerId;
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

    // 1. Void original CylinderTransactions
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — DomSale #${id} deleted`,
    );

    // 2. Restore Stock.quantity
    await restoreStockQuantities(tx, original.items);

    // 3. Restore GodownInventory
    const originalProductQtys = resolveOriginalProductQtys(original.items);
    await applyGodownDelta(tx, originalProductQtys, 1);

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
