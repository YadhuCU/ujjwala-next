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

## Mobile layout

Most users are on phones, so every screen has to work at 360px. What holds it
together, so a new screen does not undo it:

- **A responsive grid needs a base column count.** `grid md:grid-cols-2` alone
  gives implicit `auto` tracks on a phone, which grow to fit their content —
  that is how the dashboard charts ended up wider than the screen and clipped.
  Write `grid grid-cols-1 md:grid-cols-2` (`grid-cols-1` is `minmax(0,1fr)`).
  The dialog overlay and content carry `grid-cols-1` for the same reason.
- **`<DataTable>` renders cards below `md`** (`MobileRows` in
  `src/components/data-table.tsx`): the first column is the title, a column
  with `id: "actions"` sits top-right, the rest are label / value pairs, and
  blank accessor values are dropped. So the first column of a list should be
  the thing that identifies the row, and the actions column must keep the id
  `actions`. `ReportResults` does the same (first column title, last column —
  the money — opposite it, "—" and empty cells dropped). Hand-written tables
  (dashboard, godown, access history) render a `md:hidden` list next to a
  `hidden md:table` table.
- **Mobile-only tweaks use `max-sm:` / `max-md:`**, not a small base value with
  an `sm:` override, wherever a caller may pass its own padding. `Card`,
  `CardHeader/Content/Footer` and `DialogContent` tighten to `px-4` / `py-4` on
  phones this way, so a card that sets its own `p-4` cannot inherit the desktop
  value through `tailwind-merge`.
- **Tap targets**: `Button` (default and icon), `Input` and `SelectTrigger` are
  40px tall below `md`, 36px above; select items get more padding. Inputs stay
  `text-base` on phones so iOS does not zoom on focus.
- `PageWrapper` puts the page's `addButton` on its own full-width row on a
  phone. Form footers are `grid grid-cols-2 gap-3 sm:flex` (equal-width Save /
  Cancel). Line-item cards are two columns on a phone: the product and the
  line total span both (`[&>*:first-child]` / `[&>*:last-child]`), short
  fields pair up.
- The phone sidebar is a sheet; its links call `setOpenMobile(false)` so
  navigating closes it. The date range picker shows one month below `md`.

To check a change, drive the page at 390×844 and 360×800 and look at the
screenshot — `scrollWidth` alone is not enough, because `main` scrolls and
clipped content never widens the document.

## Theme and graphics

One theme, **Ujjwala HP gas agency ERP**, in light and dark (`next-themes`, the
header's sun/moon menu). There is no colour-theme picker: the old HP
Enterprise and Enterprise Blue themes and the `data-theme` attribute are gone.
The palette lives on `:root` and `.dark` in `src/app/globals.css`:

| Token | Light | Use |
|---|---|---|
| `--sidebar` / `--sidebar-accent` / `--sidebar-primary` | `#b51b24` / `#9b151d` / `#841019` | HP red sidebar, hover, active item (white marker `--sidebar-active-border`); also the sign-in brand panel |
| `--sidebar-label` | `#ffe3e1` | section labels on the red |
| `--sidebar-header` | white | brand header above the red (dark: the card surface) |
| `--wordmark` / `--wordmark-caption` | `#df1a14` / `#183653` | "Ujjwala" / "HP gas agency ERP" |
| `--primary` | `#004e8f` HP blue | buttons, links, selected controls outside the sidebar |
| `--signal` / `--destructive` | `#df1a14` red | header top rule, alerts, delete |
| `--background` / `--card` / `--border` | `#f3f6fb` / white / `#dfe7f0` | base ground / surfaces / blue-grey borders (inputs, tables, tiles) |
| `--page` / `--page-gradient` | `#c6ddf8`; `#dcecff → #c6ddf8 → #b3d0f2` with a `#92bfee` glow top right | the page behind the cards — the `bg-page` utility, on `SidebarInset` and the sign-in page; `background-attachment: fixed` |
| `--card-border` / `--card-shadow` | `#ccddf0` / soft blue shadow | every `Card` (`border-card-border shadow-card`) |
| `--hero-gradient` / `--hero-border` | white → `#e6f1ff` → `#c9e1fc` / `#c5daf0` | the dashboard hero (`bg-hero`) |

Dark mode keeps the sidebar red but deeper (`#861620`, hover `#701219`, active
`#5e0c13`); the brand header turns to the card surface and the logo keeps
its own white plate; the page gradient and the hero turn deep navy rather than
reusing the pale blue. Red outside the sidebar is a signal — keep it to the
places above. Components style through the tokens; a hex in a component is a
bug.

**Brand.** The name is exactly "Ujjwala HP gas agency ERP" (`APP_NAME` in
`src/components/brand-mark.tsx`, and the page metadata), always HTML text,
never part of an image. `BrandLogo` is the full HP Gas logo — mascot, Hindi
lettering, divider, HP GAS emblem, "your friendly gas" — from
`public/brand/hp-gas-full-logo.webp`. It is an AI-assisted restoration of a
low-resolution original supplied by the agency, not an official master; the
original and the full-size PNG stay with the design handoff. Transparent, with
navy lettering, so it always sits on a white plate (dark mode too),
`object-contain`, never cropped or recoloured. `BrandLockup` (sidebar header)
puts it on its own row above `BrandName` (red "Ujjwala" over "HP gas agency
ERP"); the sign-in plate uses the same pieces, a row on a phone and stacked and
larger from md up. The logo is unreadable below ~80px tall, so the favicon
(`src/app/favicon.ico`) is the HP GAS emblem alone. The sidebar collapses
off-canvas, so there is no icon-only state that would need it.

**Cylinder artwork** (`public/brand/`, through `CylinderImage`):
`blue-cylinder-single.webp` (one blue commercial cylinder) for the cylinder
position tiles and the loading screen — `empty` greys it for empty stock;
`blue-cylinder-group.webp` (three cylinders) for the dashboard hero and the
sign-in panel only, never for a count. Both are generated illustrations, not
HPCL photographs. PNG originals stay with the design handoff, not the repo.

**Why `/brand` is excluded from the auth proxy.** The matcher in
`src/proxy.ts` would otherwise redirect `/brand/*` (and the `/_next/image`
optimiser's fetch of it) to sign-in, and the sign-in page could not show its
own logo. Only public artwork belongs in `public/brand/`.

Shared pieces: badges have soft `success` / `warning` / `info` / `muted`
variants; tables have a tinted header row; entry forms end in `FormSummary`
(`src/components/form-summary.tsx`), the document's total beside its save and
cancel buttons. The sidebar groups links into sections (`navSections` in
`app-sidebar.tsx`); the header's breadcrumb is `navTrail(pathname)` over the
same list, so add a page there once and both pick it up.

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
