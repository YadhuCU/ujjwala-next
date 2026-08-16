import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { invalidateRbac } from "@/lib/rbac";
import { Prisma, RbacAuditAction } from "@/generated/client";
import { diffCodes, writeRbacAudit } from "@/module/role/rbac-audit.service";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
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
// INTERNAL TYPES
// =============================================================================

/** Who is performing the change — required to stop privilege escalation. */
export type UserActor = {
  userId: number;
  isOwner: boolean;
  /** Recorded on the audit entry so it reads after the account is gone. */
  name?: string | null;
};

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
//
// Keyed on `isSystem`, not the role name: matching on "OWNER" meant that
// renaming the role made this query return nothing, so the guard returned
// without throwing — failing open exactly when it mattered.
async function assertNotLastOwner(
  tx: Prisma.TransactionClient,
  userId: number,
  action: string,
) {
  const owners = await tx.userRole.findMany({
    where: {
      role: { isSystem: true },
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

/**
 * Granting a system role is granting unrestricted access, so only someone who
 * already has it may do so. Without this, `user.update` alone was enough to
 * self-promote to owner: the existing guard only fired on demotion.
 */
async function assertMayAssignRoles(
  tx: Prisma.TransactionClient,
  targetId: number,
  roles: { id: number; isSystem: boolean }[],
  actor: UserActor,
) {
  if (actor.isOwner) return;

  if (roles.some((role) => role.isSystem))
    throw new ForbiddenError("Only an owner may grant a system role");

  // Changing your own roles is how a self-promotion starts; an owner has to do it.
  if (targetId === actor.userId) {
    const current = await tx.userRole.findMany({
      where: { userId: targetId },
      select: { roleId: true },
    });

    const before = new Set(current.map((row) => row.roleId));
    const after = new Set(roles.map((role) => role.id));
    const changed =
      before.size !== after.size || [...after].some((id) => !before.has(id));

    if (changed)
      throw new ForbiddenError("You cannot change your own role assignments");
  }
}

/**
 * A password reset is an account takeover if the target outranks you, so only
 * an owner may set another owner's password.
 */
async function assertMaySetPassword(
  tx: Prisma.TransactionClient,
  targetId: number,
  actor: UserActor,
) {
  if (actor.isOwner) return;

  const targetIsOwner = await tx.userRole.findFirst({
    where: { userId: targetId, role: { isSystem: true } },
    select: { id: true },
  });

  if (targetIsOwner)
    throw new ForbiddenError("Only an owner may change an owner's password");
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

async function replaceUserRoles(
  tx: Prisma.TransactionClient,
  userId: number,
  roleIds: number[],
) {
  // A user with no roles authenticates and then fails every request with no
  // cause to point at. Refuse rather than create that state.
  if (roleIds.length === 0)
    throw new BadRequestError("A user must hold at least one role");

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

// Roles used to be a read-only lookup living here. They are a module of their
// own now — see `src/module/role/role.service.ts`.

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

export async function updateUser(
  id: number,
  input: UpdateUserInput,
  actor: UserActor,
) {
  const { userRoles, password, ...rest } = input;

  return prisma.$transaction(async (tx) => {
    const existing = await assertUserExists(tx, id);
    const roles = await assertRolesExist(tx, userRoles);

    await assertMayAssignRoles(tx, id, roles, actor);
    if (password) await assertMaySetPassword(tx, id, actor);

    // Dropping the owner role counts as demoting them
    const keepsOwner = roles.some((role) => role.isSystem);
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

    const before = existing.userRoles.map((userRole) => userRole.role.name);

    await replaceUserRoles(tx, id, userRoles);

    // Their cached snapshot is now wrong; drop it so the change lands on the
    // next request instead of waiting out the TTL.
    invalidateRbac(id);

    // Role names rather than permission codes: what an administrator chose.
    const after = roles.map((role) => role.name);
    const change = diffCodes(before, after);

    if (change.added.length > 0 || change.removed.length > 0) {
      await writeRbacAudit(tx, {
        action: RbacAuditAction.USER_ROLES_CHANGED,
        actor,
        targetUserId: id,
        targetUserName: existing.name ?? existing.username,
        ...change,
      });
    }

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

    // Deactivation has to bite now, not in thirty seconds.
    invalidateRbac(id);

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

    const deleted = await tx.user.update({
      where: { id },
      data: { isDeleted: true, isActive: false },
    });

    // End their session now rather than at the end of the TTL.
    invalidateRbac(id);

    return deleted;
  });
}
