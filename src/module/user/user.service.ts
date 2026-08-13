import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { ROLES } from "@/lib/permissions";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserQuery,
} from "./user.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const userInclude = {
  userRoles: { include: { role: true } },
} as const;

const PASSWORD_SALT_ROUNDS = 10;

// =============================================================================
// GUARDS
// =============================================================================

async function assertUserExists(tx: Prisma.TransactionClient, id: number) {
  const user = await tx.user.findFirst({
    where: { id, isDeleted: false },
    include: userInclude,
  });

  if (!user) throw new NotFoundError(`User #${id} not found`);
  return user;
}

// Roles come from the client as ids — every one of them has to be real.
async function assertRolesExist(
  tx: Prisma.TransactionClient,
  roleIds: number[],
) {
  const roles = await tx.role.findMany({ where: { id: { in: roleIds } } });

  if (roles.length !== new Set(roleIds).size)
    throw new BadRequestError("Invalid role(s) provided");

  return roles;
}

// Locking every owner out of the system is unrecoverable without DB access, so
// the last active owner cannot be deleted, deactivated, or demoted.
async function assertNotLastOwner(
  tx: Prisma.TransactionClient,
  userId: number,
  action: string,
) {
  const owners = await tx.userRole.findMany({
    where: {
      role: { name: ROLES.OWNER },
      user: { isDeleted: false, isActive: true },
    },
    select: { userId: true },
  });

  const isOwner = owners.some((o) => o.userId === userId);
  if (!isOwner) return;

  if (new Set(owners.map((o) => o.userId)).size <= 1)
    throw new ConflictError(`Cannot ${action} the last active owner`);
}

function assertNotSelf(userId: number, actorId: number, action: string) {
  if (userId === actorId)
    throw new BadRequestError(`You cannot ${action} your own account`);
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

async function replaceUserRoles(
  tx: Prisma.TransactionClient,
  userId: number,
  roleIds: number[],
) {
  await tx.userRole.deleteMany({ where: { userId } });

  await tx.userRole.createMany({
    data: roleIds.map((roleId) => ({ userId, roleId })),
    skipDuplicates: true,
  });
}

// =============================================================================
// CREATE
// =============================================================================

export async function createUser(input: CreateUserInput) {
  const { userRoles, password, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    await assertRolesExist(tx, userRoles);

    const user = await tx.user.create({
      data: {
        ...rest,
        password: await bcrypt.hash(password, PASSWORD_SALT_ROUNDS),
      },
    });

    await replaceUserRoles(tx, user.id, userRoles);

    return tx.user.findUniqueOrThrow({
      where: { id: user.id },
      include: userInclude,
    });
  });
}

// =============================================================================
// ROLES
// Read-only lookup — roles and their permissions are seeded, not managed in-app.
// =============================================================================

export async function getRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

// =============================================================================
// LIST
// =============================================================================

export async function getUsers(query: UserQuery) {
  const { search, isActive, page, limit } = query;
  const skip = (page - 1) * limit;

  const where = {
    isDeleted: false,
    ...(isActive !== undefined && { isActive }),
    ...(search && {
      OR: [
        { username: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: userInclude,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getUserById(id: number) {
  return assertUserExists(prisma, id);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateUser(id: number, input: UpdateUserInput) {
  const { userRoles, password, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    await assertUserExists(tx, id);
    const roles = await assertRolesExist(tx, userRoles);

    // Dropping the owner role counts as demoting them
    const keepsOwner = roles.some((role) => role.name === ROLES.OWNER);
    if (!keepsOwner) await assertNotLastOwner(tx, id, "demote");

    await tx.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password && {
          password: await bcrypt.hash(password, PASSWORD_SALT_ROUNDS),
        }),
      },
    });

    await replaceUserRoles(tx, id, userRoles);

    return tx.user.findUniqueOrThrow({ where: { id }, include: userInclude });
  });
}

// =============================================================================
// ACTIVATE / DEACTIVATE
// =============================================================================

export async function setUserActive(
  id: number,
  isActive: boolean,
  actorId: number,
) {
  return prisma.$transaction(async (tx) => {
    await assertUserExists(tx, id);

    if (!isActive) {
      assertNotSelf(id, actorId, "deactivate");
      await assertNotLastOwner(tx, id, "deactivate");
    }

    await tx.user.update({ where: { id }, data: { isActive } });

    return tx.user.findUniqueOrThrow({ where: { id }, include: userInclude });
  });
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteUser(id: number, actorId: number) {
  return prisma.$transaction(async (tx) => {
    await assertUserExists(tx, id);

    assertNotSelf(id, actorId, "delete");
    await assertNotLastOwner(tx, id, "delete");

    return tx.user.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });
  });
}
