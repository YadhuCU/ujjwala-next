import { prisma } from "@/lib/prisma";
import type {
  CreatePurchasePayloadInput,
  UpdatePurchasePayloadInput,
  PurchaseQuery,
} from "./purchase.payload.schema";
import { Prisma, PurchaseType, RefType, TxnType } from "@/generated/client";
import { BadRequestError, NotFoundError } from "@/lib/errors";

const ERROR_MAP: Record<string, [number, string]> = {
  PURCHASE_NOT_FOUND: [404, "Purchase not found"],
  PURCHASE_STOCK_IN_USE: [
    409,
    "Cannor modify - stock batches from this purchase are in sales",
  ],
  INSUFFICIENT_EMPTY_STOCK: [400, "Insufficient empty cylinders for product"],
};

// ─── shared include ──────────────────────────────────────────────────────────

const purchaseInclude = {
  vendor: true,
  items: { include: { product: true } },
  stocks: { where: { isDeleted: false } },
} as const;

// ─── utility ──────────────────────────────────────────────────────────────────
// purchase.service.ts — inside writePurchaseItems
function generateBatchNo(
  purchaseId: number,
  productId: number,
  index: number,
): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // 20260611
  return `BATCH-${date}-P${purchaseId}-PR${productId}-${index + 1}`;
  // e.g. "BATCH-20260611-P42-PR3-1"
}

// ─── guard helpers ───────────────────────────────────────────────────────────

async function assertPurchaseExists(tx: Prisma.TransactionClient, id: number) {
  const purchase = await tx.purchase.findFirst({
    where: { id, isDeleted: false },
    include: purchaseInclude,
  });
  if (!purchase) throw new NotFoundError(ERROR_MAP.PURCHASE_NOT_FOUND[1]);
  return purchase;
}

async function assertStockNotInUse(
  tx: Prisma.TransactionClient,
  stockIds: number[],
) {
  if (stockIds.length === 0) return;
  const [dom, arb, com] = await Promise.all([
    tx.domSaleItem.count({ where: { stockId: { in: stockIds } } }),
    tx.arbSaleItem.count({ where: { stockId: { in: stockIds } } }),
    tx.commercialSaleItem.count({ where: { stockId: { in: stockIds } } }),
  ]);
  if (dom + arb + com > 0)
    throw new BadRequestError(ERROR_MAP.PURCHASE_STOCK_IN_USE[1]);
}

async function assertEmptyStockAvailable(
  tx: Prisma.TransactionClient,
  items: CreatePurchasePayloadInput["items"],
) {
  const fillItems = items.filter((i) => i.purchaseType === PurchaseType.FILL);
  for (const item of fillItems) {
    const inv = await tx.godownInventory.findUnique({
      where: { productId: item.productId },
    });
    if (!inv || inv.emptyQty < item.quantity) {
      throw new BadRequestError(
        ERROR_MAP.INSUFFICIENT_EMPTY_STOCK[1] + ":" + item.productId,
      );
    }
  }
}

// ─── inner helpers ───────────────────────────────────────────────────────────

async function writePurchaseItems(
  tx: Prisma.TransactionClient,
  purchaseId: number,
  invoiceNo: string | undefined,
  vendorId: number,
  items: CreatePurchasePayloadInput["items"],
) {
  // resolve batch numbers once — both tables must share the exact same value
  const resolvedItems = items.map((item, i) => ({
    ...item,
    batchNo:
      item.batchNo?.trim() || generateBatchNo(purchaseId, item.productId, i),
  }));

  await tx.purchaseItem.createMany({
    data: resolvedItems.map((item) => ({
      purchaseId,
      productId: item.productId,
      batchNo: item.batchNo,
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      purchaseType: item.purchaseType,
    })),
  });

  await tx.stock.createMany({
    data: resolvedItems.map((item) => ({
      batchNo: item.batchNo,
      productId: item.productId,
      invoiceNo: invoiceNo ?? null,
      quantity: item.quantity,
      productCost: item.unitCost,
      vendorId,
      purchaseId,
    })),
  });

  await tx.cylinderTransaction.createMany({
    data: resolvedItems.map((item) => ({
      productId: item.productId,
      txnType:
        item.purchaseType === PurchaseType.FILL
          ? TxnType.PURCHASE_FILL
          : TxnType.PURCHASE_FULL,
      filledDelta: item.quantity,
      emptyDelta: item.purchaseType === PurchaseType.FILL ? -item.quantity : 0,
      refType: RefType.PURCHASE,
      refId: purchaseId,
      notes: `Purchase #${purchaseId}${invoiceNo ? ` · inv ${invoiceNo}` : ""}`,
    })),
  });
}

async function applyGodownDelta(
  tx: Prisma.TransactionClient,
  items: Array<{
    productId: number;
    quantity: number;
    purchaseType: PurchaseType;
  }>,
  direction: 1 | -1, // +1 apply, -1 reverse
) {
  for (const item of items) {
    const isFill = item.purchaseType === PurchaseType.FILL;
    await tx.godownInventory.upsert({
      where: { productId: item.productId },
      update: {
        filledQty: { increment: direction * item.quantity },
        ...(isFill && { emptyQty: { increment: direction * -item.quantity } }),
      },
      create: {
        productId: item.productId,
        filledQty: direction === 1 ? item.quantity : 0,
        emptyQty: 0,
      },
    });
  }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────

export async function createPurchase(
  input: CreatePurchasePayloadInput,
  userId: number,
) {
  const { items, ...header } = input;
  const totalCost = items.reduce((sum, i) => sum + i.totalCost, 0);

  return prisma.$transaction(async (tx) => {
    // 1. Guard: enough empty cylinders for FILL items
    await assertEmptyStockAvailable(tx, items);

    // 2. Purchase header
    const purchase = await tx.purchase.create({
      data: { ...header, totalCost, createdById: userId, updatedById: userId },
    });

    // 3. PurchaseItems + Stocks + CylinderTransactions
    await writePurchaseItems(
      tx,
      purchase.id,
      header.invoiceNo,
      header.vendorId,
      items,
    );

    // 4. Godown cache
    await applyGodownDelta(tx, items, 1);

    return tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: purchaseInclude,
    });
  });
}

