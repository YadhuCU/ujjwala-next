import { prisma } from "@/lib/prisma";
import { ProductType } from "@/generated/client";
import { writeStockAdjustment } from "@/module/stock-adjustment/stock-adjustment.service";

/**
 * Minimal rows for services under test. Everything takes overrides so a test
 * only states the part it cares about.
 */

let counter = 0;
const unique = () => ++counter;

export async function makeUser(name = "Test Owner") {
  const n = unique();
  return prisma.user.create({
    data: { username: `user-${n}`, name, password: "hashed-not-used" },
  });
}

export async function makeRole(name: string) {
  return prisma.role.create({ data: { name } });
}

/** A user holding the given roles, for the guards that count owners. */
export async function makeUserWithRoles(roleIds: number[], name = "Staff") {
  const user = await makeUser(name);

  await prisma.userRole.createMany({
    data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
  });

  return user;
}

export async function makeProduct(
  type: ProductType = ProductType.DOMESTIC,
  overrides: { name?: string; salePrice?: number } = {},
) {
  const n = unique();

  const product = await prisma.product.create({
    data: {
      name: overrides.name ?? `Product ${n}`,
      type,
      salePrice: overrides.salePrice ?? 1000,
    },
  });

  // Mirrors what the product service seeds on create
  await prisma.godownInventory.create({
    data: { productId: product.id, filledQty: 0, emptyQty: 0 },
  });

  return product;
}

export async function makeVendor() {
  const n = unique();
  return prisma.vendor.create({ data: { name: `Vendor ${n}` } });
}

export async function makeCustomer(overrides: { name?: string } = {}) {
  const n = unique();

  const customer = await prisma.customer.create({
    data: { name: overrides.name ?? `Customer ${n}`, initialPendingAmount: 0 },
  });

  await prisma.customerBalance.create({
    data: { customerId: customer.id, pendingAmount: 0 },
  });

  return customer;
}

/** A stock batch with no purchase behind it, for sale tests. */
export async function makeStock(productId: number, quantity = 100) {
  const n = unique();

  return prisma.stock.create({
    data: {
      batchNo: `BATCH-TEST-${n}`,
      productId,
      quantity,
      productCost: 800,
    },
  });
}

/**
 * Puts cylinders in the godown the way real opening stock arrives: through a
 * StockAdjustment and its ledger row. Writing GodownInventory directly would
 * seed a state that already violates the invariant the tests assert.
 */
export async function seedGodown(
  productId: number,
  { filledQty = 0, emptyQty = 0 }: { filledQty?: number; emptyQty?: number },
) {
  if (filledQty === 0 && emptyQty === 0) return;

  const seeder = await makeUser("Seed User");

  await prisma.$transaction((tx) =>
    writeStockAdjustment(
      tx,
      {
        productId,
        filledDelta: filledQty,
        emptyDelta: emptyQty,
        reason: "Test opening stock",
      },
      seeder.id,
    ),
  );
}

export async function godownOf(productId: number) {
  return prisma.godownInventory.findUniqueOrThrow({ where: { productId } });
}

export async function balanceOf(customerId: number) {
  const balance = await prisma.customerBalance.findUnique({
    where: { customerId },
  });
  return Number(balance?.pendingAmount ?? 0);
}

export async function custodyOf(customerId: number, productId: number) {
  const ledger = await prisma.customerCylinderLedger.findUnique({
    where: { productId_customerId: { productId, customerId } },
  });
  return ledger?.pendingCylinder ?? 0;
}

/**
 * The core invariant: GodownInventory is only ever a cache of the cylinder
 * ledger. Any service that writes one without the other breaks this.
 */
export async function assertGodownMatchesLedger(productId: number) {
  const [inventory, sums] = await Promise.all([
    prisma.godownInventory.findUniqueOrThrow({ where: { productId } }),
    prisma.cylinderTransaction.aggregate({
      where: { productId },
      _sum: { filledDelta: true, emptyDelta: true },
    }),
  ]);

  return {
    filled: [inventory.filledQty, sums._sum.filledDelta ?? 0] as const,
    empty: [inventory.emptyQty, sums._sum.emptyDelta ?? 0] as const,
  };
}

/**
 * The money equivalent: CustomerBalance is a cache of the payment ledger.
 */
export async function assertBalanceMatchesLedger(customerId: number) {
  const [balance, sum] = await Promise.all([
    prisma.customerBalance.findUniqueOrThrow({ where: { customerId } }),
    prisma.customerPaymentLedger.aggregate({
      where: { customerId },
      _sum: { amount: true },
    }),
  ]);

  return [
    Number(balance.pendingAmount),
    Number(sum._sum.amount ?? 0),
  ] as const;
}
