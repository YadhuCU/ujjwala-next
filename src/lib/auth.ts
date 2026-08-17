import NextAuth, { type NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";
import { loadRbac, loadRbacCached } from "./rbac";

// How long a token's cached copy of roles/permissions may go unchecked. This
// only governs what the *client* sees for UI gating — every server-side decision
// re-reads through `loadRbacCached` in `api-auth.ts`, so a stale token here can
// never grant access it should not have.
const RBAC_TTL_MS = 60_000;

type JwtParams = Parameters<
  NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]>
>[0];

async function jwt({ token, user, trigger }: JwtParams): Promise<JWT | null> {
  // Sign-in: `authorize` has just loaded everything, so don't query again.
  if (user) {
    token.id = user.id as string;
    token.roles = user.roles;
    token.permissions = user.permissions;
    token.isOwner = user.isOwner;
    token.rbacAt = Date.now();
    return token;
  }

  const userId = Number(token.id ?? token.sub);
  if (!Number.isFinite(userId)) return null;

  const isStale = Date.now() - (token.rbacAt ?? 0) > RBAC_TTL_MS;
  if (trigger !== "update" && !isStale) return token;

  // `update()` from the client must see its own write, not a cached snapshot.
  const snapshot = await loadRbacCached(userId, {
    force: trigger === "update",
  });

  // Deactivated or deleted since sign-in — returning null clears the cookie.
  if (!snapshot) return null;

  token.roles = snapshot.roles;
  token.permissions = snapshot.permissions;
  token.isOwner = snapshot.isOwner;
  token.rbacAt = Date.now();

  return token;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    // Keeps `authorized` and `session` from the edge-safe config.
    ...authConfig.callbacks,
    jwt,
  },
  providers: [
    Credentials({
      credentials: {
        username: { type: "text" },
        password: { type: "password" },
      },
      authorize: async (credentials) => {
        const username = credentials.username as string;
        const password = credentials.password as string;

        if (!username || !password) return null;

        const user = await prisma.user.findFirst({
          where: { username, isDeleted: false },
          select: { id: true, name: true, email: true, password: true, isActive: true },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        // One definition of "what this user can do", shared with every
        // server-side check.
        const access = await loadRbac(user.id);
        if (!access) return null;

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          image: null,
          roles: access.roles,
          permissions: access.permissions,
          isOwner: access.isOwner,
        };
      },
    }),
  ],
});
