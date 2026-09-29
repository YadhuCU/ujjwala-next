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
npm test
```

```bash
npm run test:integration
```

```bash
npx prisma migrate dev
```

Two vitest suites, both colocated with the code:

- `*.test.ts` — no database. Payload schemas, serializers, pure rules, exporters.
- `*.integration.test.ts` — real Postgres. Services end to end: godown and
  balance movements, guards, void-and-repost. Every service has one; keep it
  that way when adding a module.

The integration suite creates and migrates its own database on first run.
`TEST_DATABASE_URL` overrides it; otherwise `DATABASE_URL` is reused with `_test`
appended. The name **must** end in `_test` — `src/test/env.ts` refuses otherwise,
because every test truncates every table. Never point it at a real database.

Write integration tests against the invariants, not just the return value:
`assertGodownMatchesLedger` and `assertBalanceMatchesLedger` in
`src/test/factories.ts` re-derive each cache from its ledger. Seed stock with
`seedGodown`, which posts a real `StockAdjustment` — writing `GodownInventory`
directly would start the test in a state that already violates the invariant.

Carrying the old production data across (`prisma/scripts/`):

```bash
LEGACY_DATABASE_URL=… npm run legacy:export   # read-only; writes prisma/data/legacy-export.json
npm run legacy:import                          # dry run against the new DATABASE_URL
npm run legacy:import -- --apply
```

The export forces a read-only session and never writes. It carries master data,
what each customer owes and what each holds — not transactional history, which
the append-only ledgers cannot represent faithfully; keep the old database as an
archive. Anything the new schema cannot hold (negative cylinder custody, custody
on a deleted product, unknown product types) lands in a `review` block and the
import refuses to run until it is resolved or explicitly overridden.

The import goes through the services, never raw inserts — that is what makes
customers arrive with their `OPENING` ledger row and balance cache, products
with their `GodownInventory` row, and stock batches with the `StockAdjustment`
that gives the godown a count agreeing with the ledger. It is idempotent:
anything already present by name is skipped.

A fresh database is `npx prisma migrate deploy` then `npx prisma db seed`.
`prisma/migrations/0_init` is the baseline. Seed passwords come from
`SEED_OWNER_PASSWORD` / `SEED_OFFICE_PASSWORD` / `SEED_FIELD_PASSWORD` (or
`SEED_PASSWORD` for all three); with `NODE_ENV=production` the seed refuses to
run without them, and in dev it warns and falls back to a known value.

Prisma client is generated into `src/generated/client` (enums re-exported from
`src/generated/enums`) — import from there, never from `@prisma/client`.

Type-checking the app alone (root `npx tsc --noEmit` also pulls in stale
`.next/dev/types` and reports unrelated errors):

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep '^src/'
```

`src/` has no type errors; keep it that way. A clean checkout has no
`next-env.d.ts` (it is generated and gitignored), so run `npx next typegen` before
type-checking there — CI does.

**Time.** The agency works in India time and the server does not (Vercel runs in
UTC). Never use `setHours`, `getDate` or `toISOString().split("T")[0]` to find a
day on the server — use `src/lib/business-day.ts`. On the client, send a picked
date with date-fns `format(date, "yyyy-MM-dd")`, never `toISOString()`, which
turns local midnight into the previous day. Tests must not pin a calendar window
around rows stamped "now": they expire when the month changes.

CI (`.github/workflows/ci.yml`) runs lint, type-check, both test suites and the
build on every push and PR, against a Postgres service container. Its last step
migrates and seeds a *fresh* database, so the production cutover path is proven
on every run rather than the first time it is needed.

## Refactor status (branch `refactor-vibe-code`)

Modules are being reworked one at a time onto the layout described below.

`npm run build` passes, `src/` is free of type errors, and `npm run lint` is
clean — keep it that way.

| Module | Server | Client |
|---|---|---|
| location, product, vendor, customer | done | done |
| role (RBAC administration) | done | done (`/roles`, permission matrix) |
| purchase | done | done |
| dom-sale | done | done |
| arb-sale | done (reference module) | done |
| commercial-sale | done | done |
| customer-txn | done | done (`/customer-txn/[id]`, linked from the customer list) |
| expense | done | done |
| stock-adjustment | done | done (`/stock-adjustments`, create + log only) |
| report, dashboard | done | done |
| stock | done | done |
| users | done | done |

Every module is now on the layout below, server and client, and every service
has an integration test.

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
- **Dom / ARB sale** — `trNo` is `DOM-` / `ARB-{yyyymmdd}-{00001}` (India
  date) and is assigned after the header insert. `paidAmount <= totalAmount`.
  Ledger: `SALE_CHARGE +total`, `PAYMENT -paid`, `CustomerBalance += (total - paid)`.
  ARB is an outright sale of a non-cylinder: no cylinder is expected back.
