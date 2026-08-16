import { prisma } from "@/lib/prisma";
import { Prisma, RbacAuditAction } from "@/generated/client";

/**
 * Who changed access, and to what.
 *
 * Append-only: never updated, never deleted. An access change is exactly the
 * kind of thing that has to be explainable weeks later ("why did everyone lose
 * purchases on Tuesday"), and a record that can be edited cannot answer that.
 *
 * `writeRbacAudit` takes a transaction client as its first argument, following
 * `writeStockAdjustment` — the entry and the change it describes commit or fail
 * together, so the log can never disagree with reality.
 */

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type AuditActor = { userId: number; name?: string | null };

type AuditEntry = {
  action: RbacAuditAction;
  actor: AuditActor;
  roleId?: number;
  roleName?: string;
  targetUserId?: number;
  targetUserName?: string | null;
  /** Permission codes, or role names for USER_ROLES_CHANGED. */
  added?: string[];
  removed?: string[];
};

// =============================================================================
// PURE HELPERS
// =============================================================================

/** What changed between two sets, as the log wants to record it. */
export function diffCodes(before: string[], after: string[]) {
  const had = new Set(before);
  const has = new Set(after);

  return {
    added: [...has].filter((code) => !had.has(code)).sort(),
    removed: [...had].filter((code) => !has.has(code)).sort(),
  };
}

// =============================================================================
// WRITE
// =============================================================================

export async function writeRbacAudit(
  tx: Prisma.TransactionClient,
  entry: AuditEntry,
) {
  return tx.rbacAuditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actor.userId,
      // Denormalised so the entry still reads correctly after the actor, the
      // role or the target user is gone.
      actorName: entry.actor.name ?? null,
      roleId: entry.roleId ?? null,
      roleName: entry.roleName ?? null,
      targetUserId: entry.targetUserId ?? null,
      targetUserName: entry.targetUserName ?? null,
      added: entry.added ?? [],
      removed: entry.removed ?? [],
    },
  });
}

// =============================================================================
// LIST
// =============================================================================

export type RbacAuditQuery = {
  page: number;
  limit: number;
  roleId?: number;
  targetUserId?: number;
};

export async function getRbacAuditLog(query: RbacAuditQuery) {
  const { page, limit, roleId, targetUserId } = query;

  const where = {
    ...(roleId && { roleId }),
    ...(targetUserId && { targetUserId }),
  };

  const [data, total] = await prisma.$transaction([
    prisma.rbacAuditLog.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { actor: { select: { id: true, name: true, username: true } } },
    }),
    prisma.rbacAuditLog.count({ where }),
  ]);

  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
