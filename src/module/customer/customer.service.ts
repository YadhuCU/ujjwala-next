import { prisma } from "@/lib/prisma";
import { LedgerEntryType, Prisma, RefType } from "@/generated/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type {
  CreateCustomerInput,
  CustomerQuery,
  UpdateCustomerInput,
} from "./customer.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const customerInclude = {
  location: true,
  initialCylinderBalances: true,
} as const;

// =============================================================================
// GUARDS
// =============================================================================

async function assertCustomerExists(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const customer = await tx.customer.findFirst({
    where: { id, isDeleted: false },
    include: customerInclude,
  });

  if (!customer) throw new NotFoundError(`Customer #${id} not found`);
  return customer;
}

// Retiring a customer who still owes money or holds cylinders would hide those
// balances from every list while the ledger keeps carrying them.
async function assertCustomerSettled(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const [balance, cylinders] = await Promise.all([
    tx.customerBalance.findUnique({ where: { customerId: id } }),
    tx.customerCylinderLedger.findMany({
      where: { customerId: id, pendingCylinder: { gt: 0 } },
    }),
  ]);

  const pendingAmount = Number(balance?.pendingAmount ?? 0);
  const pendingCylinders = cylinders.reduce(
    (sum, row) => sum + row.pendingCylinder,
    0,
  );

  if (pendingAmount !== 0 || pendingCylinders > 0)
    throw new ConflictError(
      "Cannot delete — this customer still has an outstanding balance or cylinders",
      { pendingAmount, pendingCylinders },
    );
}

async function assertProductsExist(
  tx: Prisma.TransactionClient,
  productIds: number[],
) {
  if (productIds.length === 0) return;

  const products = await tx.product.findMany({
    where: { id: { in: productIds }, isDeleted: false },
    select: { id: true },
  });

  if (products.length !== new Set(productIds).size)
    throw new NotFoundError("One or more products were not found");
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

// Opening cylinder custody: the immutable record of what the customer held at
// migration, plus the live ledger seeded from it.
async function seedCylinderBalances(
  tx: Prisma.TransactionClient,
  customerId: number,
  balances: CreateCustomerInput["initialCylinderBalances"],
) {
  for (const { productId, qty } of balances) {
    await tx.customerInitialCylinderBalance.upsert({
      where: { customerId_productId: { customerId, productId } },
      update: { qty },
      create: { customerId, productId, qty },
    });

    await tx.customerCylinderLedger.upsert({
      where: { productId_customerId: { customerId, productId } },
      update: { pendingCylinder: qty },
      create: { customerId, productId, pendingCylinder: qty },
    });
  }
}

// =============================================================================
// CREATE
// =============================================================================

export async function createCustomer(
  input: CreateCustomerInput,
  userId: number,
) {
  const { initialCylinderBalances, initialPendingAmount, ...header } = input;

  return prisma.$transaction(async (tx) => {
    await assertProductsExist(
      tx,
      initialCylinderBalances.map((b) => b.productId),
    );

    const customer = await tx.customer.create({
      data: { ...header, initialPendingAmount },
    });

    // 1. Opening cylinder custody, per product
    await seedCylinderBalances(tx, customer.id, initialCylinderBalances);

    // 2. Opening money balance — one OPENING ledger row when there is a debt
    if (initialPendingAmount > 0) {
      await tx.customerPaymentLedger.create({
        data: {
          customerId: customer.id,
          entryType: LedgerEntryType.OPENING,
          amount: initialPendingAmount,
          refType: RefType.MANUAL,
          refId: customer.id,
          notes: "Opening balance at customer registration",
          createdById: userId,
        },
      });
    }

    // 3. The balance row always exists, even at 0 — everything downstream
    //    (payments, reversals) updates it rather than creating it
    await tx.customerBalance.create({
      data: { customerId: customer.id, pendingAmount: initialPendingAmount },
    });

    return tx.customer.findUniqueOrThrow({
      where: { id: customer.id },
      include: customerInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getCustomers(query: CustomerQuery) {
  const { search, locationId } = query;

  return prisma.customer.findMany({
    where: {
      isDeleted: false,
      ...(locationId && { locationId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    include: { location: true },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getCustomerById(id: number) {
  return assertCustomerExists(prisma, id);
}

// =============================================================================
// UPDATE
// Header only — opening balances are migration data and are never rewritten.
// =============================================================================

export async function updateCustomer(id: number, input: UpdateCustomerInput) {
  return prisma.$transaction(async (tx) => {
    await assertCustomerExists(tx, id);

    return tx.customer.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone ?? null,
        address: input.address ?? null,
        locationId: input.locationId ?? null,
        discount: input.discount ?? null,
        concernedPerson: input.concernedPerson ?? null,
        concernedPersonMobile: input.concernedPersonMobile ?? null,
        gstNumber: input.gstNumber ?? null,
      },
      include: customerInclude,
    });
  });
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteCustomer(id: number) {
  return prisma.$transaction(async (tx) => {
    await assertCustomerExists(tx, id);
    await assertCustomerSettled(tx, id);

    return tx.customer.update({ where: { id }, data: { isDeleted: true } });
  });
}
