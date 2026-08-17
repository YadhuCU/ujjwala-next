import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type {
  CreateProductInput,
  ProductQuery,
  UpdateProductInput,
} from "./product.payload.schema";

// =============================================================================
// GUARDS
// =============================================================================

async function assertProductExists(tx: Prisma.TransactionClient, id: number) {
  const product = await tx.product.findFirst({
    where: { id, isDeleted: false },
  });

  if (!product) throw new NotFoundError(`Product #${id} not found`);
  return product;
}

// Retiring a product the godown still holds would strand those cylinders: the
// ledger keeps counting them while the product disappears from every dropdown.
async function assertGodownEmpty(tx: Prisma.TransactionClient, id: number) {
  const inventory = await tx.godownInventory.findUnique({
    where: { productId: id },
  });

  if (!inventory) return;

  if (inventory.filledQty > 0 || inventory.emptyQty > 0)
    throw new ConflictError(
      "Cannot delete — the godown still holds cylinders of this product",
      { filledQty: inventory.filledQty, emptyQty: inventory.emptyQty },
    );
}

// Batches with stock left are the same problem seen from the Stock side.
async function assertNoStockOnHand(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const batches = await tx.stock.count({
    where: { productId: id, isDeleted: false, quantity: { gt: 0 } },
  });

  if (batches > 0)
    throw new ConflictError(
      "Cannot delete — stock batches of this product still have quantity",
      { batches },
    );
}

// =============================================================================
// CREATE
// Every product gets its GodownInventory row up front, so the cylinder ledger
// always has somewhere to post and reads never have to handle a missing row.
// =============================================================================

export async function createProduct(input: CreateProductInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({ data: input });

    await tx.godownInventory.create({
      data: { productId: product.id, filledQty: 0, emptyQty: 0 },
    });

    return product;
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getProducts(query: ProductQuery) {
  const { type, search } = query;

  return prisma.product.findMany({
    where: {
      isDeleted: false,
      ...(type && { type }),
      ...(search && {
        name: { contains: search, mode: "insensitive" as const },
      }),
    },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getProductById(id: number) {
  return assertProductExists(prisma, id);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateProduct(id: number, input: UpdateProductInput) {
  return prisma.$transaction(async (tx) => {
    await assertProductExists(tx, id);

    return tx.product.update({
      where: { id },
      data: {
        name: input.name,
        type: input.type,
        weight: input.weight ?? null,
        salePrice: input.salePrice ?? null,
      },
    });
  });
}

// =============================================================================
// DELETE
// Soft delete only — history keeps pointing at the product, it just leaves the
// dropdowns.
// =============================================================================

export async function deleteProduct(id: number) {
  return prisma.$transaction(async (tx) => {
    await assertProductExists(tx, id);
    await assertGodownEmpty(tx, id);
    await assertNoStockOnHand(tx, id);

    return tx.product.update({ where: { id }, data: { isDeleted: true } });
  });
}
