/**
 * Migration Script: Seed CustomerInitialCylinderBalance from Customer.initialCylinderBalance
 *
 * Idempotent — safe to re-run. Uses upsert.
 *
 * USAGE:
 *   1. The script will list all available stocks and ask which one to use.
 *   2. Or set TARGET_STOCK_ID below to skip the prompt.
 *   3. Run: npx ts-node --skip-project scripts/migrate-initial-cylinder-balance.ts
 */

import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

/** Set this to skip the interactive prompt. */
const TARGET_STOCK_ID: number | null = null;

async function askStockId(stocks: { id: number; batchNo: string | null; productName: string | null }[]): Promise<number> {
  console.log("\nAvailable stocks:");
  stocks.forEach((s) => {
    console.log(`  [${s.id}] ${s.productName ?? "Unknown"} — Batch: ${s.batchNo ?? "N/A"}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("\nEnter the Stock ID to assign to existing cylinder balances: ", (answer) => {
      rl.close();
      resolve(parseInt(answer.trim()));
    });
  });
}

async function main() {
  // 1. Find customers with old-style initialCylinderBalance > 0
  const customers = await prisma.customer.findMany({
    where: { isDeleted: false, initialCylinderBalance: { gt: 0 } },
  });

  if (customers.length === 0) {
    console.log("✅ No customers with initialCylinderBalance > 0. Nothing to migrate.");
    return;
  }

  console.log(`Found ${customers.length} customers with initialCylinderBalance > 0:`);
  customers.forEach((c) => {
    console.log(`  • ${c.name ?? `Customer #${c.id}`} — cylinders: ${c.initialCylinderBalance}`);
  });

  // 2. Determine target stock
  let stockId = TARGET_STOCK_ID;
  if (!stockId) {
    const stocks = await prisma.stock.findMany({
      where: { isDeleted: false },
      include: { product: true },
      orderBy: { id: "asc" },
    });
    const mapped = stocks.map((s) => ({
      id: s.id,
      batchNo: s.batchNo,
      productName: s.product?.name ?? null,
    }));
    stockId = await askStockId(mapped);
  }

  const stock = await prisma.stock.findUnique({ where: { id: stockId }, include: { product: true } });
  if (!stock) {
    console.error(`❌ Stock ID ${stockId} not found.`);
    process.exit(1);
  }

  console.log(`\n→ Assigning all cylinder balances to: [${stock.id}] ${stock.product?.name ?? "Unknown"} (Batch: ${stock.batchNo ?? "N/A"})\n`);

  // 3. Migrate each customer
  for (const customer of customers) {
    const qty = customer.initialCylinderBalance;
    console.log(`  Processing: ${customer.name ?? `#${customer.id}`} — qty ${qty}`);

    // Upsert CustomerInitialCylinderBalance
    await prisma.customerInitialCylinderBalance.upsert({
      where: { customerId_stockId: { customerId: customer.id, stockId: stockId! } },
      update: { quantity: qty },
      create: { customerId: customer.id, stockId: stockId!, quantity: qty },
    });

    // Seed RentProduct so the ledger starts correctly
    const existing = await prisma.rentProduct.findFirst({
      where: { customerId: customer.id, stockId: stockId! },
    });
    if (existing) {
      await prisma.rentProduct.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + qty },
      });
    } else {
      await prisma.rentProduct.create({
        data: { customerId: customer.id, stockId: stockId!, quantity: qty },
      });
    }

    console.log(`    ✓ Done`);
  }

  console.log("\n✅ Migration complete.");
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
