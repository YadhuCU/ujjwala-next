import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client";

/**
 * Backfill missing CustomerBalance rows.
 *
 * Customers created before the customer service was fixed only got a
 * CustomerBalance row when they opened with a non-zero debt. Without that row,
 * recording a payment fails with "Customer has no balance record".
 *
 * CustomerPaymentLedger is the source of truth, so the balance is rebuilt from
 * it rather than assumed to be 0 — a customer can have ledger rows (an opening
 * balance, invoices, payments) while the cache row went missing.
 *
 *   pendingAmount = SUM(CustomerPaymentLedger.amount) for that customer
 *
 * Dry run (default — reads only, prints what it would do):
 *   npm run db:backfill-balances
 *
 * Apply:
 *   npm run db:backfill-balances -- --apply
 *
 * Safe to run more than once: customers that already have a row are skipped and
 * never overwritten.
 */

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes("--apply");

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function main() {
  console.log(
    APPLY
      ? "Backfilling CustomerBalance rows…"
      : "DRY RUN — no writes. Re-run with `-- --apply` to write.",
  );

  // Soft-deleted customers are included on purpose: their ledger history is
  // still real, and a missing cache row would break a later restore.
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, isDeleted: true },
    orderBy: { id: "asc" },
  });

  const existing = await prisma.customerBalance.findMany({
    select: { customerId: true },
  });
  const hasBalance = new Set(existing.map((row) => row.customerId));

  const missing = customers.filter((customer) => !hasBalance.has(customer.id));

  if (missing.length === 0) {
    console.log(
      `Nothing to do — all ${customers.length} customers already have a balance row.`,
    );
    return;
  }

  console.log(
    `${missing.length} of ${customers.length} customers are missing a balance row.\n`,
  );

  let created = 0;
  let nonZero = 0;

  for (const customer of missing) {
    const ledger = await prisma.customerPaymentLedger.aggregate({
      where: { customerId: customer.id },
      _sum: { amount: true },
    });

    const pendingAmount = round2(Number(ledger._sum.amount ?? 0));
    if (pendingAmount !== 0) nonZero += 1;

    const label = `#${customer.id} ${customer.name}${customer.isDeleted ? " (deleted)" : ""}`;
    console.log(`  ${label} → pendingAmount ${pendingAmount.toFixed(2)}`);

    if (!APPLY) continue;

    // createMany + skipDuplicates keeps a concurrent writer from turning this
    // into a unique-constraint crash halfway through the run.
    const result = await prisma.customerBalance.createMany({
      data: [{ customerId: customer.id, pendingAmount }],
      skipDuplicates: true,
    });

    created += result.count;
  }

  console.log("");

  if (APPLY) {
    console.log(`Created ${created} balance row(s).`);
  } else {
    console.log(
      `Would create ${missing.length} balance row(s), ${nonZero} of them non-zero.`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
