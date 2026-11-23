# Module reference — start here

Technical reference for every module, written so that someone with **no memory of
how this code got here** can pick it up. Verified against the code on 2026-09-30.

Read in this order when picking the project back up:

1. This file — the invariants and the known issues.
2. [`_platform.md`](_platform.md) — auth, RBAC internals, time, the Prisma client,
   the client data layer, mobile layout, testing, deployment. Everything
   cross-cutting.
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
| dom-sale | A field staff member's round: RENT (refill) or SALE, no customer, paid in full. | [dom-sale](dom-sale.md) |
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

## Known issues (open, verified 2026-11-23)

Fixed 2026-11-23, kept here so old references resolve: commercial edits can
no longer leave custody negative (`assertCustodyNotNegative`); ARB/commercial
numbers, batch numbers and export filenames are dated by India day; a
product cannot move across the cylinder line once it has history
(`assertTypeChangeAllowed`); list `from`/`to` filters are whole India days
(`businessDayRange` in `src/lib/business-day.ts`).

1. **Customer opening holdings cannot be changed after creation.** The update
   payload does not carry them; a mistake at onboarding stays. A product
   decision (opening figures are migration data), not a bug.
2. **ARB, commercial and purchase lists are not author-scoped.** Anyone with
   the module's read permission sees every invoice. Domestic sales are scoped
   on the field staff (since 2026-11-02); expense, report and dashboard on the
   author. A deliberate choice, not a bug — see `role.md`.
3. **Customer payments are not capped.** `recordPayment` accepts more than the
   customer owes, leaving a negative balance (a credit). Intended or not has
   never been decided.
4. **Most products have no sale price.** The sale forms auto-fill price from
   `Product.salePrice`; without one staff type it every time. `TODO.md` wants
   `Product.salePrice` dropped in favour of batch pricing.

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
