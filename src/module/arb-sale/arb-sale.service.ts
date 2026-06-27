import { prisma } from "@/lib/prisma";
import { LedgerEntryType, Prisma, RefType } from "@/generated/client";
import { NotFoundError, BadRequestError, ConflictError } from "@/lib/errors";
import { ArbSaleQuery, CreateArbSaleInput, UpdateArbSaleInput } from "./arb-sale.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const arbSaleInclude = {
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

// Prisma-inferred item shape from arbSaleInclude
type OriginalSaleItem = {
  stockId: number | null;
  productId: number | null;
  quantity: number;
};

// =============================================================================
// PURE HELPERS
// =============================================================================

function computeTotals(
  items: CreateArbSaleInput["items"],
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
  return `ARB-${date}-${String(saleId).padStart(5, "0")}`;
}


// =============================================================================
// GUARDS
// =============================================================================

async function assertArbSaleExists(tx: Prisma.TransactionClient, id: number) {
  const sale = await tx.arbSale.findFirst({
    where: { id, isDeleted: false },
    include: arbSaleInclude,
  });
  if (!sale) throw new NotFoundError(`ARB sale #${id} not found`);
  return sale;
}

// Validates each stock batch has enough qty and returns a stockMap
// Groups by stockId so multiple items from the same batch are checked together
async function assertAndFetchStocks(
  tx: Prisma.TransactionClient,
  items: CreateArbSaleInput["items"],
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

// Creates ArbSaleItems, decrements Stock.quantity, appends CylinderTransactions
async function writeSaleItems(
  tx: Prisma.TransactionClient,
  arbSaleId: number,
  items: CreateArbSaleInput["items"],
  stockMap: Map<number, StockInfo>,
) {
  // 1. ArbSaleItem rows — productId derived from stock, not trusted from client
  await tx.arbSaleItem.createMany({
    data: items.map((item) => ({
      arbSaleId,
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
  arbSaleId: number,
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
      refId: arbSaleId,
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
        refId: arbSaleId,
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
  arbSaleId: number,
  totalAmount: number,
  paidAmount: number,
  userId: number,
) {
  if (!customerId) {
    throw new NotFoundError(`Customer not found`);
  }

  const netCharge = Math.round((totalAmount - paidAmount) * 100) / 100;

  await tx.customerPaymentLedger.create({
    data: {
      customerId,
      entryType: LedgerEntryType.ADJUSTMENT,
      amount: -netCharge,
      refType: RefType.INVOICE,
      refId: arbSaleId,
      notes: `Reversal — ARB #${arbSaleId}`,
      createdById: userId,
    },
  });

  await tx.customerBalance.update({
    where: { customerId },
    data: { pendingAmount: { decrement: netCharge } },
  });
}

// =============================================================================
// CREATE
// =============================================================================

export async function createArbSale(input: CreateArbSaleInput, userId: number) {
  const { items, customerId, paidAmount, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (paidAmount > totalAmount)
    throw new BadRequestError("Paid amount cannot exceed total amount");

  return prisma.$transaction(async (tx) => {
    // 1. Validate stock batches + build stockMap { stockId → { productId, batchNo, qty } }
    const stockMap = await assertAndFetchStocks(tx, items);

    // 2. Create sale header
    const sale = await tx.arbSale.create({
      data: {
        ...header,
        customerId,
        totalAmount,
        paidAmount,
        discount: discount ?? null,
        createdById: userId,
        updatedById: userId,
      },
    });

    // 3. Set trNo now that we have the sale id
    await tx.arbSale.update({
      where: { id: sale.id },
      data: { trNo: generateTrNo(sale.id) },
    });

    // 4. ArbSaleItems + Stock.quantity
    await writeSaleItems(tx, sale.id, items, stockMap);

    // 6. Customer money ledger + balance (skipped for walk-in / no customer)
    await applyCustomerLedger(
      tx,
      customerId,
      sale.id,
      totalAmount,
      paidAmount,
      userId,
    );

    return tx.arbSale.findUniqueOrThrow({
      where: { id: sale.id },
      include: arbSaleInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getArbSales(query: ArbSaleQuery) {
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
    prisma.arbSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: arbSaleInclude,
    }),
    prisma.arbSale.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getArbSaleById(id: number) {
  const sale = await prisma.arbSale.findFirst({
    where: { id, isDeleted: false },
    include: arbSaleInclude,
  });
  if (!sale) throw new NotFoundError(`ARB sale #${id} not found`);
  return sale;
}

// =============================================================================
// UPDATE
// Strategy: reverse everything from the original sale, then repost with new data.
// The ArbSale row keeps its original id and trNo.
// =============================================================================

export async function updateArbSale(
  id: number,
  input: UpdateArbSaleInput,
  userId: number,
) {
  const { items, customerId, paidAmount, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (paidAmount > totalAmount)
    throw new BadRequestError("Paid amount cannot exceed total amount");

  return prisma.$transaction(async (tx) => {
    const original = await assertArbSaleExists(tx, id);

    // ── REVERSE PHASE ────────────────────────────────────────────────────────

    // 1. Restore Stock.quantity from original items
    await restoreStockQuantities(tx, original.items);

    // 2. Reverse customer ledger (if original had a customer)
    await reverseCustomerLedger(
      tx,
      original.customerId,
      id,
      Number(original.totalAmount),
      Number(original.paidAmount),
      userId,
    );

    // 3. Delete original sale items (child rows, no independent ledger value)
    await tx.arbSaleItem.deleteMany({ where: { arbSaleId: id } });

    // ── REPOST PHASE ─────────────────────────────────────────────────────────

    // 4. Validate new stock batches + build stockMap
    const stockMap = await assertAndFetchStocks(tx, items);

    // 5. Write corrected items + Stock.quantity-- + CylinderTransactions
    await writeSaleItems(tx, id, items, stockMap);

    // 6. Apply new GodownInventory delta
    // await applyGodownDelta(tx, productQtys, -1);

    // 7. Apply new customer ledger (falls back to original customer if not changed)
    const newCustomerId = customerId ?? original.customerId;
    await applyCustomerLedger(
      tx,
      newCustomerId,
      id,
      totalAmount,
      paidAmount,
      userId,
    );

    // 8. Update sale header in place (keeps original id and trNo)
    return tx.arbSale.update({
      where: { id },
      data: {
        ...header,
        customerId: newCustomerId ?? null,
        totalAmount,
        paidAmount,
        discount: discount ?? null,
        updatedById: userId,
      },
      include: arbSaleInclude,
    });
  });
}

// =============================================================================
// DELETE
// Strategy: same reverse phase as update, then soft-delete the header.
// =============================================================================

export async function deleteArbSale(id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const original = await assertArbSaleExists(tx, id);

    // 1. Restore Stock.quantity
    await restoreStockQuantities(tx, original.items);

    // 2. Reverse customer ledger
    await reverseCustomerLedger(
      tx,
      original.customerId,
      id,
      Number(original.totalAmount),
      Number(original.paidAmount),
      userId,
    );

    // 3. Soft-delete (items stay for audit, sale header hidden from queries)
    return tx.arbSale.update({
      where: { id },
      data: { isDeleted: true, updatedById: userId },
    });
  });
}
