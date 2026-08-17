import { prisma } from "@/lib/prisma";
import { Prisma, RefType, TxnType } from "@/generated/client";
import { BadRequestError, NotFoundError } from "@/lib/errors";
import type {
  CreateStockAdjustmentInput,
  StockAdjustmentQuery,
} from "./stock-adjustment.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const stockAdjustmentInclude = {
  product: true,
  createdBy: { select: { id: true, name: true } },
} as const;

// =============================================================================
// GUARDS
// =============================================================================

// The godown can never hold a negative number of cylinders — an adjustment that
// would push it below zero is a data-entry error, not a correction.
async function assertGodownStaysNonNegative(
  tx: Prisma.TransactionClient,
  input: CreateStockAdjustmentInput,
) {
  const product = await tx.product.findFirst({
    where: { id: input.productId, isDeleted: false },
  });

  if (!product) throw new NotFoundError(`Product #${input.productId} not found`);

  const inv = await tx.godownInventory.findUnique({
    where: { productId: input.productId },
  });

  const filledQty = inv?.filledQty ?? 0;
  const emptyQty = inv?.emptyQty ?? 0;

  if (filledQty + input.filledDelta < 0)
    throw new BadRequestError("Adjustment would make filled stock negative", {
      productId: input.productId,
      filledQty,
      filledDelta: input.filledDelta,
    });

  if (emptyQty + input.emptyDelta < 0)
    throw new BadRequestError("Adjustment would make empty stock negative", {
      productId: input.productId,
      emptyQty,
      emptyDelta: input.emptyDelta,
    });

  return { filledQty, emptyQty };
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// Always three writes together: the StockAdjustment carrying the reason, the
// ADJUSTMENT CylinderTransaction carrying the movement, and the godown cache.
// Exported so other modules (stock) can post an adjustment inside their own
// transaction instead of writing raw ledger rows.
export async function writeStockAdjustment(
  tx: Prisma.TransactionClient,
  input: CreateStockAdjustmentInput,
  userId: number,
) {
  // 1. Guard: resulting godown quantities stay >= 0
  await assertGodownStaysNonNegative(tx, input);

  // 2. The adjustment record — this is where the reason lives
  const adjustment = await tx.stockAdjustment.create({
    data: {
      productId: input.productId,
      filledDelta: input.filledDelta,
      emptyDelta: input.emptyDelta,
      reason: input.reason,
      createdById: userId,
    },
    include: stockAdjustmentInclude,
  });

  // 3. The ledger row — refId points back at the adjustment, so no movement
  //    is ever anonymous
  await tx.cylinderTransaction.create({
    data: {
      productId: input.productId,
      txnType: TxnType.ADJUSTMENT,
      filledDelta: input.filledDelta,
      emptyDelta: input.emptyDelta,
      refType: RefType.MANUAL,
      refId: adjustment.id,
      notes: input.reason,
    },
  });

  // 4. Godown cache
  await tx.godownInventory.upsert({
    where: { productId: input.productId },
    update: {
      filledQty: { increment: input.filledDelta },
      emptyQty: { increment: input.emptyDelta },
    },
    create: {
      productId: input.productId,
      filledQty: input.filledDelta,
      emptyQty: input.emptyDelta,
    },
  });

  return adjustment;
}

// =============================================================================
// CREATE
// There is deliberately no update or delete — post a correcting adjustment.
// =============================================================================

export async function createStockAdjustment(
  input: CreateStockAdjustmentInput,
  userId: number,
) {
  return prisma.$transaction((tx) => writeStockAdjustment(tx, input, userId));
}

// =============================================================================
// LIST
// =============================================================================

export async function getStockAdjustments(query: StockAdjustmentQuery) {
  const { productId, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(productId && { productId }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.stockAdjustment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: stockAdjustmentInclude,
    }),
    prisma.stockAdjustment.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getStockAdjustmentById(id: number) {
  const adjustment = await prisma.stockAdjustment.findUnique({
    where: { id },
    include: stockAdjustmentInclude,
  });

  if (!adjustment) throw new NotFoundError(`Stock adjustment #${id} not found`);
  return adjustment;
}