- **Dom sale lines are `RENT` or `SALE`** (the `CommercialSaleType` enum, shared).
  `RENT` is a refill — `RENT_DELIVERY` out, and `emptiesCollected` back as
  `CYLINDER_RETURN`; the form fills that with the quantity. `SALE` is outright
  (`SALE_OUT`). **Both count as held** in `CustomerCylinderLedger`, unlike
  commercial: otherwise a customer who bought a cylinder could never hand its
  empty back for a refill. Empties are checked against the holding *before* the
  invoice, all lines of a product together. Each line records what it did
  (`cylindersDispatched`, `emptiesCollected`) and reversals undo exactly that —
  rows from before domestic custody existed are 0/0, so reversing one leaves the
  holding alone. A reversal is refused if it would take the holding below zero
  (the cylinders came back on a later invoice). Opening holdings at customer
  onboarding cover domestic as well as commercial products; the server refuses
  any non-cylinder product there.
- **Commercial sale** — per-line `RENT` or `SALE`. Both draw a filled cylinder
  from a `Stock` batch and out of the godown (`RENT_DELIVERY` / `SALE_OUT`);
  `RENT` additionally tracks custody (`cylindersDispatched` /
  `cylindersReturned`, mirrored in `CustomerCylinderLedger.pendingCylinder`).
  **Cylinders collected are recorded on the invoice being written**, as
  `CommercialSaleReturn` rows keyed on product, not on a line item — custody
  can come from an opening balance with no invoice behind it, so a collection
  cannot always be attributed to something once dispatched. They are checked
  against the holding *before* this invoice dispatches anything, and an invoice
  may carry no sale lines at all (a collection-only visit). `PATCH
  /api/commercial-sales/:id/return` still records a return against one specific
  line, and remains the correction path; an invoice with one cannot be edited. An invoice that already has returns recorded cannot be
  updated, and one with cylinders still outstanding cannot be deleted. Its
  reverse phase reads the invoice's own `CylinderTransaction` rows and undoes
  exactly the movement each caused, so dispatches and returns both unwind.
- **Customer txn** — `GET :id/balance`, `GET :id/transactions`,
  `POST :id/payments`, `DELETE :id/payments/:paymentId`. A payment reversal is an
  `ADJUSTMENT` row, never a delete, and it carries `voidedEntryId` back to the
  entry it undoes — `@unique`, so an entry can only ever be reversed once.
- **Expense** — private to its author unless the role holds `expense.read.all`
  (see RBAC below). The service takes an `Actor { userId, permissions }` and both
  filters lists and gates single-record access on it.
- **Report / dashboard** — read-only modules over the same models. Both scope on
  an `Actor { userId, permissions }` through `resolveScope`: own-scope users see
  only what they recorded, and all-scope users may narrow to one staff member.
  Every write refreshes the dashboard and godown queries (`use-api.ts`), since
  they aggregate nearly everything. Sale reports show **one row per item**
  (`report.lines.ts`, shared by the table and the export) with the invoice's
  money on its first line only, so totals still sum correctly. Reports return
  `{ summary, data, pagination }` (not the `ApiResponse` envelope — the report
  pages consume that shape directly); every `/export` route renders through
  `report.export.ts`, where `excel` is CSV and `pdf` is tab-separated text.
  Sale-by-product rolls up the three `*SaleItem` tables, since line items — not
  the invoice headers — carry the product. The report pages share
  `reports/_components` (filter card, summary tiles, results table, filter
  state); dom / arb / commercial are one `SaleReportView`, differing by a
  custody column (commercial) and a Type column (not ARB). The dashboard's client type is the service's own
  `DashboardResponse`, so the payload has one definition.

## RBAC

Per-module reference for configuring roles: `docs/RBAC.md`.

**Never authorize on a role name.** Roles are user-created data; permissions are
the contract. The one exception is `Role.isSystem`, which marks the OWNER role —
structurally special because it is the way back in after a misconfiguration.

- **The catalogue is code.** `PERMISSIONS` in `src/lib/permissions.ts` is the
  source of truth for codes, and `PERMISSION_REGISTRY` carries the module and
  label the admin UI renders. A unit test asserts they stay in step, so a new
  permission cannot be added without becoming grantable. `prisma db seed` syncs
  the catalogue *and deletes codes no longer in the registry*, taking their
  grants with them.
- **Roles are data.** Created, edited and deleted from `/roles`
  (`src/module/role/`). A system role cannot be renamed, edited or deleted and
  always holds everything — `isOwner` short-circuits every check in code, so a
  permission added in a release works for the owner before the seed runs.
