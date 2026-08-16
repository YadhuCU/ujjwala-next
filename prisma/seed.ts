import "dotenv/config";

import net from "node:net";
import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client";

import { PERMISSION_REGISTRY, PERMISSIONS, ROLES } from "@/lib/permissions";

// Managed Postgres (Neon and friends) answers DNS with several addresses,
// including IPv6 ones many networks cannot reach. Node's happy-eyeballs gives
// up before working through them, so pin to IPv4 — otherwise seeding a hosted
// database fails with ETIMEDOUT on the first write. The same pin is in
// prisma/scripts/export-legacy-data.ts for the same reason.
net.setDefaultAutoSelectFamily(false);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

// =========================================================
// ROLE DEFINITIONS
//
// OWNER is a *system* role: it always holds every permission, cannot be edited
// or deleted from the UI, and is what makes a misconfiguration recoverable.
//
// The other two are starting points only. They are seeded on first run and
// never re-granted afterwards, because they are editable in the app now and
// re-seeding must not silently undo an administrator's changes.
// =========================================================

const STARTER_ROLES = {
  [ROLES.OFFICE_STAFF]: {
    description: "Office staff — records paperwork and sees their own records",
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.DASHBOARD_READ_OWN,

      // Creating a customer needs the location dropdown to load
      PERMISSIONS.CUSTOMER_CREATE,
      PERMISSIONS.CUSTOMER_READ,
      PERMISSIONS.LOCATION_READ,

      PERMISSIONS.VENDOR_READ,

      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_READ,
      PERMISSIONS.EXPENSE_READ_OWN,

      PERMISSIONS.COMMERCIAL_SALE_CREATE,
      PERMISSIONS.COMMERCIAL_SALE_READ,

      PERMISSIONS.DOMESTIC_SALE_CREATE,
      PERMISSIONS.DOMESTIC_SALE_READ,

      PERMISSIONS.ARB_SALE_CREATE,
      PERMISSIONS.ARB_SALE_READ,

      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.STOCK_READ,

      PERMISSIONS.REPORT_READ,
      PERMISSIONS.REPORT_READ_OWN,
    ],
  },

  [ROLES.FIELD_STAFF]: {
    description: "Field staff — records sales in the field",
    permissions: [
      PERMISSIONS.DASHBOARD_READ,
      PERMISSIONS.DASHBOARD_READ_OWN,

      PERMISSIONS.CUSTOMER_READ,

      PERMISSIONS.EXPENSE_CREATE,
      PERMISSIONS.EXPENSE_READ,
      PERMISSIONS.EXPENSE_READ_OWN,

      // Field staff record sales, so they create as well as read. They cannot
      // update or delete a posted sale; a correction goes through the office.
      PERMISSIONS.COMMERCIAL_SALE_CREATE,
      PERMISSIONS.COMMERCIAL_SALE_READ,

      PERMISSIONS.DOMESTIC_SALE_CREATE,
      PERMISSIONS.DOMESTIC_SALE_READ,

      PERMISSIONS.ARB_SALE_CREATE,
      PERMISSIONS.ARB_SALE_READ,

      // Selling needs the catalogue and the batches to sell from
      PERMISSIONS.PRODUCT_READ,
      PERMISSIONS.STOCK_READ,

      PERMISSIONS.LOCATION_READ,
    ],
  },
};

// =========================================================
// USERS
// =========================================================

/**
 * Seed passwords come from the environment. Dev falls back to a well-known
 * value so a fresh checkout just works; production has no fallback and the
 * seed refuses to run without one, so a real deployment can never end up with
 * a published password.
 *
 *   SEED_OWNER_PASSWORD   SEED_OFFICE_PASSWORD   SEED_FIELD_PASSWORD
 *
 * SEED_PASSWORD sets all three at once.
 */
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const MIN_PASSWORD_LENGTH = 8;

/**
 * Break glass. Normally the seed never touches an existing user's password, so
 * re-running it cannot undo a deliberate change — which also means a lost owner
 * password is unrecoverable without database access. Setting this resets the
 * owner's password and re-attaches the system role.
 */
const FORCE_OWNER_RESET = process.env.SEED_FORCE_OWNER_PASSWORD === "1";

