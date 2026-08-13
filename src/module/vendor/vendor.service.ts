import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import type {
  CreateVendorInput,
  UpdateVendorInput,
  VendorQuery,
} from "./vendor.payload.schema";

// =============================================================================
// GUARDS
// =============================================================================

async function assertVendorExists(tx: Prisma.TransactionClient, id: number) {
  const vendor = await tx.vendor.findFirst({
    where: { id, isDeleted: false },
  });

  if (!vendor) throw new NotFoundError(`Vendor #${id} not found`);
  return vendor;
}

// Purchases and their batches point at the vendor with `onDelete: Restrict`.
// Retiring one with history would orphan that paperwork in the UI.
async function assertVendorHasNoHistory(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const [purchases, stocks] = await Promise.all([
    tx.purchase.count({ where: { vendorId: id, isDeleted: false } }),
    tx.stock.count({ where: { vendorId: id, isDeleted: false } }),
  ]);

  if (purchases + stocks > 0)
    throw new ConflictError(
      "Cannot delete — this vendor has purchases or stock batches",
      { purchases, stocks },
    );
}

// =============================================================================
// CREATE
// =============================================================================

export async function createVendor(input: CreateVendorInput) {
  return prisma.vendor.create({ data: input });
}

// =============================================================================
// LIST
// =============================================================================

export async function getVendors(query: VendorQuery) {
  const { search } = query;

  return prisma.vendor.findMany({
    where: {
      isDeleted: false,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { phone: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getVendorById(id: number) {
  return assertVendorExists(prisma, id);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateVendor(id: number, input: UpdateVendorInput) {
  return prisma.$transaction(async (tx) => {
    await assertVendorExists(tx, id);

    return tx.vendor.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone ?? null,
        address: input.address ?? null,
        gstNumber: input.gstNumber ?? null,
      },
    });
  });
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteVendor(id: number) {
  return prisma.$transaction(async (tx) => {
    await assertVendorExists(tx, id);
    await assertVendorHasNoHistory(tx, id);

    return tx.vendor.update({ where: { id }, data: { isDeleted: true } });
  });
}