- **Row-level scope is a granted pair**, resolved only in
  `src/lib/access-scope.ts`: `resolveScope(actor, SCOPES.EXPENSE)` returns
  `"all" | "own" | "none"`, and `scopeFilter` turns that into a `where` fragment.
  `"none"` throws rather than returning a filter that matches nothing — an empty
  list would look like an answer. Applies to expense, report and dashboard.
- **`withAuth` re-reads permissions from the database**, through the per-instance
  promise cache in `src/lib/rbac.ts` (~30s TTL, single-flight). It does *not*
  trust the cookie: `auth()` with no arguments takes Auth.js's RSC branch, which
  discards the refreshed `Set-Cookie`, so a token refreshed during an API request
  never reaches the browser. The session's copy of `permissions` is a hint for
  client rendering only, refreshed by `SessionProvider refetchInterval`.
  A revoked permission or a deactivated user stops working within seconds; RBAC
  writes call `invalidateRbac(userId)` to make it immediate.
- `withAuth(handler, [A, B])` requires **both**; `{ anyOf: [...] }` requires one.
- **Client gating is cosmetic.** `usePermission()` + `<ProtectedPage>` decide what
  renders; `withAuth` is the only real boundary. Both honour the system-role
  bypass so the UI agrees with the server.
- **Escalation guards** live in `src/module/user/user.service.ts`: only an owner
  may grant a system role or change another owner's password, nobody may edit
  their own role assignments or grant a permission they do not hold, and a user
  can never be left with zero roles. `assertNotLastOwner` keys on `isSystem`, not
  the name — matching on `"OWNER"` made it fail *open* if the role were renamed.
- Lost the owner password? `SEED_FORCE_OWNER_PASSWORD=1 npx prisma db seed`.
- **Every RBAC write is audited.** `writeRbacAudit(tx, …)` in
  `src/module/role/rbac-audit.service.ts` takes the transaction client first,
  like `writeStockAdjustment`, so the entry commits with the change it
  describes. `RbacAuditLog` is append-only and denormalises role/user/actor
  names, because the entry has to outlive what it describes. Readable at
  `/roles/audit`.

`session.user` carries `roles: string[]`, `permissions: Permission[]` and
`isOwner: boolean`. There is no `session.user.role`.
- **Customer** — creation seeds `CustomerInitialCylinderBalance` +
  `CustomerCylinderLedger` per product, an `OPENING` ledger row if
  `initialPendingAmount > 0`, and always a `CustomerBalance` row (even at 0) —
  every later write increments that row rather than creating it. Initial balances
  are migration data: the update payload does not even carry them. A customer
  with a non-zero balance or cylinders still out cannot be deleted.
- **Product** — creation also seeds the `GodownInventory` row, so the cylinder
  ledger always has somewhere to post. Delete is soft and refused while the
  godown holds any of that product or a batch still has quantity.
- **Vendor** — delete is refused while purchases or stock batches reference it
  (`onDelete: Restrict` would otherwise strand that paperwork).
- **Location** — the one hard delete in the app: no history of its own, and
  `Customer.locationId` is `SetNull`, so customers just lose the grouping.
- **Stock adjustment** — always two rows in one transaction (`StockAdjustment`
  with a mandatory free-text reason + an `ADJUSTMENT` `CylinderTransaction`) plus
  the godown cache, and never updated or deleted — post a correcting adjustment
  instead. `writeStockAdjustment(tx, …)` is exported so other modules post
  adjustments inside their own transaction rather than writing ledger rows by hand.
- **Godown** — read-only view at `/godown` over `GodownInventory` plus the
  `CylinderTransaction` ledger: filled and empty per product, how many are with
  customers, and every movement behind them. It re-derives each product's totals
  from the ledger and flags any row where the cache disagrees, so the invariant
  is visible in the UI rather than only in the tests. Non-cylinder products are
  excluded — their godown row would always read zero.
- **Stock** — batches normally come from a purchase and are read-only here
  (`isManual: false` in the response; the UI links back to the purchase). A manual
  batch is allowed for opening stock, and because nothing else would tell the
  ledger those cylinders exist, create / update / delete each post a
  `writeStockAdjustment` for the quantity delta — which is why every stock write
  takes a `reason`. Non-cylinder products skip that step, per the rule above.
  Lists hide drained batches unless `includeEmpty=true` (the sale forms want stock
  on hand; the stock page wants everything).
- **Role** — CRUD plus the permission matrix. Guards: a system role is immutable,
  a role still held by users cannot be deleted (`UserRole.roleId` cascades, so an
  unguarded delete would strip it silently and could leave a user with none), and
  an actor may only grant permissions it holds. `GET /api/permissions` serves the
  catalogue grouped by module for the editor.
- **Users** — a user may hold **several** roles; effective permissions are the
  union. Passwords are hashed with bcrypt and stripped by the serializer,
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
