import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/client";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { PERMISSION_REGISTRY, type Permission } from "@/lib/permissions";
import { invalidateRbac } from "@/lib/rbac";
import { RbacAuditAction } from "@/generated/client";
import { diffCodes, writeRbacAudit } from "./rbac-audit.service";
import type {
  CreateRoleInput,
  RoleQuery,
  UpdateRoleInput,
} from "./role.payload.schema";

// =============================================================================
// CONSTANTS
// =============================================================================

const roleInclude = {
  rolePermissions: { include: { permission: { select: { code: true } } } },
  _count: { select: { userRoles: true } },
} as const;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Who is performing the change. Only a system-role holder may touch a system
 * role, and nobody may grant a permission they do not themselves hold — that
 * would turn `role.update` into a way to mint unlimited access.
 */
export type RoleActor = {
  userId: number;
  permissions: Permission[];
  isOwner: boolean;
  /** Recorded on the audit entry so it still reads after the account is gone. */
  name?: string | null;
};

// =============================================================================
// GUARDS
// =============================================================================

async function assertRoleExists(tx: Prisma.TransactionClient, id: number) {
  const role = await tx.role.findUnique({ where: { id }, include: roleInclude });

  if (!role) throw new NotFoundError(`Role #${id} not found`);
  return role;
}

// A system role is the way back in after a misconfiguration, so it cannot be
// renamed, re-scoped or removed — by anyone, including an owner.
function assertRoleEditable(role: { isSystem: boolean; name: string }) {
  if (role.isSystem)
    throw new ForbiddenError(
      `"${role.name}" is a system role and cannot be modified. It always holds every permission so there is always a way back in.`,
    );
}

// Case-insensitive: the DB unique index is not, so "Owner" and "OWNER" could
// otherwise coexist and make role names ambiguous to read.
async function assertNameAvailable(
  tx: Prisma.TransactionClient,
  name: string,
  excludeId?: number,
) {
  const clash = await tx.role.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { id: true, name: true },
  });

  if (clash) throw new ConflictError(`A role named "${clash.name}" already exists`);
}

/**
 * Nobody may grant more than they hold. Without this, anyone with `role.update`
 * could create a role carrying every permission and assign it to themselves,
 * which makes every other guard decorative.
 */
function assertMayGrant(actor: RoleActor, codes: Permission[]) {
  if (actor.isOwner) return;

  const held = new Set(actor.permissions);
  const excess = codes.filter((code) => !held.has(code));

  if (excess.length > 0)
    throw new ForbiddenError(
      `You cannot grant permissions you do not hold yourself: ${excess.join(", ")}`,
    );
}

// Deleting a role cascades to user_roles, which would silently strip it from
// its holders and can leave a user with no roles at all — a state the API
// forbids but the database allows, and which reads as "logged in but every
// request fails" with no cause to point at.
async function assertRoleUnassigned(
  tx: Prisma.TransactionClient,
  id: number,
  name: string,
) {
  const holders = await tx.userRole.count({
    where: { roleId: id, user: { isDeleted: false } },
  });

  if (holders > 0)
    throw new ConflictError(
      `"${name}" is assigned to ${holders} user${holders === 1 ? "" : "s"}. Reassign them before deleting it.`,
    );
}

// =============================================================================
// WRITE HELPERS
// =============================================================================

async function replaceRolePermissions(
  tx: Prisma.TransactionClient,
  roleId: number,
  codes: Permission[],
) {
  await tx.rolePermission.deleteMany({ where: { roleId } });

  if (codes.length === 0) return;

  const permissions = await tx.permission.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });

  // The zod schema already rejects unknown codes, so a shortfall here means the
  // catalogue has not been synced to this database — fail loudly rather than
  // silently granting less than the admin asked for.
  if (permissions.length !== new Set(codes).size) {
    const found = new Set(permissions.map((p) => p.code));
    const missing = codes.filter((code) => !found.has(code));

    throw new BadRequestError(
      `Permission(s) not present in this database: ${missing.join(", ")}. Run the seed to sync the catalogue.`,
    );
  }

  await tx.rolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });
}

