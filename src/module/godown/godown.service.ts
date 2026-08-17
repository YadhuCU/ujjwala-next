import { prisma } from "@/lib/prisma";
import { isCylinderTypeProduct } from "@/module/product/product.rules";
import type { GodownMovementQuery } from "./godown.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const movementInclude = {
  product: { select: { id: true, name: true } },
} as const;

// =============================================================================
// STATUS
// Per product: what the godown holds, what customers hold, and what is left in
// the batches. Only DOMESTIC and COMMERCIAL appear — ARB and OTHER never touch
// the cylinder ledger, so a godown row for them would always read zero.
// =============================================================================

export async function getGodownStatus() {
  const [products, inventories, ledgerSums, custody, batches] =
    await Promise.all([
      prisma.product.findMany({
        where: { isDeleted: false },
        select: { id: true, name: true, type: true, weight: true },
        orderBy: { name: "asc" },
      }),
      prisma.godownInventory.findMany(),
      // The ledger is the source of truth; the cache above is only a cache
      prisma.cylinderTransaction.groupBy({
        by: ["productId"],
        _sum: { filledDelta: true, emptyDelta: true },
      }),
      prisma.customerCylinderLedger.groupBy({
        by: ["productId"],
        where: { pendingCylinder: { gt: 0 } },
        _sum: { pendingCylinder: true },
      }),
      prisma.stock.groupBy({
        by: ["productId"],
        where: { isDeleted: false, quantity: { gt: 0 } },
        _sum: { quantity: true },
        _count: true,
      }),
    ]);

  const inventoryByProduct = new Map(inventories.map((i) => [i.productId, i]));
  const ledgerByProduct = new Map(ledgerSums.map((l) => [l.productId, l._sum]));
  const custodyByProduct = new Map(
    custody.map((c) => [c.productId, c._sum.pendingCylinder ?? 0]),
  );
  const batchByProduct = new Map(
    batches.map((b) => [b.productId, { qty: b._sum.quantity ?? 0, count: b._count }]),
  );

  const rows = products
    .filter((product) => isCylinderTypeProduct(product.type))
    .map((product) => {
      const inventory = inventoryByProduct.get(product.id);
      const ledger = ledgerByProduct.get(product.id);

      const filledQty = inventory?.filledQty ?? 0;
      const emptyQty = inventory?.emptyQty ?? 0;
      const ledgerFilled = ledger?.filledDelta ?? 0;
      const ledgerEmpty = ledger?.emptyDelta ?? 0;
      const batch = batchByProduct.get(product.id);

      return {
        productId: product.id,
        productName: product.name,
        productType: product.type,
        weight: product.weight ?? undefined,

        filledQty,
        emptyQty,
        totalInGodown: filledQty + emptyQty,

        /** Cylinders of this product currently with customers (rented out). */
        withCustomers: custodyByProduct.get(product.id) ?? 0,

        /** Sellable stock, which is batch quantity rather than godown count. */
        batchQty: batch?.qty ?? 0,
        batchCount: batch?.count ?? 0,

        // Re-derived from the append-only ledger so the page can show whether
        // the cache still agrees with it.
        ledgerFilled,
        ledgerEmpty,
        inSync: filledQty === ledgerFilled && emptyQty === ledgerEmpty,
      };
    });

  const totals = rows.reduce(
    (acc, row) => ({
      filledQty: acc.filledQty + row.filledQty,
      emptyQty: acc.emptyQty + row.emptyQty,
      withCustomers: acc.withCustomers + row.withCustomers,
      outOfSync: acc.outOfSync + (row.inSync ? 0 : 1),
    }),
    { filledQty: 0, emptyQty: 0, withCustomers: 0, outOfSync: 0 },
  );

  return { rows, totals };
}

export type GodownStatusResponse = Awaited<ReturnType<typeof getGodownStatus>>;

// =============================================================================
// MOVEMENTS
// The cylinder ledger itself — every row that moved the numbers above.
// =============================================================================

export async function getGodownMovements(query: GodownMovementQuery) {
  const { productId, txnType, from, to, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    ...(productId && { productId }),
    ...(txnType && { txnType }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.cylinderTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "desc" },
      include: movementInclude,
    }),
    prisma.cylinderTransaction.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
