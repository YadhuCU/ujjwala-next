import { ForbiddenError } from "@/lib/errors";
import type { Permission } from "@/lib/permissions";

/**
 * Row-level access: some modules are private to whoever recorded the row.
 *
 * This used to be `actor.roles.includes("OWNER")` copied into three services,
 * which meant a newly created role could never be granted agency-wide sight —
 * "agency-wide" was spelled OWNER in the source. Now it is a pair of grantable
 * permissions, and this module is the only place the choice is made.
 */

export type AccessScope = "all" | "own" | "none";

/** Who is asking. Built by `withAuth` from a fresh RBAC snapshot. */
export type Actor = {
  userId: number;
  permissions: Permission[];
  /** Holds a system role — always resolves to "all". */
  isOwner?: boolean;
};

export type ScopePair = { all: Permission; own: Permission };

export function resolveScope(actor: Actor, pair: ScopePair): AccessScope {
  if (actor.isOwner) return "all";
  if (actor.permissions.includes(pair.all)) return "all";
  if (actor.permissions.includes(pair.own)) return "own";
  return "none";
}

/**
 * The `where` fragment for an author-scoped query.
 *
 * Throws on "none" rather than returning a filter that matches nothing: a user
 * with no scope at all should be told they lack access, not shown a convincing
 * empty list.
 */
export function scopeFilter(
  actor: Actor,
  scope: AccessScope,
): { createdById?: number } {
  if (scope === "all") return {};
  if (scope === "own") return { createdById: actor.userId };

  throw new ForbiddenError("You do not have access to this data");
}

/** Convenience for the common resolve-then-filter pair. */
export function scopedWhere(actor: Actor, pair: ScopePair) {
  return scopeFilter(actor, resolveScope(actor, pair));
}

/**
 * Guard for a single record already fetched. `all` sees everything; `own` may
 * only touch rows it authored.
 */
export function assertCanAccessRecord(
  actor: Actor,
  scope: AccessScope,
  record: { createdById?: number | null },
  message = "You can only manage records you created",
) {
  if (scope === "all") return;
  if (scope === "own" && record.createdById === actor.userId) return;

  throw new ForbiddenError(message);
}