function seedPassword(envKey: string, devFallback: string): string {
  const value = process.env[envKey] ?? process.env.SEED_PASSWORD;

  if (!value) {
    if (IS_PRODUCTION) {
      throw new Error(
        `${envKey} (or SEED_PASSWORD) must be set when seeding in production.`,
      );
    }

    console.warn(`⚠️  ${envKey} not set — using the development default.`);
    return devFallback;
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `${envKey} must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
  }

  return value;
}

const USERS = [
  {
    username: "owner",
    password: seedPassword("SEED_OWNER_PASSWORD", "owner123"),
    name: "Owner User",
    roles: [ROLES.OWNER],
  },

  {
    username: "office",
    password: seedPassword("SEED_OFFICE_PASSWORD", "office123"),
    name: "Office Staff",
    roles: [ROLES.OFFICE_STAFF],
  },

  {
    username: "field",
    password: seedPassword("SEED_FIELD_PASSWORD", "field123"),
    name: "Field Staff",
    roles: [ROLES.FIELD_STAFF],
  },
] as const;

// =========================================================
// MAIN
// =========================================================

async function main() {
  console.log("🌱 Starting seed...");

  // =========================================================
  // SYNC THE PERMISSION CATALOGUE
  //
  // A true sync, not an append. The old seed only ever added, so removing a
  // permission from source left both the row and every grant of it in place —
  // access nobody could see in the code.
  // =========================================================

  for (const [index, entry] of PERMISSION_REGISTRY.entries()) {
    const data = {
      module: entry.module,
      label: entry.label,
      description: entry.description ?? null,
      sortOrder: index,
    };

    await prisma.permission.upsert({
      where: { code: entry.code },
      create: { code: entry.code, ...data },
      update: data,
    });
  }

  const liveCodes = PERMISSION_REGISTRY.map((entry) => entry.code);
  const { count: removed } = await prisma.permission.deleteMany({
    where: { code: { notIn: liveCodes } },
  });

  console.log(
    `✅ Permissions synced (${liveCodes.length} live${removed ? `, ${removed} retired` : ""})`,
  );

  // =========================================================
  // SYSTEM ROLE
  // Always present, always complete. Re-granted on every run so that adding a
  // permission in a release cannot lock the owner out of the new feature.
  // =========================================================

  const ownerRole = await prisma.role.upsert({
    where: { name: ROLES.OWNER },
    create: {
      name: ROLES.OWNER,
      description: "Full access. Cannot be edited or deleted.",
      isSystem: true,
    },
    update: { isSystem: true },
  });

  const allPermissions = await prisma.permission.findMany({
    select: { id: true, code: true },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: ownerRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: ownerRole.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  console.log("✅ System role synced");

  // =========================================================
  // STARTER ROLES
  // Seeded once. Never re-granted — they are editable in the app now.
  // =========================================================

  const permissionByCode = new Map(allPermissions.map((p) => [p.code, p.id]));
  const roleIds: Record<string, number> = { [ROLES.OWNER]: ownerRole.id };

  for (const [name, definition] of Object.entries(STARTER_ROLES)) {
    const existing = await prisma.role.findUnique({ where: { name } });

    if (existing) {
      roleIds[name] = existing.id;
      console.log(`↷ ${name} already exists — leaving its permissions alone`);
      continue;
    }

    const role = await prisma.role.create({
      data: { name, description: definition.description },
    });

    await prisma.rolePermission.createMany({
      data: definition.permissions
        .map((code) => permissionByCode.get(code))
        .filter((id): id is number => id !== undefined)
        .map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });

    roleIds[name] = role.id;
  }

  console.log("✅ Starter roles synced");

  // =========================================================
  // BACKFILL: every module read needs a scope
  //
  // Scoping used to be implicit — "not the OWNER role" meant own-records-only.
  // Now it is a granted permission, so a role upgraded from before this change
  // holds e.g. dashboard.read with no scope beside it, which reads as no access
  // at all. Grant the narrower ".own" wherever a scope is missing entirely.
  //
  // Idempotent, and it never overrides a deliberate choice: a role that already
  // has either half of the pair is left alone.
  // =========================================================

  const SCOPE_BACKFILL = [
    {
      gate: PERMISSIONS.EXPENSE_READ,
      own: PERMISSIONS.EXPENSE_READ_OWN,
      all: PERMISSIONS.EXPENSE_READ_ALL,
    },
    {
      gate: PERMISSIONS.REPORT_READ,
      own: PERMISSIONS.REPORT_READ_OWN,
      all: PERMISSIONS.REPORT_READ_ALL,
    },
    {
      gate: PERMISSIONS.DASHBOARD_READ,
      own: PERMISSIONS.DASHBOARD_READ_OWN,
      all: PERMISSIONS.DASHBOARD_READ_ALL,
    },
  ];

  const editableRoles = await prisma.role.findMany({
    where: { isSystem: false },
    include: { rolePermissions: { include: { permission: true } } },
  });

  let backfilled = 0;

  for (const role of editableRoles) {
    const held = new Set(
      role.rolePermissions.map((rolePermission) => rolePermission.permission.code),
    );

    for (const scope of SCOPE_BACKFILL) {
      const needsScope =
        held.has(scope.gate) && !held.has(scope.own) && !held.has(scope.all);

      if (!needsScope) continue;

      const permissionId = permissionByCode.get(scope.own);
      if (!permissionId) continue;

      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });

      console.log(`  + ${role.name}: ${scope.own}`);
      backfilled += 1;
    }
  }

  console.log(
    backfilled > 0
      ? `✅ Scope backfill applied (${backfilled} grant${backfilled === 1 ? "" : "s"})`
      : "✅ Scope backfill — nothing to do",
  );

  // =========================================================
  // USERS
  // =========================================================

  for (const user of USERS) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const isOwnerAccount = (user.roles as readonly string[]).includes(ROLES.OWNER);
    const resetPassword = isOwnerAccount && FORCE_OWNER_RESET;

    const createdUser = await prisma.user.upsert({
      where: { username: user.username },

      // Passwords are deliberately not touched on an existing account, so
      // re-seeding cannot undo a deliberate change.
      update: {
        name: user.name,
        isActive: true,
        ...(resetPassword && { password: hashedPassword }),
      },

      create: {
        username: user.username,
        password: hashedPassword,
        name: user.name,
        isActive: true,
      },
    });

    if (resetPassword)
      console.log(`🔑 Reset the password for "${user.username}"`);

    for (const roleName of user.roles) {
      await prisma.userRole.upsert({
        where: {
          roleId_userId: { roleId: roleIds[roleName], userId: createdUser.id },
        },
        create: { roleId: roleIds[roleName], userId: createdUser.id },
        update: {},
      });
    }
  }

  console.log("✅ Users synced");

  if (FORCE_OWNER_RESET)
    console.log("⚠️  SEED_FORCE_OWNER_PASSWORD was set — unset it for normal runs.");

  console.log("🎉 Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
