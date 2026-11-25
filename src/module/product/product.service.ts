import { prisma } from "@/lib/prisma";
import { Prisma, ProductType } from "@/generated/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type {
  CreateProductInput,
  ProductQuery,
  UpdateProductInput,
} from "./product.payload.schema";
import { isCylinderTypeProduct } from "./product.rules";
import { NAME_MAX_LENGTH, retiredName } from "@/lib/soft-delete";

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

// Whether a product is a cylinder decides which ledgers it posts to. Moving it
// across that line once it has history would strand what it already posted
// (DOMESTIC → ARB: its cylinder ledger and custody stop being read) or give
// existing batches no ledger rows (ARB → DOMESTIC: the next sale pushes the
// godown negative). A change within one side, or on a product with no
// history yet, is fine.
async function assertTypeChangeAllowed(
  tx: Prisma.TransactionClient,
  id: number,
  from: ProductType,
  to: ProductType,
) {
  if (isCylinderTypeProduct(from) === isCylinderTypeProduct(to)) return;

  const [batches, movements, holdings, openings] = await Promise.all([
    tx.stock.count({ where: { productId: id } }),
    tx.cylinderTransaction.count({ where: { productId: id } }),
    tx.customerCylinderLedger.count({
      where: { productId: id, pendingCylinder: { not: 0 } },
    }),
    tx.customerInitialCylinderBalance.count({
      where: { productId: id, qty: { gt: 0 } },
    }),
  ]);

  if (batches + movements + holdings + openings > 0)
    throw new ConflictError(
      `Cannot change ${from} to ${to} — this product already has stock or cylinder history. Create a new product instead.`,
      { batches, movements, holdings, openings },
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
    const product = await assertProductExists(tx, id);
    await assertTypeChangeAllowed(tx, id, product.type, input.type);

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
    const product = await assertProductExists(tx, id);
    await assertGodownEmpty(tx, id);
    await assertNoStockOnHand(tx, id);

    // Frees the name so the product can be added again (soft-delete.ts)
    return tx.product.update({
      where: { id },
      data: {
        isDeleted: true,
        name: retiredName(product.name, id, NAME_MAX_LENGTH.product),
      },
    });
  });
}
