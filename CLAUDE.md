# CLAUDE.md

LPG distribution ERP (gas agency) — Next.js 16 App Router + Prisma 7 (PostgreSQL) +
TanStack Query + react-hook-form/zod + shadcn-ui (Radix + Tailwind v4) + NextAuth v5.

The agency buys cylinders from vendors, sells/rents them to customers, and tracks
two things: **cylinder custody** (godown vs customer) and **customer money**.

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

```bash
npx prisma migrate dev
```

Prisma client is generated into `src/generated/client` (enums re-exported from
`src/generated/enums`) — import from there, never from `@prisma/client`.

Type-checking the app alone (root `npx tsc --noEmit` also pulls in stale
`.next/dev/types` and reports unrelated errors):

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep '^src/'
```

Note: `src/app/(dashboard)/commercial-sales/**` and `src/app/api/reports/**` still
have pre-existing type errors — they have not been refactored yet. Don't treat them
as regressions.

## Refactor status (branch `refactor-vibe-code`)

Modules are being reworked one at a time onto the layout described below.

`npm run build` passes and `src/` is free of type errors — keep it that way.

| Module | Server | Client |
|---|---|---|
| location, product, vendor, customer | done | done |
| purchase | done | done |
| dom-sale | done | done |
| arb-sale | done (reference module) | done |
| commercial-sale | done | done |
| customer-txn | done | **pending** (no page yet — balance/history/payment UI) |
| expense | done | done |
| stock-adjustment | done | **pending** (no page yet) |
| report, dashboard | done | done (pages are pre-refactor but working) |
| stock | done | done |
| users | done | done |

Every module is now on the layout below. What is left is UI-only: a customer-txn
page (balance / ledger history / record + reverse payment) and a stock-adjustment
page — both already have complete APIs behind them.

The legacy `Sale` / `Collection` / `RentProduct` / `RentTransaction` models are gone
from the schema, and the code that used them has been deleted: `api/sales/**`,
`(dashboard)/sales/**`, `lib/generate-tr-no.ts`, the old `api/customer-txn` root
route and `api/reports/sales/**`. Each sale module now generates its own `trNo`.

`src/module/arb-sale/*` + `src/app/(dashboard)/arb-sales/*` is the canonical
reference for a sale module; `src/module/purchase/*` for a purchase-shaped module.

## Anatomy of a module

### Server — `src/module/<name>/`

| File | Responsibility |
|---|---|
| `<name>.form.schema.ts` | zod schema for the **client form** (`z.coerce`, `""` → `undefined`, friendly messages). Exports `<Name>FormValues`. |
| `<name>.payload.schema.ts` | zod schema for the **HTTP payload** — strict types, `.transform()` for money rounding (`Math.round(x*100)/100`), plus `<Name>QuerySchema` for list filters/pagination. Exports `Create…Input` / `Update…Input` / `…Query`. |
| `<name>.service.ts` | All business logic. Every write runs inside one `prisma.$transaction`. Throws `AppError` subclasses from `src/lib/errors`. |
| `<name>.serializer.ts` | Prisma → JSON. Converts `Decimal` → `number` and `null` → `undefined`. Exports `<Name>WithRelations` and `<Name>Response` (the client's source of truth for types). |

Service file layout (keep the banner comments — they are the map):
`CONSTANTS` (shared `include`) → `INTERNAL TYPES` → `PURE HELPERS` → `GUARDS`
(`assert*`) → `WRITE HELPERS` → `CREATE` → `LIST` → `SINGLE` → `UPDATE` → `DELETE`.

Rules that hold across every service:

- Helpers take `tx: Prisma.TransactionClient` as their first arg, never `prisma`.
- `assert*` helpers both validate **and** return the data they fetched.
- Never trust `productId` from the client on a sale — derive it from the selected
  `Stock` row (`assertAndFetchStocks` → `stockMap`). Never trust `productType` —
  read it from `Product` (`assertAndAttachProductTypes` in purchase).
- Money on the way out of the DB is `Decimal`; wrap with `Number(...)` before math.
- Lists return `{ data, meta: { total, page, limit, totalPages } }`.

### Route — `src/app/api/<resource>/route.ts` and `[id]/route.ts`

Handlers are thin: permission gate → parse → service → format. No logic here.

```ts
export async function POST(request: Request) {
  return withAuth(
    async ({ id }) => {
      const data = CreateArbSaleSchema.parse(await request.json());
      const sale = await ArbSaleService.createArbSale(data, Number(id));
      return formatResponse({ data: sale, status: 201, message: "Sale created successfully" });
    },
    [PERMISSIONS.ARB_SALE_CREATE],
  );
}
```

`withAuth` (`src/lib/api-auth.ts`) does session + permission checks and wraps
everything in `routeErrorHandler`, which maps `AppError`, `ZodError` (422) and
Prisma error codes (P2002 → 409, P2025 → 404, P2003 → 400) to
`formatErrorResponse`. **Never try/catch inside a handler.** Every mutating route
passes the acting `userId` to the service (`createdById` / `updatedById`) —
including DELETE.

### Client — `src/app/(dashboard)/<resource>/`

```
page.tsx                     list page — <PageWrapper> + <…ViewComponent>
add/page.tsx                 <PageWrapper> + <…CreateComponent>
[id]/edit/page.tsx           <PageWrapper> + <…UpdateComponent>
components/…-view.tsx        DataTable + columns + permission-gated actions + DeleteAlert
components/…-create.tsx      useApiMutation(POST) → <…Form>
components/…-update.tsx      useSuspenseQuery(detail) → defaults → useApiMutation(PUT) → <…Form>
components/…-form.tsx        the single shared form, `isEditMode` toggles labels
```

- Data fetching: `queryKeys` (`src/lib/query-keys.ts`) + `queryOptions`
  (`src/lib/query-options.ts`) + hooks in `src/hooks/use-api.ts`. Never inline a
  raw `fetch`/axios call in a component; add to `src/lib/api-client.ts` instead.
- Detail queries use `api.getById<XResponse>("resource", id)` with
  `select: (res) => res.data` — responses are always the `ApiResponse<T>` envelope.
- Mutations use `useApiMutation` / `useDeleteMutation` and must list every affected
  key in `invalidateKeys` (a sale or purchase always invalidates `stocks.all` too).
- Forms use `useForm({ resolver: zodResolver(XFormSchema) })` + `useFieldArray`
  for line items; totals are computed from `form.watch("items")` for display only —
  the server recomputes them authoritatively.
- Permissions in the UI come from `usePermission().hasPermission(PERMISSIONS.X)`;
  this is cosmetic only — the real gate is `withAuth` on the route.

## Domain rules the code must preserve

Two tables are **append-only** — never `UPDATE`, never `DELETE`:
`CylinderTransaction` (cylinder movements) and `CustomerPaymentLedger` (money).
Everything else about stock and balances is a *materialized cache* derived from them:
`GodownInventory`, `CustomerBalance`, `CustomerCylinderLedger`, `Stock.quantity`.

Invariants:

```
GodownInventory.filledQty[p] = SUM(CylinderTransaction.filledDelta) WHERE product = p
GodownInventory.emptyQty[p]  = SUM(CylinderTransaction.emptyDelta)  WHERE product = p
CustomerBalance.pendingAmount[c] = SUM(CustomerPaymentLedger.amount) WHERE customer = c
filledQty, emptyQty, Stock.quantity, pendingCylinder  >= 0 always
```

**Corrections are void-and-repost**, never in-place edits:

1. reverse phase — append inverted `CylinderTransaction` rows with
   `voidedTxnId` → original (`@unique`, so a row can only be voided once),
   append one `ADJUSTMENT` `CustomerPaymentLedger` row for `-(total - paid)`,
   restore `Stock.quantity`, reverse the `GodownInventory` delta, soft-delete
   batches (mangling `batchNo` to `…_VOID_<id>` to free the unique slot);
2. repost phase — run the normal create writes with the corrected data;
3. the document header is updated **in place** (keeps its `id` and `trNo`), or
   soft-deleted (`isDeleted = true`) on delete.

Cylinder deltas, from the **godown's** perspective (positive = arrived):

| TxnType | filledDelta | emptyDelta |
|---|---|---|
| `PURCHASE_FULL` | `+qty` | `0` |
| `PURCHASE_FILL` | `+qty` | `-qty` |
| `SALE_OUT` (dom/arb outright sale) | `-qty` | `0` |
| `RENT_DELIVERY` (commercial rent) | `-qty` | `0` |
| `CYLINDER_RETURN` | `0` | `+qty` |
| `ADJUSTMENT` (admin, needs a `StockAdjustment` row with a reason) | `±` | `±` |

**Only `DOMESTIC` and `COMMERCIAL` products are cylinders.** `ARB` (bulk LPG) and
`OTHER` are tracked by `Stock` batches alone — they write **no**
`CylinderTransaction` and **no** `GodownInventory` rows, and a FILL line for them
needs no empty-cylinder guard. That is why `arb-sale.service.ts` has no godown code
while `dom-sale.service.ts` does, and why `purchase.service.ts` filters on
`isCylinderTypeProduct` before touching the cylinder ledger or the godown cache.

Other module-specific rules:

- **Purchase** — `FILL` = vendor refilled our empties (guard:
  `GodownInventory.emptyQty >= qty` per product); `FULL` = brand-new full
  cylinders. Every line creates a `Stock` batch; `batchNo` comes from the vendor
  or is generated as `BATCH-{yyyymmdd}-P{purchaseId}-PR{productId}-{n}`. A purchase
  can only be updated or deleted while **none** of its batches appear in a sale.
- **Dom / ARB sale** — outright sale, no cylinder is expected back. `trNo` is
  `DOM-` / `ARB-{yyyymmdd}-{00001}` and is assigned after the header insert.
  `paidAmount <= totalAmount`. Ledger: `SALE_CHARGE +total`, `PAYMENT -paid`,
  `CustomerBalance += (total - paid)`.
- **Commercial sale** — per-line `RENT` or `SALE`. Both draw a filled cylinder
  from a `Stock` batch and out of the godown (`RENT_DELIVERY` / `SALE_OUT`);
  `RENT` additionally tracks custody (`cylindersDispatched` /
  `cylindersReturned`, mirrored in `CustomerCylinderLedger.pendingCylinder`).
  Returns are a separate event (`PATCH /api/commercial-sales/:id/return`), never
  an edit of the invoice. An invoice that already has returns recorded cannot be
  updated, and one with cylinders still outstanding cannot be deleted. Its
  reverse phase reads the invoice's own `CylinderTransaction` rows and undoes
  exactly the movement each caused, so dispatches and returns both unwind.
- **Customer txn** — `GET :id/balance`, `GET :id/transactions`,
  `POST :id/payments`, `DELETE :id/payments/:paymentId`. A payment reversal is an
  `ADJUSTMENT` row, never a delete. Note: `CustomerPaymentLedger` has no
  `voidedEntryId` column, so double-reversal is currently blocked by matching the
  reversal's `notes` marker — add the column (`Int? @unique`) when the schema is
  next migrated and switch the guard to it.
- **Expense** — private to its author; only `OWNER` sees everyone's. The service
  takes an `ExpenseActor { userId, roles }` and both filters lists and gates
  single-record access on it.
- **Report / dashboard** — read-only modules over the same models. Both scope on
  an actor (`{ userId, roles }`): non-`OWNER` users see only what they recorded,
  and an owner may narrow to one staff member. Reports return
  `{ summary, data, pagination }` (not the `ApiResponse` envelope — the report
  pages consume that shape directly); every `/export` route renders through
  `report.export.ts`, where `excel` is CSV and `pdf` is tab-separated text.
  Sale-by-product rolls up the three `*SaleItem` tables, since line items — not
  the invoice headers — carry the product.

Roles live on the session as **names** (`OWNER`, `OFFICE_STAFF`, `FIELD_STAFF`) in
`session.user.roles: string[]`, matching `ROLES` in `src/lib/permissions.ts`. There
is no `session.user.role`, and the `USER_ROLES` strings in `src/lib/constants.ts`
("Owner"/"Office"/"Sales") are a dead legacy vocabulary — never compare against them.
- **Customer** — creation seeds `CustomerInitialCylinderBalance` +
  `CustomerCylinderLedger` per product, an `OPENING` ledger row if
  `initialPendingAmount > 0`, and always a `CustomerBalance` row (even at 0).
  Initial balances are migration data — set once, never updated.
- **Stock adjustment** — always two rows in one transaction (`StockAdjustment`
  with a mandatory free-text reason + an `ADJUSTMENT` `CylinderTransaction`) plus
  the godown cache, and never updated or deleted — post a correcting adjustment
  instead. `writeStockAdjustment(tx, …)` is exported so other modules post
  adjustments inside their own transaction rather than writing ledger rows by hand.
- **Stock** — batches normally come from a purchase and are read-only here
  (`isManual: false` in the response; the UI links back to the purchase). A manual
  batch is allowed for opening stock, and because nothing else would tell the
  ledger those cylinders exist, create / update / delete each post a
  `writeStockAdjustment` for the quantity delta — which is why every stock write
  takes a `reason`. Non-cylinder products skip that step, per the rule above.
  Lists hide drained batches unless `includeEmpty=true` (the sale forms want stock
  on hand; the stock page wants everything).
- **Users** — passwords are hashed with bcrypt and stripped by the serializer,
  which is the only path a `User` takes to a response. Username is set once and
  never updated; a blank password on edit keeps the existing hash. Guards: nobody
  may delete or deactivate their own account, and the last active `OWNER` cannot
  be deleted, deactivated, or demoted — that would lock everyone out. Activation
  is `PATCH /api/users/:id`, separate from delete.

Build order (each depends on the ones above): location → vendor → product →
customer → purchase → dom sale → arb sale → commercial sale → customer txn →
stock adjustment → expense.

## Conventions

- Path alias `@/*` → `src/*`.
- Soft delete (`isDeleted`) everywhere; every read filters `isDeleted: false`.
- Master data uses `onDelete: Restrict` where history exists (product, vendor,
  customer), `SetNull` for `Location → Customer`, `Cascade` for owned line items.
- Errors: throw `NotFoundError` / `BadRequestError` / `ConflictError` /
  `ForbiddenError` from `src/lib/errors` — never a bare `Error`, never `NextResponse`
  from a service.
- Keep the `// ─── SECTION ───` banners; they are how these files are navigated.
- No `console.log` in committed service code.
