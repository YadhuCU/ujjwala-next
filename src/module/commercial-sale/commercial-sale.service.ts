import { prisma } from "@/lib/prisma";
import {
  CommercialSaleType,
  LedgerEntryType,
  Prisma,
  RefType,
  TxnType,
} from "@/generated/client";
import { NotFoundError, BadRequestError, ConflictError } from "@/lib/errors";
import type {
  CommercialSaleQuery,
  CreateCommercialSaleInput,
  CylinderReturnInput,
  UpdateCommercialSaleInput,
} from "./commercial-sale.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const commercialSaleInclude = {
  customer: true,
  items: {
    include: {
      product: true,
      stock: true,
    },
  },
  returns: { include: { product: true } },
} as const;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type StockInfo = { productId: number; batchNo: string; quantity: number };

type ProductQty = { productId: number; quantity: number };

type OriginalSaleItem = {
  id: number;
  stockId: number | null;
  productId: number | null;
  saleType: CommercialSaleType;
  quantity: number;
  cylindersDispatched: number;
  cylindersReturned: number;
};

// =============================================================================
// PURE HELPERS
// =============================================================================

function computeTotals(
  items: CreateCommercialSaleInput["items"],
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
  return `COM-${date}-${String(saleId).padStart(5, "0")}`;
}

// Groups requested quantities per product, resolving productId from the stock map.
function resolveProductQtys(
  items: CreateCommercialSaleInput["items"],
  stockMap: Map<number, StockInfo>,
  filter?: (item: CreateCommercialSaleInput["items"][number]) => boolean,
): ProductQty[] {
  const qtyByProduct = items
    .filter((item) => filter?.(item) ?? true)
    .reduce<Record<number, number>>((acc, item) => {
      const productId = stockMap.get(item.stockId)!.productId;
      acc[productId] = (acc[productId] ?? 0) + item.quantity;
      return acc;
    }, {});

  return Object.entries(qtyByProduct).map(([productId, quantity]) => ({
    productId: Number(productId),
    quantity,
  }));
}

// =============================================================================
// GUARDS
// =============================================================================

async function assertCommercialSaleExists(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const sale = await tx.commercialSale.findFirst({
    where: { id, isDeleted: false },
    include: commercialSaleInclude,
  });
  if (!sale) throw new NotFoundError(`Commercial sale #${id} not found`);
  return sale;
}

