import "dotenv/config";
import fs from "node:fs";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@/generated/client";
import { ROLES } from "@/lib/permissions";
import * as LocationService from "@/module/location/location.service";
import * as VendorService from "@/module/vendor/vendor.service";
import * as ProductService from "@/module/product/product.service";
import * as CustomerService from "@/module/customer/customer.service";
import * as StockService from "@/module/stock/stock.service";

/**
 * Loads the JSON from export-legacy-data.ts into a fresh database.
 *
 *   npm run legacy:import              # dry run, prints what it would do
 *   npm run legacy:import -- --apply   # writes
 *
 * Everything goes through the services rather than raw inserts, which is the
 * whole point: creating a customer writes the OPENING ledger row, the balance
 * cache and the per-product cylinder ledger; creating a product seeds its
 * GodownInventory row; creating a stock batch posts a StockAdjustment so the
 * godown count and the cylinder ledger agree. Inserting rows directly would
 * reproduce the legacy state while quietly breaking every invariant the app
 * relies on.
 *
 * Re-running is safe: anything already present by name is skipped, so a partial
 * run can simply be run again.
 */

const INPUT = process.env.LEGACY_EXPORT_PATH ?? "prisma/data/legacy-export.json";
const APPLY = process.argv.includes("--apply");
const IGNORE_NEGATIVE = process.argv.includes("--ignore-negative-custody");

type Export = {
  locations: { id: number; name: string; district: string | null; locality: string | null; pincode: string | null }[];
  vendors: { id: number; name: string; phone: string | null; address: string | null; gstNumber: string | null }[];
  products: { id: number; name: string; type: string; weight: string | null; salePrice: number | null }[];
  customers: {
    id: number; name: string; phone: string | null; address: string | null;
    locationId: number | null; concernedPerson: string | null;
    concernedPersonMobile: string | null; discount: number | null; gstNumber: string | null;
    outstandingAmount: number; cylinderBalances: { productId: number; qty: number }[];
  }[];
  stock: { id: number; batchNo: string; productId: number; invoiceNo: string | null; quantity: number; productCost: number | null }[];
  review: { negativeCustody: unknown[]; custodyOnDeletedProduct: unknown[]; unmappedTypes: unknown[] };
};

// Legacy ids mean nothing in the new database; everything is matched by name.
const locationIds = new Map<number, number>();
const productIds = new Map<number, number>();

