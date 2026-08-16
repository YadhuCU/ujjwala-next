import "dotenv/config";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { Client } from "pg";

// Managed Postgres (Neon and friends) answers DNS with several addresses,
// including IPv6 ones this network cannot reach. Node's happy-eyeballs gives up
// before working through them, so pin to IPv4.
net.setDefaultAutoSelectFamily(false);

/**
 * Reads the legacy (pre-refactor) production database and writes everything
 * worth carrying into a fresh database as JSON.
 *
 *   LEGACY_DATABASE_URL=postgres://… npm run legacy:export
 *
 * This script never writes: every query runs inside a read-only transaction,
 * so even a mistake in here cannot modify the source database.
 *
 * It deliberately does NOT export transactional history (legacy sales,
 * collections, rent transactions, purchases, expenses). Those models no longer
 * exist and the append-only ledgers cannot represent them faithfully — keep the
 * old database as a read-only archive instead. What comes across is the state
 * the business actually needs on day one: master data, what each customer owes,
 * and what each customer is holding.
 */

const OUTPUT = process.env.LEGACY_EXPORT_PATH ?? "prisma/data/legacy-export.json";

// Legacy stored product types as free-ish text ("Domestic"); the schema now has
// a strict enum.
const PRODUCT_TYPE_MAP: Record<string, string> = {
  domestic: "DOMESTIC",
  commercial: "COMMERCIAL",
  arb: "ARB",
  other: "OTHER",
};

// Things typed ARB in legacy that are not bulk LPG. ARB and OTHER behave
// identically (neither touches the cylinder ledger), so this is a labelling
// question, not a behavioural one — surfaced for review rather than changed.
const ACCESSORY_HINT = /(book|hose|stove|regulator|lighter)/i;

type Row = Record<string, unknown>;

