import { beforeEach } from "vitest";
import { resolveTestDatabaseUrl } from "./env";

// Services import the `prisma` singleton from @/lib/prisma, which reads
// DATABASE_URL at import time. Setup files run before the test module graph is
// imported, so pointing it at the test database here is what redirects every
// service under test.
process.env.DATABASE_URL = resolveTestDatabaseUrl();

const { prisma } = await import("@/lib/prisma");

/**
 * Every table except the migration bookkeeping, truncated together so foreign
 * keys never block the reset and identities restart at 1 for readable ids.
 */
async function resetDatabase() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const list = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

// Each test starts from an empty database — the services under test write to
// shared caches (GodownInventory, CustomerBalance), so leakage between cases
// would make failures meaningless.
beforeEach(async () => {
  await resetDatabase();
});
