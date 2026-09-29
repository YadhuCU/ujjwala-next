# Platform — everything that isn't a module

## Layout of a module (the contract)

Server, in `src/module/<name>/`:

| File | Role |
|---|---|
| `<name>.form.schema.ts` | zod for the **client form** (`z.coerce`, `""` → undefined, friendly messages) |
| `<name>.payload.schema.ts` | zod for the **HTTP payload**; money rounded in `.transform()`; `…QuerySchema` for lists |
| `<name>.service.ts` | all business logic; every write in **one** `prisma.$transaction` |
| `<name>.serializer.ts` | Prisma → JSON (`Decimal` → number, `null` → undefined); exports `…Response` |

Service file banners, in order: `CONSTANTS → INTERNAL TYPES → PURE HELPERS →
GUARDS → WRITE HELPERS → CREATE → LIST → SINGLE → UPDATE → DELETE`. Helpers take
`tx: Prisma.TransactionClient` first. `assert*` guards validate **and** return
what they fetched. Never trust `productId`/`productType` from the client — derive
from the `Stock` / `Product` row.

Routes (`src/app/api/**/route.ts`) are thin: `withAuth(handler, requirement)` →
parse with zod → call service → `formatResponse`. Never try/catch in a handler:
`routeErrorHandler` maps `AppError` subclasses, `ZodError` (422) and Prisma codes
(P2002→409, P2025→404, P2003→400). Throw `NotFoundError` / `BadRequestError` /
`ConflictError` / `ForbiddenError` / `UnauthorizedError` from `src/lib/errors.ts`.
`AppError` sets the prototype from `new.target`, so `instanceof ForbiddenError`
works (it did not before 2026-08-16).

Client, in `src/app/(dashboard)/<resource>/`: `page.tsx`, `add/page.tsx`,
`[id]/edit/page.tsx`, and `components/{view,create,update,form}.tsx`. Every page
is wrapped in `<ProtectedPage requiredPermission=…>`. Data goes through
`src/lib/api-client.ts` → `query-options.ts` / `query-keys.ts` → `hooks/use-api.ts`;
never inline fetch/axios.

## Auth and RBAC internals

Full model and rationale: `docs/RBAC.md` and `role.md`. The mechanics:

- **`src/lib/auth.config.ts`** — the *edge-safe* half, used by `src/proxy.ts`
  (middleware). No Prisma. `trustHost: true` (required for `next start` on a LAN
  host / Vercel; without it every sign-in fails `UntrustedHost`). Has
  `authorized` and `session` callbacks; **no `jwt` callback** on purpose.
- **`src/lib/auth.ts`** — the Node half: Credentials provider + the `jwt`
  callback. Refreshes the token's roles/permissions from the DB when older than
  **60s** or on `update()`; returns `null` (kills the session) for an inactive or
  deleted user.
- **`src/proxy.ts`** matcher excludes `/api`. Middleware re-signs the cookie on
  every matched request; on API routes that raced the handler's `Set-Cookie`.
- **`src/lib/api-auth.ts` — `withAuth`** is the real security boundary. It does
  **not** trust the cookie's permission list: `auth()` with no arguments takes
  Auth.js's RSC branch, which discards the refreshed `Set-Cookie`, so a
  mid-request token refresh never reaches the browser. It re-reads permissions
  via `loadRbacCached`. Requirement: `[A, B]` = all; `{ anyOf: [...] }` = any.
  The handler receives `{ ...session.user, userId, roles, permissions, isOwner }`
  with **fresh** values. A system-role holder (`isOwner`) passes every check.
  Zero roles → 401.
- **`src/lib/rbac.ts`** — `loadRbac(userId)` (one query) and `loadRbacCached`:
  per-instance `Map` storing the **promise** (single-flight), TTL **30s + up to
  5s jitter**, failures never cached. `invalidateRbac(userId)` is called by every
  RBAC write so changes are immediate on that instance.
- **Client** — `usePermission()` (`src/hooks/use-permissions.ts`) reads the
  session copy; `SessionProvider refetchInterval={60} refetchOnWindowFocus`
  keeps it roughly fresh. Cosmetic only. There used to be a role-based
  `usePermissions()` (plural) — deleted; never compare role names.
- **`src/lib/access-scope.ts`** — row-level "own vs all": `resolveScope(actor,
  SCOPES.X)` → `"all" | "own" | "none"`; `scopeFilter` → `{}` / `{ createdById }`
  / **throws** on `"none"` (an empty list would look like an answer).
  `assertCanAccessRecord` for single records. Used by expense, report, dashboard.

## Time — India, not the server

Vercel runs in UTC, 5h30 behind India. **Never** use `setHours`, `getDate`,
`setDate` or `toISOString().split("T")[0]` to find a day on the server. Use
`src/lib/business-day.ts`: `businessDayKey`, `startOfBusinessDay`,
`endOfBusinessDay`, `addBusinessDays` (fixed +05:30 — IST has no DST). On the
client send picked dates with date-fns `format(date, "yyyy-MM-dd")`; `toISOString`
turns local midnight into the previous day. This caused three bugs fixed
2026-09-30 (dashboard showed yesterday for "today"; early-morning sales on the
wrong day; report ranges shifted). Two `trNo` generators still use UTC — see
README known issues.

