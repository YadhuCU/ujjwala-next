import { prisma } from "@/lib/prisma";
import type {
  CreatePurchasePayloadInput,
  UpdatePurchasePayloadInput,
  PurchaseQuery,
} from "./purchase.payload.schema";
import {
  Prisma,
  ProductType,
  PurchaseType,
  RefType,
  TxnType,
} from "@/generated/client";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/errors";
import { isCylinderTypeProduct } from "@/module/product/product.rules";

// =============================================================================
// CONSTANTS
// =============================================================================

const purchaseInclude = {
  vendor: true,
  items: { include: { product: true } },
  stocks: { where: { isDeleted: false } },
} as const;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type PayloadItem = CreatePurchasePayloadInput["items"][number];

// A payload line enriched with the ProductType resolved from the DB.
type ItemWithProductType = PayloadItem & { productType: ProductType };

// The minimum shape needed to move inventory — satisfied both by payload items
// and by stored PurchaseItem rows (via their included product).
type InventoryItem = {
  productId: number;
  quantity: number;
  purchaseType: PurchaseType;
  productType: ProductType;
};

// =============================================================================
// PURE HELPERS
// =============================================================================

function generateBatchNo(
  purchaseId: number,
  productId: number,
  index: number,
): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // 20260611
  return `BATCH-${date}-P${purchaseId}-PR${productId}-${index + 1}`;
  // e.g. "BATCH-20260611-P42-PR3-1"
}

// Maps stored PurchaseItem rows (with product included) onto InventoryItem,
// so reverse phases can reuse the same helpers as the forward phase.
function toInventoryItems(
  items: { productId: number; quantity: number; purchaseType: PurchaseType; product: { type: ProductType } }[],
): InventoryItem[] {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    purchaseType: item.purchaseType,
    productType: item.product.type,
  }));
}

// =============================================================================
// GUARDS
// =============================================================================

async function assertPurchaseExists(tx: Prisma.TransactionClient, id: number) {
  const purchase = await tx.purchase.findFirst({
    where: { id, isDeleted: false },
    include: purchaseInclude,
  });
  if (!purchase) throw new NotFoundError(`Purchase #${id} not found`);
  return purchase;
}

// Resolves ProductType for every line — productType is never trusted from the
// client, it is always read from the Product row.
async function assertAndAttachProductTypes(
  tx: Prisma.TransactionClient,
  items: PayloadItem[],
): Promise<ItemWithProductType[]> {
  const productIds = [...new Set(items.map(({ productId }) => productId))];

  const products = await tx.product.findMany({
    where: { id: { in: productIds }, isDeleted: false },
    select: { id: true, type: true },
  });

  const productMap = new Map(products.map(({ id, type }) => [id, type]));

  return items.map((item) => {
    const productType = productMap.get(item.productId);

    if (!productType) {
      throw new NotFoundError(`Product #${item.productId} not found`);
    }

    return { ...item, productType };
  });
}

// A purchase can only be corrected while none of its batches have been sold.
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
    throw new ConflictError(
      "Cannot modify — stock batches from this purchase are used in sales",
    );
}

// FILL means the vendor refilled OUR empties, so the empties must exist first.
// Only cylinder-type products carry an empty balance.
async function assertEmptyStockAvailable(
  tx: Prisma.TransactionClient,
  items: InventoryItem[],
) {
  const fillItems = items.filter(
    (item) =>
      item.purchaseType === PurchaseType.FILL &&
      isCylinderTypeProduct(item.productType),
  );

  // Same product can appear on more than one line — check the summed quantity.
  const qtyByProduct = fillItems.reduce<Record<number, number>>((acc, item) => {
    acc[item.productId] = (acc[item.productId] ?? 0) + item.quantity;
    return acc;
  }, {});

  for (const [productId, quantity] of Object.entries(qtyByProduct)) {
    const inv = await tx.godownInventory.findUnique({
      where: { productId: Number(productId) },
    });

    if (!inv || inv.emptyQty < quantity) {
      throw new BadRequestError("Insufficient empty cylinders for product", {
        productId: Number(productId),
        available: inv?.emptyQty ?? 0,
        requested: quantity,
      });
    }
  }
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// Creates PurchaseItems + Stock batches, and appends CylinderTransactions
// for cylinder-type products only.
async function writePurchaseItems(
  tx: Prisma.TransactionClient,
  purchaseId: number,
  invoiceNo: string | undefined,
  vendorId: number,
  items: ItemWithProductType[],
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
    data: resolvedItems
      .filter((item) => isCylinderTypeProduct(item.productType))
      .map((item) => ({
        productId: item.productId,
        txnType:
          item.purchaseType === PurchaseType.FILL
            ? TxnType.PURCHASE_FILL
            : TxnType.PURCHASE_FULL,
        filledDelta: item.quantity,
        emptyDelta:
          item.purchaseType === PurchaseType.FILL ? -item.quantity : 0,
        refType: RefType.PURCHASE,
        refId: purchaseId,
        notes: `Purchase #${purchaseId}${invoiceNo ? ` · inv ${invoiceNo}` : ""}`,
      })),
  });
}

