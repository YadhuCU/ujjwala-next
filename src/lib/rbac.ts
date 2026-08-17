import { prisma } from "@/lib/prisma";
import type { Permission } from "@/lib/permissions";

/**
 * What a user is allowed to do, read fresh from the database.
 *
 * This is deliberately NOT read from the session cookie. `withAuth` calls
 * `auth()` with no arguments, which takes Auth.js's React-Server-Components
 * branch — that branch never forwards the refreshed `Set-Cookie` back to the
 * browser, so anything we write into the token during an API request is
 * discarded. Treating the cookie as the server's source of truth would mean
 * revoking a permission had no effect until the user signed out.
 *
 * So the cookie carries permissions only as a hint for client-side UI gating,
 * and every server-side decision comes from here.
 *
 * NODE ONLY. Never import this from `auth.config.ts` — that module is bundled
 * for the edge middleware and cannot reach Prisma.
 */

export type RbacSnapshot = {
  roles: string[];
  permissions: Permission[];
  /** Holds a system role: unconditionally allowed, whatever the DB rows say. */
  isOwner: boolean;
};

export async function loadRbac(userId: number): Promise<RbacSnapshot | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false, isActive: true },
    select: {
      userRoles: {
        select: {
          role: {
            select: {
              name: true,
              isSystem: true,
              rolePermissions: {
                select: { permission: { select: { code: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Deactivated or soft-deleted since they signed in — the caller ends the session.
  if (!user) return null;

  const roles = user.userRoles.map((userRole) => userRole.role.name);
  const isOwner = user.userRoles.some((userRole) => userRole.role.isSystem);

  // Overlapping roles would otherwise repeat codes, which bloats the token.
  const permissions = [
    ...new Set(
      user.userRoles.flatMap((userRole) =>
        userRole.role.rolePermissions.map((rp) => rp.permission.code),
      ),
    ),
  ] as Permission[];

  return { roles, permissions, isOwner };
}

// =============================================================================
// CACHE
// One entry per user per server instance. Bounds the cost of checking on every
// request while keeping revocation quick.
// =============================================================================

const TTL_MS = 30_000;
// Without jitter every entry seeded by one burst of traffic expires together.
const JITTER_MS = 5_000;

type CacheEntry = { expiresAt: number; snapshot: Promise<RbacSnapshot | null> };

const cache = new Map<number, CacheEntry>();

export function loadRbacCached(
  userId: number,
  options: { force?: boolean } = {},
): Promise<RbacSnapshot | null> {
  if (options.force) cache.delete(userId);

  const hit = cache.get(userId);
  if (hit && Date.now() < hit.expiresAt) return hit.snapshot;

  // Store the promise rather than the resolved value: a page that fires five
  // API calls at once collapses onto a single query instead of stampeding.
  const snapshot = loadRbac(userId).catch((error) => {
    cache.delete(userId); // a failure must not be cached as "no access"
    throw error;
  });

  cache.set(userId, {
    expiresAt: Date.now() + TTL_MS + Math.random() * JITTER_MS,
    snapshot,
  });

  return snapshot;
}

/** Drop a cached snapshot immediately — used after an RBAC write. */
export function invalidateRbac(userId?: number) {
  if (userId === undefined) cache.clear();
  else cache.delete(userId);
}