/** Everyone holding this role has a stale cached snapshot — drop them all. */
async function invalidateHolders(tx: Prisma.TransactionClient, roleId: number) {
  const holders = await tx.userRole.findMany({
    where: { roleId },
    select: { userId: true },
  });

  for (const holder of holders) invalidateRbac(holder.userId);
}

// =============================================================================
// CREATE
// =============================================================================

export async function createRole(input: CreateRoleInput, actor: RoleActor) {
  assertMayGrant(actor, input.permissionCodes);

  return prisma.$transaction(async (tx) => {
    await assertNameAvailable(tx, input.name);

    const role = await tx.role.create({
      data: { name: input.name, description: input.description },
    });

    await replaceRolePermissions(tx, role.id, input.permissionCodes);

    await writeRbacAudit(tx, {
      action: RbacAuditAction.ROLE_CREATED,
      actor,
      roleId: role.id,
      roleName: role.name,
      added: [...input.permissionCodes].sort(),
    });

    return tx.role.findUniqueOrThrow({
      where: { id: role.id },
      include: roleInclude,
    });
  });
}

// =============================================================================
// LIST
// =============================================================================

export async function getRoles(query: RoleQuery) {
  const { search, page, limit } = query;

  const where = {
    ...(search && {
      name: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.role.findMany({
      where,
      include: roleInclude,
      // System roles first, then alphabetical — the immutable ones are the
      // reference point when reasoning about the rest.
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.role.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

/** Unpaginated lookup for the user form's role picker. */
export async function getRoleOptions() {
  return prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, isSystem: true },
  });
}

/** The permission catalogue, grouped for the role editor's matrix. */
export function getPermissionCatalogue() {
  const modules = new Map<string, typeof PERMISSION_REGISTRY>();

  for (const entry of PERMISSION_REGISTRY) {
    const bucket = modules.get(entry.module) ?? [];
    bucket.push(entry);
    modules.set(entry.module, bucket);
  }

  return [...modules].map(([module, permissions]) => ({ module, permissions }));
}

// =============================================================================
// SINGLE
// =============================================================================

export async function getRoleById(id: number) {
  return assertRoleExists(prisma, id);
}

// =============================================================================
// UPDATE
// =============================================================================

export async function updateRole(
  id: number,
  input: UpdateRoleInput,
  actor: RoleActor,
) {
  assertMayGrant(actor, input.permissionCodes);

  const role = await prisma.$transaction(async (tx) => {
    const existing = await assertRoleExists(tx, id);
    assertRoleEditable(existing);
    await assertNameAvailable(tx, input.name, id);

    const before = existing.rolePermissions.map((rp) => rp.permission.code);

    await tx.role.update({
      where: { id },
      data: { name: input.name, description: input.description },
    });

    await replaceRolePermissions(tx, id, input.permissionCodes);
    await invalidateHolders(tx, id);

    await writeRbacAudit(tx, {
      action: RbacAuditAction.ROLE_UPDATED,
      actor,
      roleId: id,
      roleName: input.name,
      ...diffCodes(before, input.permissionCodes),
    });

    return tx.role.findUniqueOrThrow({ where: { id }, include: roleInclude });
  });

  return role;
}

// =============================================================================
// DELETE
// =============================================================================

export async function deleteRole(id: number, actor: RoleActor) {
  return prisma.$transaction(async (tx) => {
    const role = await assertRoleExists(tx, id);
    assertRoleEditable(role);
    await assertRoleUnassigned(tx, id, role.name);

    // Written before the delete so the entry describes what was there; the
    // audit row keeps the name because the role's own row is about to go.
    await writeRbacAudit(tx, {
      action: RbacAuditAction.ROLE_DELETED,
      actor,
      roleId: id,
      roleName: role.name,
      removed: role.rolePermissions.map((rp) => rp.permission.code).sort(),
    });

    await tx.role.delete({ where: { id } });

    return role;
  });
}
