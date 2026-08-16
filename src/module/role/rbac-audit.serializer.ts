import type { RbacAuditAction } from "@/generated/client";

export type RbacAuditWithRelations = {
  id: number;
  action: RbacAuditAction;
  actorId: number | null;
  actorName: string | null;
  roleId: number | null;
  roleName: string | null;
  targetUserId: number | null;
  targetUserName: string | null;
  added: string[];
  removed: string[];
  createdAt: Date;
  actor: { id: number; name: string | null; username: string } | null;
};

export type RbacAuditResponse = {
  id: number;
  action: RbacAuditAction;
  /** Best available name for whoever made the change. */
  actor: string;
  roleId?: number;
  roleName?: string;
  targetUserId?: number;
  targetUserName?: string;
  added: string[];
  removed: string[];
  createdAt: string;
};

export function serializeRbacAuditEntry(
  entry: RbacAuditWithRelations,
): RbacAuditResponse {
  return {
    id: entry.id,
    action: entry.action,
    // Prefer the live account, fall back to the name captured at the time —
    // that fallback is the whole reason the column exists.
    actor:
      entry.actor?.name ??
      entry.actor?.username ??
      entry.actorName ??
      "a deleted user",
    roleId: entry.roleId ?? undefined,
    roleName: entry.roleName ?? undefined,
    targetUserId: entry.targetUserId ?? undefined,
    targetUserName: entry.targetUserName ?? undefined,
    added: entry.added,
    removed: entry.removed,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function serializeRbacAuditEntries(
  entries: RbacAuditWithRelations[],
): RbacAuditResponse[] {
  return entries.map(serializeRbacAuditEntry);
}