const log = (line: string) => console.log(line);
const plan = (line: string) => console.log(`${APPLY ? "  " : "  would "}${line}`);

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`${INPUT} not found — run the export first.`);
  }

  const data: Export = JSON.parse(fs.readFileSync(INPUT, "utf8"));

  // ─── Refuse to import data the new schema cannot hold ──────────────────────

  const blockers =
    data.review.negativeCustody.length +
    data.review.custodyOnDeletedProduct.length +
    data.review.unmappedTypes.length;

  if (blockers > 0 && !IGNORE_NEGATIVE) {
    console.error(
      `Refusing to import: the export lists ${blockers} unresolved item(s) under "review".\n` +
        `Negative cylinder custody cannot be represented — the new schema requires\n` +
        `pendingCylinder >= 0. Fix them in the legacy data and re-export, or pass\n` +
        `--ignore-negative-custody to import those customers with zero cylinders\n` +
        `(their money balance is unaffected).`,
    );
    process.exitCode = 1;
    return;
  }

  if (blockers > 0) {
    log(`Proceeding with ${blockers} unresolved review item(s) — affected custody is imported as zero.\n`);
  }

  // Opening rows are attributed to the owner account created by the seed
  const owner = await prisma.user.findFirst({
    where: { isDeleted: false, userRoles: { some: { role: { name: ROLES.OWNER } } } },
    orderBy: { id: "asc" },
  });

  if (!owner) {
    throw new Error("No OWNER user found — run `npx prisma db seed` before importing.");
  }

  log(APPLY ? `Importing ${INPUT}` : `DRY RUN — nothing will be written. Re-run with -- --apply\n`);
  log(`Opening entries will be attributed to "${owner.name ?? owner.username}"\n`);

  // ─── Locations ─────────────────────────────────────────────────────────────

  log("Locations");
  for (const location of data.locations) {
    const existing = await prisma.location.findFirst({ where: { name: location.name } });

    if (existing) {
      locationIds.set(location.id, existing.id);
      plan(`skip ${location.name} (already present)`);
      continue;
    }

    plan(`create ${location.name}`);
    if (!APPLY) continue;

    const created = await LocationService.createLocation({
      name: location.name,
      district: location.district ?? undefined,
      locality: location.locality ?? undefined,
      pincode: location.pincode ?? undefined,
    });
    locationIds.set(location.id, created.id);
  }

  // ─── Vendors ───────────────────────────────────────────────────────────────

  log("\nVendors");
  for (const vendor of data.vendors) {
    const existing = await prisma.vendor.findFirst({
      where: { name: vendor.name, isDeleted: false },
    });

    if (existing) {
      plan(`skip ${vendor.name} (already present)`);
      continue;
    }

    plan(`create ${vendor.name}`);
    if (!APPLY) continue;

    await VendorService.createVendor({
      name: vendor.name,
      phone: vendor.phone ?? undefined,
      address: vendor.address ?? undefined,
      // Legacy GST numbers predate the format check; keep only valid ones
      gstNumber: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(vendor.gstNumber ?? "")
        ? (vendor.gstNumber as string)
        : undefined,
    });
  }

  // ─── Products (each seeds its own GodownInventory row) ─────────────────────

  log("\nProducts");
  for (const product of data.products) {
    const existing = await prisma.product.findFirst({
      where: { name: product.name, isDeleted: false },
    });

    if (existing) {
      productIds.set(product.id, existing.id);
      plan(`skip ${product.name} (already present)`);
      continue;
    }

    plan(`create ${product.name} [${product.type}]`);
    if (!APPLY) continue;

    const created = await ProductService.createProduct({
      name: product.name,
      type: product.type as ProductType,
      weight: product.weight ?? undefined,
      salePrice: product.salePrice ?? undefined,
    });
    productIds.set(product.id, created.id);
  }

  // ─── Customers, carrying money owed and cylinders held ─────────────────────

  log("\nCustomers");
  let openingMoney = 0;
  let openingCylinders = 0;

  for (const customer of data.customers) {
    const existing = await prisma.customer.findFirst({
      where: { name: customer.name, isDeleted: false },
    });

    if (existing) {
      plan(`skip ${customer.name} (already present)`);
      continue;
    }

    const balances = customer.cylinderBalances
      .map((row) => ({ productId: productIds.get(row.productId), qty: row.qty }))
      .filter((row): row is { productId: number; qty: number } => row.productId !== undefined);

    // A credit balance cannot be an OPENING row (the schema takes a positive
    // amount); it is imported as zero and listed for a manual adjustment.
    const opening = Math.max(customer.outstandingAmount, 0);

    openingMoney += opening;
    openingCylinders += balances.reduce((sum, b) => sum + b.qty, 0);

    const detail = [
      opening > 0 ? `owes ₹${opening.toLocaleString("en-IN")}` : null,
      balances.length ? `${balances.reduce((s, b) => s + b.qty, 0)} cylinders` : null,
      customer.outstandingAmount < 0
        ? `IN CREDIT ₹${Math.abs(customer.outstandingAmount).toLocaleString("en-IN")} — needs a manual adjustment`
        : null,
    ].filter(Boolean).join(", ");

    plan(`create ${customer.name}${detail ? ` — ${detail}` : ""}`);
    if (!APPLY) continue;

    await CustomerService.createCustomer(
      {
        name: customer.name,
        phone: /^\d{10}$/.test(customer.phone ?? "") ? (customer.phone as string) : undefined,
        address: customer.address ?? undefined,
        locationId: customer.locationId ? locationIds.get(customer.locationId) : undefined,
        discount: customer.discount ?? undefined,
        concernedPerson: customer.concernedPerson ?? undefined,
        concernedPersonMobile: customer.concernedPersonMobile ?? undefined,
        gstNumber: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(customer.gstNumber ?? "")
          ? (customer.gstNumber as string)
          : undefined,
        initialPendingAmount: opening,
        initialCylinderBalances: balances,
      },
      owner.id,
    );
  }

  // ─── Stock (posts adjustments, which is what establishes the godown) ───────

  log("\nStock batches");
  for (const batch of data.stock) {
    const productId = productIds.get(batch.productId);

    if (!productId) {
      plan(`skip ${batch.batchNo} (product not imported)`);
      continue;
    }

    const existing = await prisma.stock.findFirst({ where: { batchNo: batch.batchNo } });

    if (existing) {
      plan(`skip ${batch.batchNo} (already present)`);
      continue;
    }

    plan(`create ${batch.batchNo} — ${batch.quantity} units`);
    if (!APPLY) continue;

    await StockService.createStock(
      {
        batchNo: batch.batchNo,
        productId,
        invoiceNo: batch.invoiceNo ?? undefined,
        quantity: batch.quantity,
        productCost: batch.productCost ?? undefined,
        reason: "Opening stock migrated from the legacy system",
      },
      owner.id,
    );
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  log(
    `\n${APPLY ? "Imported" : "Would import"}: ` +
      `${data.locations.length} locations, ${data.vendors.length} vendors, ` +
      `${data.products.length} products, ${data.customers.length} customers, ` +
      `${data.stock.length} stock batches`,
  );
  log(
    `Opening balances: ₹${openingMoney.toLocaleString("en-IN")} receivable, ` +
      `${openingCylinders} cylinders with customers`,
  );

  if (APPLY) {
    log("\nCylinder-type stock now shows in the godown via its opening adjustments.");
    log("Check the stock adjustment log to see them.");
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Import failed:", error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