// ─── LIST ────────────────────────────────────────────────────────────────────

export async function getPurchases(query: PurchaseQuery) {
  const { vendorId, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    ...(vendorId && { vendorId }),
    ...((from || to) && {
      purchaseDate: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.purchase.findMany({
      where,
      skip,
      take: limit,
      orderBy: { purchaseDate: "desc" },
      include: { vendor: true, items: { include: { product: true } } },
    }),
    prisma.purchase.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// ─── SINGLE ──────────────────────────────────────────────────────────────────

export async function getPurchaseById(id: number) {
  return assertPurchaseExists(prisma, id);
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
// Strategy: update Purchase header in place, fully reverse+repost ledger entries.
// The Purchase row keeps its original ID — only the CylinderTransactions show the
// correction chain (reversal rows → voidedTxnId → original rows).

export async function updatePurchase(
  id: number,
  input: UpdatePurchasePayloadInput,
  userId: number,
) {
  const { items, ...header } = input;
  const totalCost = items?.reduce((sum, i) => sum + i.totalCost, 0);

  return prisma.$transaction(async (tx) => {
    // 1. Confirm exists
    const original = await assertPurchaseExists(tx, id);

    // 2. Guard: no stock batches from this purchase used in any sale
    const stockIds = original.stocks.map((s) => s.id);
    await assertStockNotInUse(tx, stockIds);

    // 3. Find original (non-reversed) ledger rows for this purchase
    const originalTxns = await tx.cylinderTransaction.findMany({
      where: {
        refType: RefType.PURCHASE,
        refId: id,
        voidedTxnId: null, // not itself a reversal
        voidedBy: { none: {} }, // nothing has voided it yet
      },
    });

    // 4. Append reversal CylinderTransaction for each original (one by one — need the id)
    for (const txn of originalTxns) {
      await tx.cylinderTransaction.create({
        data: {
          productId: txn.productId,
          txnType: txn.txnType,
          filledDelta: -txn.filledDelta,
          emptyDelta: -txn.emptyDelta,
          refType: RefType.PURCHASE,
          refId: id,
          voidedTxnId: txn.id,
          notes: `Reversal — purchase #${id} update`,
        },
      });
    }

    // 5. Reverse godown cache using original items
    await applyGodownDelta(tx, original.items, -1);

    // 6. Soft-delete old stock batches
    const activeStocks = await tx.stock.findMany({
      where: { purchaseId: id, isDeleted: false },
      select: { id: true, batchNo: true },
    });
    for (const s of activeStocks) {
      await tx.stock.update({
        where: { id: s.id },
        data: {
          isDeleted: true,
          batchNo: `${s.batchNo}_VOID_${s.id}`,
        },
      });
    }

    // 7. Hard-delete old purchase items (child rows, no ledger significance)
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

    // 8. Guard: new FILL items have enough empty qty (after reversal applied above)
    await assertEmptyStockAvailable(tx, items ?? []);

    // 9. Write corrected items + stocks + fresh CylinderTransactions
    await writePurchaseItems(tx, id, header.invoiceNo, header.vendorId, items);

    // 10. Apply new godown delta
    await applyGodownDelta(tx, items ?? [], 1);

    // 11. Update Purchase header
    return tx.purchase.update({
      where: { id },
      data: { ...header, totalCost, updatedById: userId },
      include: purchaseInclude,
    });
  });
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function deletePurchase(id: number) {
  return prisma.$transaction(async (tx) => {
    // 1. Confirm exists
    const original = await assertPurchaseExists(tx, id);

    // 2. Guard: no stock batches in use
    const stockIds = original.stocks.map((s) => s.id);
    await assertStockNotInUse(tx, stockIds);

    // 3. Reverse CylinderTransactions
    const originalTxns = await tx.cylinderTransaction.findMany({
      where: {
        refType: RefType.PURCHASE,
        refId: id,
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
          refType: RefType.PURCHASE,
          refId: id,
          voidedTxnId: txn.id,
          notes: `Reversal — purchase #${id} deleted`,
        },
      });
    }

    // 4. Reverse godown cache
    await applyGodownDelta(tx, original.items, -1);

    // 5. Soft-delete stocks
    // await tx.stock.updateMany({
    //   where: { purchaseId: id, isDeleted: false },
    //   data: { isDeleted: true },
    // });

    // 5. Soft-delete old stock batches
    const activeStocks = await tx.stock.findMany({
      where: { purchaseId: id, isDeleted: false },
      select: { id: true, batchNo: true },
    });
    for (const s of activeStocks) {
      await tx.stock.update({
        where: { id: s.id },
        data: {
          isDeleted: true,
          batchNo: `${s.batchNo}_VOID_${s.id}`,
        },
      });
    }

    // 6. Soft-delete purchase
    return tx.purchase.update({
      where: { id },
      data: { isDeleted: true },
    });
  });
}