async function main() {
  const connectionString = process.env.LEGACY_DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "LEGACY_DATABASE_URL is not set — point it at the old production database.",
    );
  }

  const client = new Client({
    connectionString,
    // Hosted providers require TLS; the CA is not in the local trust store
    ssl: connectionString.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
    connectionTimeoutMillis: 30_000,
  });

  await client.connect();

  // Belt and braces: nothing this script does can write, whatever happens below.
  //
  // This must be a *transaction*, not `SET default_transaction_read_only = on`.
  // Managed Postgres puts a connection pooler in front of the database, and a
  // session-level SET leaks onto the pooled backend for whoever is handed it
  // next — which silently makes the application read-only until the compute is
  // restarted. A read-only transaction cannot escape its own scope.
  await client.query("BEGIN TRANSACTION READ ONLY");

  const q = async (sql: string): Promise<Row[]> => (await client.query(sql)).rows;

  // ─── Master data ───────────────────────────────────────────────────────────

  const locations = await q(`
    SELECT id, name, district, locality, pincode
    FROM locations WHERE NOT is_deleted ORDER BY id
  `);

  const vendors = await q(`
    SELECT id, name, phone, address, gst_number AS "gstNumber"
    FROM vendors WHERE NOT is_deleted ORDER BY id
  `);

  const products = await q(`
    SELECT id, name, type::text AS type, weight, sale_price AS "salePrice"
    FROM products WHERE NOT is_deleted ORDER BY id
  `);

  // ─── Customers, with what they owe and what they hold ──────────────────────
  //
  // The outstanding figure uses the same formula the legacy app displayed:
  // opening balance + unpaid rent sales − collections + unpaid dom/arb sales.

  const customers = await q(`
    WITH rent AS (
      SELECT customer_id, COALESCE(SUM(net_total), 0) AS amt
      FROM sales WHERE sale_type = 'rent' AND NOT is_deleted GROUP BY customer_id
    ), coll AS (
      SELECT customer_id, COALESCE(SUM(amount), 0) AS amt
      FROM collections WHERE NOT is_deleted GROUP BY customer_id
    ), dom AS (
      SELECT customer_id, COALESCE(SUM(total_amount - paid_amount), 0) AS amt
      FROM dom_sales WHERE NOT is_deleted GROUP BY customer_id
    ), arb AS (
      SELECT customer_id, COALESCE(SUM(total_amount - paid_amount), 0) AS amt
      FROM arb_sales WHERE NOT is_deleted GROUP BY customer_id
    )
    SELECT c.id, c.name, c.phone, c.address, c.location_id AS "locationId",
           c.concerned_person AS "concernedPerson",
           c.concerned_person_mobile AS "concernedPersonMobile",
           c.discount, c.gst_number AS "gstNumber",
           ROUND(c.initial_pending_amount, 2) AS "legacyOpeningAmount",
           ROUND(
             c.initial_pending_amount
             + COALESCE(r.amt, 0) - COALESCE(cl.amt, 0)
             + COALESCE(d.amt, 0) + COALESCE(a.amt, 0), 2
           ) AS "outstandingAmount"
    FROM customers c
    LEFT JOIN rent r ON r.customer_id = c.id
    LEFT JOIN coll cl ON cl.customer_id = c.id
    LEFT JOIN dom d ON d.customer_id = c.id
    LEFT JOIN arb a ON a.customer_id = c.id
    WHERE NOT c.is_deleted
    ORDER BY c.id
  `);

  // Custody is held per stock batch in legacy; the new model holds it per
  // product, so net it down to customer + product.
  const custody = await q(`
    SELECT rp.customer_id AS "customerId", s.product_id AS "productId",
           SUM(rp.quantity)::int AS qty
    FROM rent_products rp
    JOIN stocks s ON s.id = rp.stock_id
    WHERE NOT rp.is_deleted AND s.product_id IS NOT NULL
    GROUP BY 1, 2 HAVING SUM(rp.quantity) <> 0
    ORDER BY 1, 2
  `);

  // ─── Stock on hand ─────────────────────────────────────────────────────────

  const stock = await q(`
    SELECT s.id, s.batch_no AS "batchNo", s.product_id AS "productId",
           s.invoice_no AS "invoiceNo", s.quantity, s.product_cost AS "productCost"
    FROM stocks s
    WHERE NOT s.is_deleted AND s.quantity > 0 AND s.product_id IS NOT NULL
    ORDER BY s.id
  `);

  // ─── Things a human has to decide before this can be imported ──────────────

  const productById = new Map(products.map((p) => [p.id as number, p]));
  const customerById = new Map(customers.map((c) => [c.id as number, c]));

  const negativeCustody = custody
    .filter((row) => (row.qty as number) < 0)
    .map((row) => ({
      customerId: row.customerId as number,
      productId: row.productId as number,
      qty: row.qty as number,
      customerName: String(customerById.get(row.customerId as number)?.name ?? "(deleted customer)"),
      productName: String(productById.get(row.productId as number)?.name ?? "(deleted product)"),
    }));

  const custodyOnDeletedProduct = custody.filter(
    (row) => !productById.has(row.productId as number),
  );

  const unmappedTypes = products.filter(
    (p) => !PRODUCT_TYPE_MAP[String(p.type ?? "").toLowerCase()],
  );

  const accessoriesTypedArb = products.filter(
    (p) =>
      String(p.type ?? "").toLowerCase() === "arb" &&
      ACCESSORY_HINT.test(String(p.name ?? "")),
  );

  const negativeOutstanding = customers.filter(
    (c) => Number(c.outstandingAmount ?? 0) < 0,
  );

  // ─── Normalise for the importer ────────────────────────────────────────────

  const custodyByCustomer = new Map<number, { productId: number; qty: number }[]>();
  for (const row of custody) {
    if ((row.qty as number) <= 0) continue; // negatives are a blocker, not data
    const list = custodyByCustomer.get(row.customerId as number) ?? [];
    list.push({ productId: row.productId as number, qty: row.qty as number });
    custodyByCustomer.set(row.customerId as number, list);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    source: connectionString.replace(/:[^:@/]+@/, ":***@"),
    locations,
    vendors,
    products: products.map((p) => ({
      ...p,
      type: PRODUCT_TYPE_MAP[String(p.type ?? "").toLowerCase()] ?? "OTHER",
      legacyType: p.type,
      salePrice: p.salePrice === null ? null : Number(p.salePrice),
    })),
    customers: customers.map((c) => ({
      ...c,
      discount: c.discount === null ? null : Number(c.discount),
      legacyOpeningAmount: Number(c.legacyOpeningAmount ?? 0),
      outstandingAmount: Number(c.outstandingAmount ?? 0),
      cylinderBalances: custodyByCustomer.get(c.id as number) ?? [],
    })),
    stock: stock.map((s) => ({
      ...s,
      productCost: s.productCost === null ? null : Number(s.productCost),
    })),
    review: {
      negativeCustody,
      custodyOnDeletedProduct,
      unmappedTypes,
      accessoriesTypedArb,
      negativeOutstanding,
    },
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));

  // ─── Report ────────────────────────────────────────────────────────────────

  const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  const owing = payload.customers.filter((c) => c.outstandingAmount > 0);
  const cylinders = payload.customers.flatMap((c) => c.cylinderBalances);

  console.log(`Read ${payload.source} (read-only)\n`);
  console.log(`  locations            ${locations.length}`);
  console.log(`  vendors              ${vendors.length}`);
  console.log(`  products             ${products.length}`);
  console.log(`  customers            ${customers.length}`);
  console.log(
    `    owing money        ${owing.length} — ${money(owing.reduce((s, c) => s + c.outstandingAmount, 0))}`,
  );
  console.log(
    `    holding cylinders  ${payload.customers.filter((c) => c.cylinderBalances.length).length} — ${cylinders.reduce((s, r) => s + r.qty, 0)} cylinders`,
  );
  console.log(
    `  stock batches        ${stock.length} — ${stock.reduce((s, r) => s + Number(r.quantity), 0)} units`,
  );

  const blockers = negativeCustody.length + custodyOnDeletedProduct.length + unmappedTypes.length;
  console.log(`\nNeeds a decision before import (${blockers} blocking):`);

  if (negativeCustody.length) {
    console.log(`\n  BLOCKING — negative cylinder custody (the new schema forbids it):`);
    for (const row of negativeCustody) {
      console.log(`    ${String(row.customerName).trim().padEnd(32)} ${String(row.productName).trim().padEnd(24)} ${row.qty}`);
    }
  }
  if (custodyOnDeletedProduct.length) {
    console.log(`\n  BLOCKING — custody against a deleted product:`);
    for (const row of custodyOnDeletedProduct) {
      console.log(`    customer ${row.customerId}  product ${row.productId} (deleted)  qty ${row.qty}`);
    }
  }
  if (unmappedTypes.length) {
    console.log(`\n  BLOCKING — product type not recognised:`);
    for (const p of unmappedTypes) console.log(`    ${p.name} → "${p.type}"`);
  }
  if (accessoriesTypedArb.length) {
    console.log(`\n  advisory — typed ARB but look like accessories (OTHER may fit better;`);
    console.log(`             behaviour is identical, both skip the cylinder ledger):`);
    for (const p of accessoriesTypedArb) console.log(`    ${p.name}`);
  }
  if (negativeOutstanding.length) {
    console.log(`\n  advisory — customers in credit, imported as a negative opening balance:`);
    for (const c of negativeOutstanding) {
      console.log(`    ${String(c.name).trim().padEnd(32)} ${money(Number(c.outstandingAmount))}`);
    }
  }

  console.log(`\nWrote ${OUTPUT}`);
  console.log(`Review it, then: npm run legacy:import -- --apply`);

  await client.query("COMMIT");
  await client.end();
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exitCode = 1;
});
