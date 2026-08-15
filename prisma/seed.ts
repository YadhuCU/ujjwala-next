import "dotenv/config";

import bcrypt from "bcryptjs";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client";

import { PERMISSIONS } from "@/lib/permissions";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

// =========================================================
// ROLE DEFINITIONS
// =========================================================

const ROLE_PERMISSIONS = {
  OWNER: Object.values(PERMISSIONS),

  OFFICE_STAFF: [
    // Dashboard
    PERMISSIONS.DASHBOARD_READ,

    // Customer
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_READ,

    // Vendor
    PERMISSIONS.VENDOR_READ,

    // Expense
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_READ,
    PERMISSIONS.EXPENSE_READ_OWN,

    // Commercial Sale
    PERMISSIONS.COMMERCIAL_SALE_CREATE,
    PERMISSIONS.COMMERCIAL_SALE_READ,
    PERMISSIONS.COMMERCIAL_SALE_READ_OWN,

    // Domestic Sale
    PERMISSIONS.DOMESTIC_SALE_CREATE,
    PERMISSIONS.DOMESTIC_SALE_READ,
    PERMISSIONS.DOMESTIC_SALE_READ_OWN,

    // Arb Sale
    PERMISSIONS.ARB_SALE_CREATE,
    PERMISSIONS.ARB_SALE_READ,
    PERMISSIONS.ARB_SALE_READ_OWN,

    // Product
    PERMISSIONS.PRODUCT_READ,

    // Stock
    PERMISSIONS.STOCK_READ,

    // Reports
    PERMISSIONS.REPORT_READ,
  ],

  FIELD_STAFF: [
    // Dashboard
    PERMISSIONS.DASHBOARD_READ,

    // Customer
    PERMISSIONS.CUSTOMER_READ,

    // Expense
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_READ,
    PERMISSIONS.EXPENSE_READ_OWN,

    // Sales
    PERMISSIONS.COMMERCIAL_SALE_READ,
    PERMISSIONS.COMMERCIAL_SALE_READ_OWN,

    PERMISSIONS.DOMESTIC_SALE_READ,
    PERMISSIONS.DOMESTIC_SALE_READ_OWN,

    PERMISSIONS.ARB_SALE_READ,
    PERMISSIONS.ARB_SALE_READ_OWN,

    // Location
    PERMISSIONS.LOCATION_READ,
  ],
} as const;

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
    roles: ["OWNER"],
  },

  {
    username: "office",
    password: seedPassword("SEED_OFFICE_PASSWORD", "office123"),
    name: "Office Staff",
    roles: ["OFFICE_STAFF"],
  },

  {
    username: "field",
    password: seedPassword("SEED_FIELD_PASSWORD", "field123"),
    name: "Field Staff",
    roles: ["FIELD_STAFF"],
  },
] as const;

// =========================================================
// MAIN
// =========================================================

async function main() {
  console.log("🌱 Starting seed...");

  // =========================================================
  // CREATE ALL PERMISSIONS
  // =========================================================

  const permissions = Object.values(PERMISSIONS);

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission,
      },

      create: {
        code: permission,
      },

      update: {},
    });
  }

  console.log("✅ Permissions synced");

  // =========================================================
  // CREATE ROLES
  // =========================================================

  const rolesMap: Record<string, number> = {};

  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: {
        name: roleName,
      },

      create: {
        name: roleName,
      },

      update: {},
    });

    rolesMap[roleName] = role.id;
  }

  console.log("✅ Roles synced");

  // =========================================================
  // FETCH ALL DB PERMISSIONS
  // =========================================================

  const dbPermissions = await prisma.permission.findMany();

  const permissionMap = new Map(
    dbPermissions.map((p) => [p.code, p.id])
  );

  // =========================================================
  // ASSIGN ROLE PERMISSIONS
  // =========================================================

  for (const [roleName, permissions] of Object.entries(
    ROLE_PERMISSIONS
  )) {
    const roleId = rolesMap[roleName];

    for (const permissionCode of permissions) {
      const permissionId =
        permissionMap.get(permissionCode);

      if (!permissionId) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId,
            permissionId,
          },
        },

        create: {
          roleId,
          permissionId,
        },

        update: {},
      });
    }
  }

  console.log("✅ Role permissions synced");

  // =========================================================
  // CREATE USERS
  // =========================================================

  for (const user of USERS) {
    const hashedPassword = await bcrypt.hash(
      user.password,
      10
    );

    const createdUser = await prisma.user.upsert({
      where: {
        username: user.username,
      },

      update: {
        name: user.name,
        isActive: true,
      },

      create: {
        username: user.username,
        password: hashedPassword,
        name: user.name,
        isActive: true,
      },
    });

    // =====================================================
    // ASSIGN USER ROLES
    // =====================================================

    for (const roleName of user.roles) {
      await prisma.userRole.upsert({
        where: {
          roleId_userId: {
            roleId: rolesMap[roleName],
            userId: createdUser.id,
          },
        },

        create: {
          roleId: rolesMap[roleName],
          userId: createdUser.id,
        },

        update: {},
      });
    }
  }

  console.log("✅ Users synced");

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