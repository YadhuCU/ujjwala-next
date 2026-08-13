import { prisma } from "@/lib/prisma";
import { Prisma, ProductType } from "@/generated/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { isCylinderTypeProduct } from "@/module/product/product.rules";
import { writeStockAdjustment } from "@/module/stock-adjustment/stock-adjustment.service";
import type {
  CreateStockInput,
  DeleteStockInput,
  StockQuery,
  UpdateStockInput,
} from "./stock.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const stockInclude = {
  product: true,
  vendor: true,
} as const;

// =============================================================================
// GUARDS
// =============================================================================

async function assertStockExists(tx: Prisma.TransactionClient, id: number) {
  const stock = await tx.stock.findFirst({
    where: { id, isDeleted: false },
    include: stockInclude,
  });

  if (!stock) throw new NotFoundError(`Stock batch #${id} not found`);
  return stock;
}

// Batches born from a purchase belong to that purchase — editing them here
// would desync PurchaseItem, the cylinder ledger and the godown cache.
function assertManualBatch(stock: { purchaseId: number | null }) {
  if (stock.purchaseId !== null)
    throw new ConflictError(
      "This batch came from a purchase — edit or delete the purchase instead",
    );
}

async function assertBatchNotSold(tx: Prisma.TransactionClient, id: number) {
  const [dom, arb, com] = await Promise.all([
    tx.domSaleItem.count({ where: { stockId: id } }),
    tx.arbSaleItem.count({ where: { stockId: id } }),
    tx.commercialSaleItem.count({ where: { stockId: id } }),
  ]);

  if (dom + arb + com > 0)
    throw new ConflictError("Cannot modify — this batch is used in sales");
}

async function assertProductExists(
  tx: Prisma.TransactionClient,
  productId: number,
) {
  const product = await tx.product.findFirst({
    where: { id: productId, isDeleted: false },
    select: { id: true, type: true },
  });

  if (!product) throw new NotFoundError(`Product #${productId} not found`);
  return product;
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// A manual batch has no purchase behind it, so nothing else would tell the
// cylinder ledger those cylinders exist. Post an ADJUSTMENT for the difference
// so GodownInventory keeps matching SUM(CylinderTransaction).
async function postManualQuantityDelta(
  tx: Prisma.TransactionClient,
  productId: number,
  productType: ProductType,
  filledDelta: number,
  reason: string,
  userId: number,
) {
  if (!isCylinderTypeProduct(productType)) return;
  if (filledDelta === 0) return;

  await writeStockAdjustment(
    tx,
    { productId, filledDelta, emptyDelta: 0, reason },
    userId,
  );
}

// =============================================================================
// CREATE
// =============================================================================

export async function createStock(input: CreateStockInput, userId: number) {
  const { reason, ...batch } = input;

  return prisma.$transaction(async (tx) => {
    const product = await assertProductExists(tx, batch.productId);

    const stock = await tx.stock.create({
      data: {
        batchNo: batch.batchNo,
        productId: batch.productId,
        invoiceNo: batch.invoiceNo ?? null,
        quantity: batch.quantity,
        productCost: batch.productCost ?? null,
      },
    });

    await postManualQuantityDelta(
      tx,
      product.id,
      product.type,
      batch.quantity,
      `${reason} (manual batch ${stock.batchNo})`,
      userId,
    );

    return tx.stock.findUniqueOrThrow({
      where: { id: stock.id },
      include: stockInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getStocks(query: StockQuery) {
  const { type, productId, search, includeEmpty } = query;

  return prisma.stock.findMany({
    where: {
      isDeleted: false,
      ...(type && { product: { type } }),
      ...(productId && { productId }),
      ...(!includeEmpty && { quantity: { gt: 0 } }),
      ...(search && {
        OR: [
          { batchNo: { contains: search, mode: "insensitive" as const } },
          { invoiceNo: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    include: stockInclude,
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getStockById(id: number) {
  return assertStockExists(prisma, id);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateStock(
  id: number,
  input: UpdateStockInput,
  userId: number,
) {
  const { reason, ...batch } = input;

  return prisma.$transaction(async (tx) => {
    const original = await assertStockExists(tx, id);

    assertManualBatch(original);
    await assertBatchNotSold(tx, id);

    const product = await assertProductExists(tx, batch.productId);

    // Moving a batch to another product means removing it from the old one
    if (original.productId && original.productId !== batch.productId) {
      const originalProduct = await assertProductExists(tx, original.productId);

      await postManualQuantityDelta(
        tx,
        originalProduct.id,
        originalProduct.type,
        -original.quantity,
        `${reason} (batch ${original.batchNo} moved to another product)`,
        userId,
      );

      await postManualQuantityDelta(
        tx,
        product.id,
        product.type,
        batch.quantity,
        `${reason} (batch ${original.batchNo} moved from another product)`,
        userId,
      );
    } else {
      await postManualQuantityDelta(
        tx,
        product.id,
        product.type,
        batch.quantity - original.quantity,
        `${reason} (manual batch ${original.batchNo})`,
        userId,
      );
    }

    return tx.stock.update({
      where: { id },
      data: {
        batchNo: batch.batchNo,
        productId: batch.productId,
        invoiceNo: batch.invoiceNo ?? null,
        quantity: batch.quantity,
        productCost: batch.productCost ?? null,
      },
      include: stockInclude,
    });
  });
}

// =============================================================================
// DELETE
// Soft delete, mangling batchNo so the unique slot is freed, and taking the
// remaining quantity back out of the godown.
// =============================================================================

export async function deleteStock(
  id: number,
  input: DeleteStockInput,
  userId: number,
) {
  return prisma.$transaction(async (tx) => {
    const original = await assertStockExists(tx, id);

    assertManualBatch(original);
    await assertBatchNotSold(tx, id);

    if (original.productId) {
      const product = await assertProductExists(tx, original.productId);

      await postManualQuantityDelta(
        tx,
        product.id,
        product.type,
        -original.quantity,
        `${input.reason} (manual batch ${original.batchNo} removed)`,
        userId,
      );
    }

    return tx.stock.update({
      where: { id },
      data: {
        isDeleted: true,
        quantity: 0,
        batchNo: `${original.batchNo}_VOID_${original.id}`.slice(0, 50),
      },
    });
  });
}
