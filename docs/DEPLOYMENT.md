# Deploying to Vercel

Branch `refactor-vibe-code` is pushed to `github.com/YadhuCU/ujjwala-next`. If
the repo is connected to a Vercel project, pushing produces a **preview
deployment** on its own URL; `main` is untouched, so whatever is deployed there
keeps working.

---

## 1. What was done to the database (2026-08-16)

The existing Neon `ujjwala` database **was wiped and rebuilt on the new schema**,
on request, after a verified backup.

It could not be migrated in place: it held 21 tables on the pre-refactor schema
(`sales`, `collections`, `rent_products`, `rent_transactions`, `accounts`), and
`0_init` starts by creating tables that already existed, so `migrate deploy`
aborted on its first statement. The refactor removed models rather than only
adding them, so no in-place upgrade exists.

### The backup — taken and verified before anything was dropped

In `~/ujjwala-backups/`:

| File | What it is |
|---|---|
| `ujjwala-full-20260816-1617.sql` | Complete `pg_dump` — schema and every row |
| `ujjwala-carryover-20260816-1617.json` | Structured export of what the new schema can accept |
| `seed-password.txt` | The generated owner/office/field password (change it, then delete) |

The dump was **restored into a scratch database and compared**, rather than
trusted for existing:

- 21 tables, all row counts identical (customers 46, sales 102, collections 58,
  rent_transactions 91, accounts 5)
- financial totals matched to the paisa — opening ₹22,25,752.00, sales
  ₹12,82,457.08, collected ₹6,11,197.99

To restore it:

```bash
psql "<neon url>" -f ~/ujjwala-backups/ujjwala-full-20260816-1617.sql
```

### What is in there now

Migrations `0_init` → `20260816120000_rbac_audit_log`, then the seed: 28 tables,
58 permissions, roles `OWNER` (system) / `OFFICE_STAFF` / `FIELD_STAFF`, and the
three logins. **No business data** — the old customers, balances and cylinder
custody are in the backup, not in the live database.

### The legacy data was deliberately not imported

The agency chose a fresh start, so the old customers, balances and cylinder
custody stay in the backup and never entered the live database. This also
retired the seven negative-custody rows that would otherwise have had to be
resolved first — see §2, kept for the record.

The carry-over file is still there and still valid, so the decision is
reversible. It does not need the old database:

```bash
LEGACY_EXPORT_PATH=~/ujjwala-backups/ujjwala-carryover-20260816-1617.json \
  npm run legacy:import -- --apply
```

It would carry master data, what each customer owes and what each holds — not
transactional history, which the append-only ledgers cannot represent
faithfully.

---

## 2. For the record: the rows that would have blocked an import

Not applicable now that the agency has chosen a fresh start (§1). Kept because
it documents a real data-quality gap in the old system, which is worth knowing
if anyone ever revisits that archive.

The new schema forbids negative cylinder custody:

| Customer | Product | Qty |
|---|---|---|
| ABHINAV | (deleted product) | −47 |
| SURENDRAN | 14.2 KG CYLINDER | −5 |
| BEACH HOTEL | 19 KG CYLINDER | −5 |
| PARAMOUNT TOWER | 19 KG CYLINDER | −7 |
| KOVILAKAM | 19 KG CYLINDER | −2 |
| customer 5 | product 9 (deleted) | −47 |
| customer 6 | product 9 (deleted) | 1 |

A negative count means more cylinders came back than went out — a data-entry gap
in the old system. Someone who knows the customers has to say the true figure.
Treating them as zero is defensible; guessing a positive number is not.

Two customers are in credit and import as a negative opening balance, which is
allowed but worth knowing: **SUBEESH ₹−51,719.99** and **SABU ₹−34,160**.

---

## 3. Environment variables to set in Vercel

Project → Settings → Environment Variables.

| Name | Value | Notes |
|---|---|---|
| `DATABASE_URL` | the Neon connection string | Use the **pooled** (`-pooler`) host. |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | **Currently the placeholder `your-nextauth-secret-here` locally — must be a real value here.** |
| `NEXTAUTH_URL` | the deployment's URL | Must match the address people actually open, or sign-in bounces back to the login page. |
| `SEED_PASSWORD` | a strong password | Only needed when running the seed. With `NODE_ENV=production` the seed refuses to run without it. |

`AUTH_TRUST_HOST` is not needed — `trustHost: true` is set in
`src/lib/auth.config.ts`.

### Put the functions in the same region as the database

Vercel → Settings → Functions → Region. Neon `ujjwala` is in **us-east-1**, so
choose **Washington D.C. (iad1)**. Every list endpoint pairs `findMany` with
`count` inside one transaction; across regions the round trips alone can exhaust
Prisma's window and the request fails with *"Unable to start a transaction in
the given time"*. The client now allows 10s to acquire one, which absorbs the
latency, but co-locating is the actual fix and costs nothing.

---

## 4. First deploy, step by step

1. **Set the environment variables** above.
2. **The database is already migrated and seeded** (§1). For a *different*
   database, from a machine with the URL — not from Vercel:

   ```bash
   DATABASE_URL=<url> PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK=true npx prisma migrate deploy
   DATABASE_URL=<url> SEED_PASSWORD=<strong> NODE_ENV=production npx prisma db seed
   ```

   `PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK` is needed against Neon, whose
   connection handling times out Prisma's advisory lock. The seed is idempotent.
3. Legacy import — **not done, by choice** (§1).
4. **Redeploy** in Vercel so the build picks up the variables.
5. **Sign in as `owner`** and change the seeded passwords at `/users`.

### Verifying it came up

- `/login` renders and signing in as `owner` reaches the dashboard.
- `/roles` lists OWNER (badged *system*), OFFICE_STAFF and FIELD_STAFF.
- `/godown` shows every cylinder product **in sync**.
- Creating a role and assigning it appears at `/roles/audit`.

---

## 5. Notes for the build

- `postinstall: prisma generate` runs on every install. Vercel restores a cached
  `node_modules` and will not generate the client on its own; the client is also
  committed, but that copy goes stale whenever the schema moves.
- The build needs no database connection. Every page that reads data is either a
  client component or a dynamic route.
- `npm run build` takes about a minute; `next start` is ready in about a second.

## 6. Rolling back

The preview deployment is per-commit, so rolling back is redeploying an earlier
one from the Vercel dashboard. The database does not roll back with it — if a
migration has been applied, restore from a Neon branch or point-in-time restore.
That is the reason for taking a Neon branch before anything destructive.