## The Prisma client (`src/lib/prisma.ts`)

- Generated into `src/generated/` (committed). Import from `@/generated/client`
  on the server and `@/generated/enums` anywhere that might reach a client bundle.
  Never `@prisma/client`. `postinstall: prisma generate` keeps it current on Vercel.
- `dns.setDefaultResultOrder("ipv4first")` **and** `net.setDefaultAutoSelectFamily(false)`:
  Neon returns AAAA records this network cannot route; both are needed or every
  query dies with ETIMEDOUT. The seed and legacy scripts set the same.
- `transactionOptions: { maxWait: 10_000, timeout: 20_000 }`: list endpoints pair
  `findMany` + `count` in `$transaction`; Prisma's 2s default is exhausted by
  cross-region latency ("Unable to start a transaction in the given time").
- Cached on `globalThis` in **production too** — serverless otherwise builds a
  client and pool per module instantiation.

## Client data layer

- `queryClient` default `staleTime: 30s`.
- `useApiMutation` / `useDeleteMutation` (`src/hooks/use-api.ts`) **always**
  invalidate `dashboard` and `godown` after success (`ALWAYS_INVALIDATE`), plus
  whatever the call site lists. Before this the dashboard never refreshed after a
  sale. Every write in the app goes through these two hooks — keep it that way.
- Forms: react-hook-form + zod + `useFieldArray`. **Read a row's current value
  from the render prop's `field.value` or `getValues`, never from the
  `useFieldArray` `field` object** — that is a snapshot from when the row was
  added. (That exact mistake blanked the stock dropdown on UAT; it was masked
  locally because an incidental `setValue` refreshes the snapshot.)
- Radix `SelectValue`: children `!== undefined` means "caller supplies the
  content". Pass `undefined`, never `null`, when you want Radix's fallback to the
  selected item's text.

## Testing

- `npm test` — `*.test.ts`, no DB (schemas, serializers, pure rules).
- `npm run test:integration` — `*.integration.test.ts`, real Postgres. Creates
  and migrates `<DATABASE_URL db>_test`; **refuses** a name not ending `_test`
  (`src/test/env.ts`) because every test truncates every table.
- `src/test/factories.ts`: `makeUser`, `makeRole(name, isSystem?)`,
  `makeUserWithRoles`, `makeProduct(type)`, `makeStock`, `makeCustomer`,
  `makeVendor`, `seedGodown` (posts a real StockAdjustment — never write
  `GodownInventory` directly, it starts the test already violating the
  invariant), `syncPermissionCatalogue`, and the invariant checks
  `assertGodownMatchesLedger`, `assertBalanceMatchesLedger`, plus
  `godownOf`, `balanceOf`, `custodyOf`.
- **Test dates must be relative to now** when rows are stamped `now()`. The report
  tests pinned August 2026 and silently broke when September began.
- Audit actors are real FKs: pass a real `userId`, not `1` or `0`.
- Playwright is not a project dependency; UI checks were run from a scratch dir
  against the dev server.

## CI (`.github/workflows/ci.yml`)

Postgres 16 service → `npm ci` → `prisma generate` → lint → **`next typegen`**
(a clean checkout has no `next-env.d.ts`, which declares image-import modules) →
`tsc` → unit → integration → build → migrate + seed a fresh database.

## Deployment and operations (details in `docs/DEPLOYMENT.md`)

- Vercel project builds `main` to `ujjwala-next.vercel.app`; branches get previews.
- **Build Command must be the default** (`npm run build`). It was once overridden
  to run `prisma migrate deploy`, which timed out on the Neon pooler (P1002) and
  would migrate the shared DB from every preview.
- **Migrations are run by hand**, against Neon's **direct** endpoint (hostname
  without `-pooler`), with `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true`. Apply the
  migration *before* merging code that needs it. Check with `prisma migrate status`.
- Never `SET` a session setting over the pooled endpoint — it leaks to whichever
  client gets that backend next (a read-only `SET` once made the whole app
  read-only). Use `BEGIN TRANSACTION READ ONLY`.
- Env on Vercel: `DATABASE_URL` (pooled), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`;
  function region `iad1` to sit beside Neon (us-east-1).
- Seed: `prisma db seed`. With `NODE_ENV=production` it requires `SEED_PASSWORD`
  (or per-user `SEED_*_PASSWORD`). Dev falls back to `owner123` etc. It syncs the
  permission catalogue (deleting retired codes), re-grants the system role
  everything, creates starter roles only if missing, and backfills scope grants.
  `SEED_FORCE_OWNER_PASSWORD=1` resets the owner password (break-glass).
- Migration history: `0_init` (baseline) → `add_voided_entry_id` →
  `rbac_role_management` → `rbac_audit_log` → `commercial_sale_returns` →
  `domestic_rent`. `Role.updatedAt` has `@default(now())` to match a DB default an
  early migration added; without it every `migrate diff` tried to drop it.
- Legacy scripts (`prisma/scripts/`): `export-legacy-data.ts` (read-only
  transaction), `import-legacy-data.ts` (through services, idempotent, dry-run by
  default), `backfill-customer-balances.ts`. Unused since the fresh start.
