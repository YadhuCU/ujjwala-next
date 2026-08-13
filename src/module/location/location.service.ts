import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import { NotFoundError } from "@/lib/errors";
import type {
  CreateLocationInput,
  LocationQuery,
  UpdateLocationInput,
} from "./location.payload.schema";

// =============================================================================
// GUARDS
// =============================================================================

async function assertLocationExists(
  tx: Prisma.TransactionClient,
  id: number,
) {
  const location = await tx.location.findUnique({ where: { id } });

  if (!location) throw new NotFoundError(`Location #${id} not found`);
  return location;
}

// =============================================================================
// CREATE
// =============================================================================

export async function createLocation(input: CreateLocationInput) {
  return prisma.location.create({ data: input });
}

// =============================================================================
// LIST
// =============================================================================

export async function getLocations(query: LocationQuery) {
  const { search } = query;

  return prisma.location.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { district: { contains: search, mode: "insensitive" as const } },
          { locality: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    },
    orderBy: { createdAt: "desc" },
  });
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getLocationById(id: number) {
  return assertLocationExists(prisma, id);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateLocation(id: number, input: UpdateLocationInput) {
  return prisma.$transaction(async (tx) => {
    await assertLocationExists(tx, id);

    return tx.location.update({
      where: { id },
      data: {
        name: input.name,
        district: input.district ?? null,
        locality: input.locality ?? null,
        pincode: input.pincode ?? null,
      },
    });
  });
}

// =============================================================================
// DELETE
// Locations are loose master data with no history of their own, so this is a
// hard delete — Customer.locationId is `onDelete: SetNull`, so customers keep
// their records and simply lose the grouping.
// =============================================================================

export async function deleteLocation(id: number) {
  return prisma.$transaction(async (tx) => {
    await assertLocationExists(tx, id);

    return tx.location.delete({ where: { id } });
  });
}
