# Module reference — start here

Technical reference for every module, written so that someone with **no memory of
how this code got here** can pick it up. Verified against the code on 2026-09-30.

Read in this order when picking the project back up:

1. This file — the invariants and the known issues.
2. [`_platform.md`](_platform.md) — auth, RBAC internals, time, the Prisma client,
   the client data layer, testing, deployment. Everything cross-cutting.
3. The module you are about to touch.

Also in `docs/`: [`RBAC.md`](../RBAC.md) (for whoever configures roles),
[`DEPLOYMENT.md`](../DEPLOYMENT.md) (Vercel + Neon operations),
[`DEMO-WALKTHROUGH.md`](../DEMO-WALKTHROUGH.md). The root `CLAUDE.md` holds the
conventions for writing code in the repo.

## The system in one paragraph

An LPG gas agency ERP. The agency buys cylinders from vendors, sells or rents them
to customers, and must answer two questions at any moment: **where are the
cylinders** (godown filled/empty, or with which customer) and **who owes what**.
Next.js 16 App Router + Prisma 7 (Postgres on Neon) + NextAuth v5, deployed on
Vercel. Users are in India; the server is not (Vercel runs in UTC).

## Modules

| Module | What it is | Doc |
|---|---|---|
| location | Customer grouping. The one hard delete. | [location](location.md) |
| vendor | Who purchases come from. | [vendor](vendor.md) |
| product | What is sold. Type decides everything (cylinder or not). | [product](product.md) |
| customer | Master data + opening balances (money and cylinders). | [customer](customer.md) |
| customer-txn | A customer's balance, ledger, payments. | [customer-txn](customer-txn.md) |
| purchase | Stock in from vendors — FILL or FULL. | [purchase](purchase.md) |
| stock | Batches. Mostly created by purchases. | [stock](stock.md) |
| stock-adjustment | Manual godown corrections, append-only. | [stock-adjustment](stock-adjustment.md) |
| godown | Read-only view of cylinder position + ledger. | [godown](godown.md) |
| dom-sale | Domestic cylinder sales: RENT (refill) or SALE. | [dom-sale](dom-sale.md) |
| arb-sale | Bulk gas / accessories. No cylinders. **Reference module.** | [arb-sale](arb-sale.md) |
| commercial-sale | Commercial RENT/SALE, custody, collections on the invoice. | [commercial-sale](commercial-sale.md) |
| expense | Author-private spending. | [expense](expense.md) |
| report | Read-only reports + exports. | [report](report.md) |
| dashboard | Read-only aggregate. | [dashboard](dashboard.md) |
| user | Accounts, multi-role, escalation guards. | [user](user.md) |
| role | Roles, permission matrix, audit log. | [role](role.md) |

## The invariants — never break these

Two tables are **append-only ledgers**: never `UPDATE`, never `DELETE`.

- `CylinderTransaction` — every cylinder movement.
- `CustomerPaymentLedger` — every charge, payment and adjustment.

Everything else about stock and money is a **cache** derived from them:

```
GodownInventory.filledQty[p]  = SUM(CylinderTransaction.filledDelta) WHERE product = p
GodownInventory.emptyQty[p]   = SUM(CylinderTransaction.emptyDelta)  WHERE product = p
CustomerBalance.pendingAmount[c] = SUM(CustomerPaymentLedger.amount) WHERE customer = c
filledQty, emptyQty, Stock.quantity, CustomerCylinderLedger.pendingCylinder >= 0
```

**The database does not enforce any of the `>= 0` rules** — there are no CHECK
constraints. They hold only because every service checks before it writes. A
raw SQL write, or a new code path that skips a guard, will silently break them.
`/godown` re-derives the godown cache from the ledger and flags drift.

**Corrections are void-and-repost**, never in-place edits: append inverted ledger
rows (`voidedTxnId` / `voidedEntryId`, both `@unique`, so a row is voided at most
once), restore caches, then post the corrected rows. Document headers keep their
`id` and `trNo`.