// Validates each stock batch has enough qty and returns a stockMap
async function assertAndFetchStocks(
  tx: Prisma.TransactionClient,
  items: CreateCommercialSaleInput["items"],
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

// COMMERCIAL products are cylinders — the godown must physically hold them.
async function assertGodownHasFilled(
  tx: Prisma.TransactionClient,
  productQtys: ProductQty[],
) {
  for (const { productId, quantity } of productQtys) {
    const inv = await tx.godownInventory.findUnique({ where: { productId } });

    if (!inv || inv.filledQty < quantity) {
      throw new BadRequestError("Insufficient filled cylinders in godown", {
        productId,
        available: inv?.filledQty ?? 0,
        requested: quantity,
      });
    }
  }
}

// Corrections cannot reason about a partially returned rental — the return is a
// separate event with its own ledger rows. Force the user to correct the return
// first (or post a fresh invoice) instead of silently rewriting custody history.
function assertNoReturnsRecorded(items: OriginalSaleItem[]) {
  const returned = items.some((item) => item.cylindersReturned > 0);

  if (returned)
    throw new ConflictError(
      "Cannot edit an invoice that already has cylinder returns recorded",
    );
}

// A rental invoice cannot be deleted while the customer still holds cylinders.
function assertNoOutstandingCylinders(items: OriginalSaleItem[]) {
  const outstanding = items.some(
    (item) =>
      item.saleType === CommercialSaleType.RENT &&
      item.cylindersReturned < item.cylindersDispatched,
  );

  if (outstanding)
    throw new ConflictError(
      "Cannot delete — cylinders from this invoice are still with the customer",
    );
}

/**
 * What the customer holds right now, per product, before this invoice touches
 * anything. Collected cylinders are checked against this rather than against
 * the post-dispatch figure: cylinders delivered full on this visit cannot be
 * the ones handed back on the same visit.
 */
async function fetchCustomerHoldings(
  tx: Prisma.TransactionClient,
  customerId: number,
): Promise<Map<number, number>> {
  const ledgers = await tx.customerCylinderLedger.findMany({
    where: { customerId },
    select: { productId: true, pendingCylinder: true },
  });

  return new Map(ledgers.map((l) => [l.productId, l.pendingCylinder]));
}

async function assertCustomerHoldsCylinders(
  tx: Prisma.TransactionClient,
  customerId: number,
  returns: ProductQty[],
) {
  if (returns.length === 0) return;

  const held = await fetchCustomerHoldings(tx, customerId);

  for (const { productId, quantity } of returns) {
    const holding = held.get(productId) ?? 0;

    if (quantity > holding) {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { name: true },
      });

      throw new ConflictError(
        `Cannot collect ${quantity} × ${product?.name ?? `product #${productId}`} — the customer holds ${holding}`,
        { productId, holding, quantity },
      );
    }
  }
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// Creates CommercialSaleItems, decrements Stock.quantity, appends CylinderTransactions
async function writeSaleItems(
  tx: Prisma.TransactionClient,
  commercialSaleId: number,
  items: CreateCommercialSaleInput["items"],
  stockMap: Map<number, StockInfo>,
) {
  // 1. Item rows — productId derived from stock, not trusted from client.
  //    RENT lines dispatch cylinders; SALE lines are outright and track none.
  await tx.commercialSaleItem.createMany({
    data: items.map((item) => ({
      commercialSaleId,
      stockId: item.stockId,
      productId: stockMap.get(item.stockId)!.productId,
      saleType: item.saleType,
      quantity: item.quantity,
      salePrice: item.salePrice,
      netTotal: Math.round(item.quantity * item.salePrice * 100) / 100,
      cylindersDispatched:
        item.saleType === CommercialSaleType.RENT ? item.quantity : 0,
      cylindersReturned: 0,
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

  // 3. CylinderTransaction — RENT_DELIVERY for rentals, SALE_OUT for sales.
  //    Both leave the godown as filled cylinders.
  const rentQtys = resolveProductQtys(
    items,
    stockMap,
    (item) => item.saleType === CommercialSaleType.RENT,
  );
  const saleQtys = resolveProductQtys(
    items,
    stockMap,
    (item) => item.saleType === CommercialSaleType.SALE,
  );

  await tx.cylinderTransaction.createMany({
    data: [
      ...rentQtys.map((row) => ({ ...row, txnType: TxnType.RENT_DELIVERY })),
      ...saleQtys.map((row) => ({ ...row, txnType: TxnType.SALE_OUT })),
    ].map(({ productId, quantity, txnType }) => ({
      productId,
      txnType,
      filledDelta: -quantity,
      emptyDelta: 0,
      refType: RefType.INVOICE,
      refId: commercialSaleId,
      notes: `CommercialSale #${commercialSaleId}`,
    })),
  });

  return { rentQtys, saleQtys };
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

// Tracks how many cylinders the customer currently holds, per product.
// Only RENT lines move this cache — an outright SALE expects nothing back.
async function applyCustomerCylinderDelta(
  tx: Prisma.TransactionClient,
  customerId: number,
  productQtys: ProductQty[],
  direction: 1 | -1,
) {
  for (const { productId, quantity } of productQtys) {
    await tx.customerCylinderLedger.upsert({
      where: { productId_customerId: { productId, customerId } },
      update: { pendingCylinder: { increment: direction * quantity } },
      create: {
        customerId,
        productId,
        pendingCylinder: direction === 1 ? quantity : 0,
      },
    });
  }
}

/**
 * Cylinders collected from the customer while this invoice was written.
 *
 * Four effects, exactly like the per-invoice return flow: a record on the
 * invoice, a row on the append-only cylinder ledger, empties into the godown,
 * and the customer's custody comes down.
 */
async function writeRecordedReturns(
  tx: Prisma.TransactionClient,
  commercialSaleId: number,
  customerId: number,
  returns: ProductQty[],
) {
  for (const { productId, quantity } of returns) {
    await tx.commercialSaleReturn.create({
      data: { commercialSaleId, productId, quantity },
    });

    await tx.cylinderTransaction.create({
      data: {
        productId,
        txnType: TxnType.CYLINDER_RETURN,
        filledDelta: 0,
        emptyDelta: quantity,
        refType: RefType.INVOICE,
        refId: commercialSaleId,
        notes: `Cylinders collected — COM #${commercialSaleId}`,
      },
    });

    // The godown row may not exist yet for a product never held there
    await tx.godownInventory.upsert({
      where: { productId },
      update: { emptyQty: { increment: quantity } },
      create: { productId, filledQty: 0, emptyQty: quantity },
    });

    await tx.customerCylinderLedger.update({
      where: { productId_customerId: { productId, customerId } },
      data: { pendingCylinder: { decrement: quantity } },
    });
  }
}

/**
 * Undo the custody half of the collections on this invoice.
 *
 * The godown and ledger halves are already handled by
 * `reverseCylinderTransactions`, which voids every cylinder row the invoice
 * wrote — collections included. Only the customer's holding needs restoring
 * here, and the records themselves removed so a repost does not double them.
 */
async function reverseRecordedReturns(
  tx: Prisma.TransactionClient,
  commercialSaleId: number,
  customerId: number,
) {
  const recorded = await tx.commercialSaleReturn.findMany({
    where: { commercialSaleId },
  });

  for (const { productId, quantity } of recorded) {
    await tx.customerCylinderLedger.update({
      where: { productId_customerId: { productId, customerId } },
      data: { pendingCylinder: { increment: quantity } },
    });
  }

  await tx.commercialSaleReturn.deleteMany({ where: { commercialSaleId } });
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
  commercialSaleId: number,
  totalAmount: number,
  paidAmount: number,
  userId: number,
) {
  await tx.customerPaymentLedger.create({
    data: {
      customerId,
      entryType: LedgerEntryType.SALE_CHARGE,
      amount: totalAmount,
      refType: RefType.INVOICE,
      refId: commercialSaleId,
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
        refId: commercialSaleId,
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
  commercialSaleId: number,
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
      refId: commercialSaleId,
      notes: `Reversal — COM #${commercialSaleId}`,
      createdById: userId,
    },
  });

  await tx.customerBalance.update({
    where: { customerId },
    data: { pendingAmount: { decrement: netCharge } },
  });
}

// Voids every active CylinderTransaction of this invoice and undoes the exact
// godown movement each row caused — dispatches and returns alike.
async function reverseCylinderTransactions(
  tx: Prisma.TransactionClient,
  commercialSaleId: number,
  note: string,
) {
  const originalTxns = await tx.cylinderTransaction.findMany({
    where: {
      refType: RefType.INVOICE,
      refId: commercialSaleId,
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
        refId: commercialSaleId,
        voidedTxnId: txn.id,
        notes: note,
      },
    });

    await tx.godownInventory.update({
      where: { productId: txn.productId },
      data: {
        filledQty: { increment: -txn.filledDelta },
        emptyQty: { increment: -txn.emptyDelta },
      },
    });
  }
}

// Net cylinders still held by the customer from these items, grouped per product.
function outstandingCylinderQtys(items: OriginalSaleItem[]): ProductQty[] {
  const qtyByProduct = items.reduce<Record<number, number>>((acc, item) => {
    if (item.saleType !== CommercialSaleType.RENT || !item.productId) return acc;
    const held = item.cylindersDispatched - item.cylindersReturned;
    if (held === 0) return acc;
    acc[item.productId] = (acc[item.productId] ?? 0) + held;
    return acc;
  }, {});

  return Object.entries(qtyByProduct).map(([productId, quantity]) => ({
    productId: Number(productId),
    quantity,
  }));
}

// =============================================================================
// CREATE
// =============================================================================

export async function createCommercialSale(
  input: CreateCommercialSaleInput,
  userId: number,
) {
  const { items, returns, customerId, paidAmount, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (paidAmount > totalAmount)
    throw new BadRequestError("Paid amount cannot exceed total amount");

  return prisma.$transaction(async (tx) => {
    // 0. Collected cylinders must be ones the customer already held — checked
    //    before anything is dispatched on this invoice.
    await assertCustomerHoldsCylinders(tx, customerId, returns);

    // 1. Validate stock batches + build stockMap { stockId → { productId, … } }
    const stockMap = await assertAndFetchStocks(tx, items);

    // 2. Guard: the godown physically holds these filled cylinders
    const productQtys = resolveProductQtys(items, stockMap);
    await assertGodownHasFilled(tx, productQtys);

    // 3. Create sale header
    const sale = await tx.commercialSale.create({
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

    // 4. Set trNo now that we have the sale id
    await tx.commercialSale.update({
      where: { id: sale.id },
      data: { trNo: generateTrNo(sale.id) },
    });

    // 5. Items + Stock.quantity-- + CylinderTransactions
    const { rentQtys } = await writeSaleItems(tx, sale.id, items, stockMap);

    // 6. Godown cache — filled cylinders left the godown
    await applyGodownDelta(tx, productQtys, -1);

    // 7. Customer cylinder custody — RENT lines only
    await applyCustomerCylinderDelta(tx, customerId, rentQtys, 1);

    // 7b. Cylinders collected on this visit come off the customer's custody
    await writeRecordedReturns(tx, sale.id, customerId, returns);

    // 8. Customer money ledger + balance
    await applyCustomerLedger(
      tx,
      customerId,
      sale.id,
      totalAmount,
      paidAmount,
      userId,
    );

    return tx.commercialSale.findUniqueOrThrow({
      where: { id: sale.id },
      include: commercialSaleInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getCommercialSales(query: CommercialSaleQuery) {
  const { customerId, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    ...(customerId && { customerId }),
    ...((from || to) && {
      invoiceDate: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.commercialSale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { invoiceDate: "desc" },
      include: commercialSaleInclude,
    }),
    prisma.commercialSale.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getCommercialSaleById(id: number) {
  const sale = await prisma.commercialSale.findFirst({
    where: { id, isDeleted: false },
    include: commercialSaleInclude,
  });
  if (!sale) throw new NotFoundError(`Commercial sale #${id} not found`);
  return sale;
}

// =============================================================================
// UPDATE
// Strategy: reverse everything from the original invoice, then repost with new
// data. The CommercialSale row keeps its original id and trNo.
// =============================================================================

export async function updateCommercialSale(
  id: number,
  input: UpdateCommercialSaleInput,
  userId: number,
) {
  const { items, returns, customerId, paidAmount, discount, ...header } = input;
  const { totalAmount } = computeTotals(items, discount ?? 0);

  if (paidAmount > totalAmount)
    throw new BadRequestError("Paid amount cannot exceed total amount");

  return prisma.$transaction(async (tx) => {
    const original = await assertCommercialSaleExists(tx, id);

    // A return recorded against a *line* is its own later event — that invoice
    // cannot be rewritten. Cylinders collected on the invoice itself are part
    // of it, and are reversed and reposted like everything else below.
    assertNoReturnsRecorded(original.items);

    // ── REVERSE PHASE ────────────────────────────────────────────────────────

    // 1. Void cylinder ledger rows and undo their godown movement
    await reverseCylinderTransactions(tx, id, `Reversal — COM #${id} update`);

    // 2. Restore Stock.quantity from original items
    await restoreStockQuantities(tx, original.items);

    // 3. Give back the customer's cylinder custody
    await applyCustomerCylinderDelta(
      tx,
      original.customerId!,
      outstandingCylinderQtys(original.items),
      -1,
    );

    // 3b. Put back whatever this invoice collected, so the repost starts level
    await reverseRecordedReturns(tx, id, original.customerId!);

    // 4. Reverse customer money ledger
    await reverseCustomerLedger(
      tx,
      original.customerId!,
      id,
      Number(original.totalAmount ?? 0),
      Number(original.paidAmount),
      userId,
    );

    // 5. Delete original sale items (child rows, no independent ledger value)
    await tx.commercialSaleItem.deleteMany({ where: { commercialSaleId: id } });

    // ── REPOST PHASE ─────────────────────────────────────────────────────────

    // 6. Validate new stock batches + godown availability. Holdings are read
    //    after the reversal above, so they reflect the pre-invoice position.
    await assertCustomerHoldsCylinders(tx, customerId, returns);
    const stockMap = await assertAndFetchStocks(tx, items);
    const productQtys = resolveProductQtys(items, stockMap);
    await assertGodownHasFilled(tx, productQtys);

    // 7. Write corrected items + Stock.quantity-- + CylinderTransactions
    const { rentQtys } = await writeSaleItems(tx, id, items, stockMap);

    // 8. Apply new godown delta
    await applyGodownDelta(tx, productQtys, -1);

    // 9. Apply new cylinder custody + money ledger
    await applyCustomerCylinderDelta(tx, customerId, rentQtys, 1);
    await writeRecordedReturns(tx, id, customerId, returns);
    await applyCustomerLedger(
      tx,
      customerId,
      id,
      totalAmount,
      paidAmount,
      userId,
    );

    // 10. Update sale header in place (keeps original id and trNo)
    return tx.commercialSale.update({
      where: { id },
      data: {
        ...header,
        customerId,
        totalAmount,
        paidAmount,
        discount: discount ?? null,
        updatedById: userId,
      },
      include: commercialSaleInclude,
    });
  });
}

// =============================================================================
// CYLINDER RETURN
// A separate business event — days or weeks after the invoice. Never an edit.
// =============================================================================

export async function returnCylinders(
  id: number,
  input: CylinderReturnInput,
  userId: number,
) {
  return prisma.$transaction(async (tx) => {
    const sale = await assertCommercialSaleExists(tx, id);
    const itemMap = new Map(sale.items.map((item) => [item.id, item]));

    const returns = input.items.filter((row) => row.returnQty > 0);
    if (returns.length === 0)
      throw new BadRequestError("No cylinders to return");

    for (const { itemId, returnQty } of returns) {
      const item = itemMap.get(itemId);

      if (!item)
        throw new NotFoundError(`Line item #${itemId} not found on this sale`);

      if (item.saleType !== CommercialSaleType.RENT)
        throw new BadRequestError(
          "Only rented cylinders can be returned — line is an outright sale",
        );

      const outstanding = item.cylindersDispatched - item.cylindersReturned;

      if (returnQty > outstanding)
        throw new ConflictError("Return quantity exceeds cylinders held", {
          itemId,
          outstanding,
          returnQty,
        });

      // 1. Line-item custody counter
      await tx.commercialSaleItem.update({
        where: { id: itemId },
        data: { cylindersReturned: { increment: returnQty } },
      });

      // 2. Ledger row — empties arrive back in the godown
      await tx.cylinderTransaction.create({
        data: {
          productId: item.productId!,
          txnType: TxnType.CYLINDER_RETURN,
          filledDelta: 0,
          emptyDelta: returnQty,
          refType: RefType.INVOICE,
          refId: id,
          notes: `Cylinder return — COM #${id} item #${itemId}`,
        },
      });

      // 3. Godown cache
      await tx.godownInventory.update({
        where: { productId: item.productId! },
        data: { emptyQty: { increment: returnQty } },
      });

      // 4. Customer holds fewer cylinders now
      await tx.customerCylinderLedger.update({
        where: {
          productId_customerId: {
            productId: item.productId!,
            customerId: sale.customerId!,
          },
        },
        data: { pendingCylinder: { decrement: returnQty } },
      });
    }

    await tx.commercialSale.update({
      where: { id },
      data: { updatedById: userId },
    });

    return tx.commercialSale.findUniqueOrThrow({
      where: { id },
      include: commercialSaleInclude,
    });
  });
}

// =============================================================================
// DELETE
// Strategy: same reverse phase as update, then soft-delete the header.
// =============================================================================

export async function deleteCommercialSale(id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const original = await assertCommercialSaleExists(tx, id);

    // All rented cylinders must be back before the invoice can go away
    assertNoOutstandingCylinders(original.items);

    // 1. Void cylinder ledger rows and undo their godown movement
    await reverseCylinderTransactions(tx, id, `Reversal — COM #${id} deleted`);

    // 2. Restore Stock.quantity
    await restoreStockQuantities(tx, original.items);

    // 2b. Whatever this invoice collected goes back onto the customer
    await reverseRecordedReturns(tx, id, original.customerId!);

    // 3. Reverse customer money ledger
    await reverseCustomerLedger(
      tx,
      original.customerId!,
      id,
      Number(original.totalAmount ?? 0),
      Number(original.paidAmount),
      userId,
    );

    // 4. Soft-delete (items stay for audit, header hidden from queries)
    return tx.commercialSale.update({
      where: { id },
      data: { isDeleted: true, updatedById: userId },
    });
  });
}