// Applies (+1) or reverses (-1) the GodownInventory cache for cylinder products.
async function applyGodownDelta(
  tx: Prisma.TransactionClient,
  items: InventoryItem[],
  direction: 1 | -1, // +1 apply, -1 reverse
) {
  for (const item of items) {
    if (!isCylinderTypeProduct(item.productType)) continue;

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

// Appends one inverted CylinderTransaction per active row of this purchase.
// Ledger rows are never updated or deleted — only voided by a reversal row.
async function reverseCylinderTransactions(
  tx: Prisma.TransactionClient,
  purchaseId: number,
  note: string,
) {
  const originalTxns = await tx.cylinderTransaction.findMany({
    where: {
      refType: RefType.PURCHASE,
      refId: purchaseId,
      voidedTxnId: null, // not itself a reversal
      voidedBy: { none: {} }, // nothing has voided it yet
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
        refId: purchaseId,
        voidedTxnId: txn.id,
        notes: note,
      },
    });
  }
}

// Soft-deletes the batches of a purchase, mangling batchNo so the unique
// slot is freed for the corrected batch numbers.
async function voidStockBatches(
  tx: Prisma.TransactionClient,
  purchaseId: number,
) {
  const activeStocks = await tx.stock.findMany({
    where: { purchaseId, isDeleted: false },
    select: { id: true, batchNo: true },
  });

  for (const stock of activeStocks) {
    await tx.stock.update({
      where: { id: stock.id },
      data: {
        isDeleted: true,
        batchNo: `${stock.batchNo}_VOID_${stock.id}`.slice(0, 50),
      },
    });
  }
}

// =============================================================================
// CREATE
// =============================================================================

export async function createPurchase(
  input: CreatePurchasePayloadInput,
  userId: number,
) {
  const { items: payloadItems, ...header } = input;
  const totalCost = payloadItems.reduce((sum, i) => sum + i.totalCost, 0);

  return prisma.$transaction(async (tx) => {
    // 1. Resolve ProductType for every line (server-side, never from client)
    const items = await assertAndAttachProductTypes(tx, payloadItems);

    // 2. Guard: enough empty cylinders for FILL items
    await assertEmptyStockAvailable(tx, items);

    // 3. Purchase header
    const purchase = await tx.purchase.create({
      data: { ...header, totalCost, createdById: userId, updatedById: userId },
    });

    // 4. PurchaseItems + Stocks + CylinderTransactions
    await writePurchaseItems(
      tx,
      purchase.id,
      header.invoiceNo,
      header.vendorId,
      items,
    );

    // 5. Godown cache
    await applyGodownDelta(tx, items, 1);

    return tx.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
      include: purchaseInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

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
      include: purchaseInclude,
    }),
    prisma.purchase.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getPurchaseById(id: number) {
  return assertPurchaseExists(prisma, id);
}

// =============================================================================
// UPDATE
// Strategy: void-and-repost. The Purchase row keeps its original id — only the
// CylinderTransactions show the correction chain (reversal rows → voidedTxnId).
// =============================================================================

export async function updatePurchase(
  id: number,
  input: UpdatePurchasePayloadInput,
  userId: number,
) {
  const { items: payloadItems, ...header } = input;
  const totalCost = payloadItems.reduce((sum, i) => sum + i.totalCost, 0);

  return prisma.$transaction(async (tx) => {
    // 1. Confirm exists
    const original = await assertPurchaseExists(tx, id);

    // 2. Guard: no stock batches from this purchase used in any sale
    await assertStockNotInUse(
      tx,
      original.stocks.map((s) => s.id),
    );

    // ── REVERSE PHASE ────────────────────────────────────────────────────────

    // 3. Append reversal CylinderTransactions for the original rows
    await reverseCylinderTransactions(tx, id, `Reversal — purchase #${id} update`);

    // 4. Reverse godown cache using the original items
    await applyGodownDelta(tx, toInventoryItems(original.items), -1);

    // 5. Soft-delete old stock batches (frees the batchNo unique slot)
    await voidStockBatches(tx, id);

    // 6. Hard-delete old purchase items (child rows, no ledger significance)
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

    // ── REPOST PHASE ─────────────────────────────────────────────────────────

    // 7. Resolve ProductType for the corrected lines
    const items = await assertAndAttachProductTypes(tx, payloadItems);

    // 8. Guard: new FILL items have enough empty qty (after the reversal above)
    await assertEmptyStockAvailable(tx, items);

    // 9. Write corrected items + stocks + fresh CylinderTransactions
    await writePurchaseItems(tx, id, header.invoiceNo, header.vendorId, items);

    // 10. Apply new godown delta
    await applyGodownDelta(tx, items, 1);

    // 11. Update Purchase header in place (keeps original id)
    return tx.purchase.update({
      where: { id },
      data: { ...header, totalCost, updatedById: userId },
      include: purchaseInclude,
    });
  });
}

// =============================================================================
// DELETE
// Strategy: same reverse phase as update, then soft-delete the header.
// PurchaseItems are kept for the audit trail.
// =============================================================================

export async function deletePurchase(id: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    // 1. Confirm exists
    const original = await assertPurchaseExists(tx, id);

    // 2. Guard: no stock batches in use
    await assertStockNotInUse(
      tx,
      original.stocks.map((s) => s.id),
    );

    // 3. Append reversal CylinderTransactions
    await reverseCylinderTransactions(
      tx,
      id,
      `Reversal — purchase #${id} deleted`,
    );

    // 4. Reverse godown cache
    await applyGodownDelta(tx, toInventoryItems(original.items), -1);

    // 5. Soft-delete stock batches
    await voidStockBatches(tx, id);

    // 6. Soft-delete purchase header
    return tx.purchase.update({
      where: { id },
      data: { isDeleted: true, updatedById: userId },
    });
  });
}