**Only DOMESTIC and COMMERCIAL products are cylinders.** ARB and OTHER write no
`CylinderTransaction`, no `GodownInventory`, and cannot be held by a customer.
The single source of that rule is `isCylinderTypeProduct` in
`src/module/product/product.rules.ts` (client-safe — it imports from
`@/generated/enums`, not the Prisma client).

Cylinder deltas are from the **godown's** point of view (positive = arrived):

| TxnType | filledDelta | emptyDelta | Written by |
|---|---|---|---|
| `PURCHASE_FULL` | +q | 0 | purchase |
| `PURCHASE_FILL` | +q | −q | purchase (vendor refilled our empties) |
| `SALE_OUT` | −q | 0 | dom SALE line, commercial SALE line |
| `RENT_DELIVERY` | −q | 0 | dom RENT line, commercial RENT line |
| `CYLINDER_RETURN` | 0 | +q | dom empties, commercial collections/returns |
| `ADJUSTMENT` | ± | ± | stock-adjustment (with a reason), manual stock |

## Known issues (open, verified 2026-09-30)

1. **Commercial update can drive custody negative.** `updateCommercialSale`'s
   reverse phase subtracts the invoice's outstanding rentals from
   `CustomerCylinderLedger` without checking the result stays `>= 0`. If those
   cylinders were since collected on a *later* invoice (invoice-level
   collections do not decrement the original line's counters), editing the
   original leaves the customer holding a negative count. Domestic has the guard
   (`assertReversalKeepsCustody`); commercial needs the same. Delete is safe:
   `assertNoOutstandingCylinders` refuses it.
2. **Some generated numbers still date by UTC.** ARB and commercial
   `generateTrNo`, and purchase `generateBatchNo`, use `new Date().toISOString()`,
   so anything recorded between 00:00 and 05:30 IST carries the previous day's
   date. Domestic `trNo` uses `businessDayKey`. Cosmetic — numbers stay unique —
   but inconsistent; the fix is `businessDayKey(new Date())`.
3. **Customer opening holdings cannot be changed after creation.** The update
   payload does not carry them. A customer onboarded without their domestic
   cylinders will have refills refused until someone collects fewer empties.
4. **Sale lists are not author-scoped.** Anyone with `domestic_sale.read` sees
   every domestic invoice. Only expense, report and dashboard distinguish
   "own". A deliberate choice, not a bug — see `role.md`.
5. **No UAT product has a sale price.** The sale forms auto-fill price from
   `Product.salePrice`; on UAT staff type it every time. `TODO.md` wants
   `Product.salePrice` dropped in favour of batch pricing.
6. **Customer payments are not capped.** `recordPayment` accepts more than the
   customer owes, leaving a negative balance (a credit). Intended or not has
   never been decided.
7. **A product's type can be changed after it has history.** `updateProduct`
   writes `type` unconditionally. DOMESTIC → ARB strands its cylinder ledger and
   custody (they stop being read); ARB → DOMESTIC gives existing batches no
   ledger rows, so sales can push `GodownInventory.filledQty` negative. It should
   refuse a cylinder/non-cylinder change once the product has stock, ledger rows
   or custody.
8. **List endpoints apply `from`/`to` raw.** Nine list services (dom, arb and
   commercial sales, purchase, expense, stock-adjustment, godown movements,
   customer transactions) filter `createdAt: { gte: from, lte: to }` with no
   day normalisation, so `?to=2026-09-30` means 00:00 UTC and excludes that whole
   day. Only report and dashboard use `business-day.ts`. **Latent**: no screen
   sends a range to these lists today; it bites the first time one does.

## Environments

| | Where | Database |
|---|---|---|
| Local dev | `npm run dev` / `npm run start`, port 3000 | local Postgres `ujjwala_next` |
| Tests | `npm test`, `npm run test:integration` | local `ujjwala_next_test` (name must end `_test`) |
| UAT | Vercel, `main` → `ujjwala-next.vercel.app` | Neon `ujjwala` (pooled for the app, direct for migrations) |

UAT is a testing deployment for client feedback, **not** real production. It was
wiped and rebuilt on 2026-08-16 (a verified `pg_dump` of the old legacy database is
in `~/ujjwala-backups/`, outside the repo). The agency chose a fresh start: no
legacy data was imported.
