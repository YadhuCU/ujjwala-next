# Deploying to Vercel

Branch `refactor-vibe-code` is pushed to `github.com/YadhuCU/ujjwala-next`. If
the repo is connected to a Vercel project, pushing produces a **preview
deployment** on its own URL; `main` is untouched, so whatever is deployed there
keeps working.

---

## 1. The database is the part that needs a decision

**The existing Neon `ujjwala` database cannot be migrated to this schema.** It
is not a matter of care — `prisma migrate deploy` fails on the first statement.

| | Existing Neon `ujjwala` | This branch expects |
|---|---|---|
| Tables | 21, including `sales`, `collections`, `rent_products`, `rent_transactions`, `accounts` | those four are gone; 12 new ones including `users`, `roles`, `permissions`, `cylinder_transactions`, `customer_payment_ledgers`, `rbac_audit_logs` |
| Migration history | `20260502000000_add_paid_amount_commercial_module` and predecessors | a single `0_init` baseline, unrelated to the above |

`0_init` begins by creating tables that already exist, so the migration aborts.
There is no in-place upgrade path, because the refactor removed models rather
than only adding them.

### What that database currently holds

Measured read-only on 2026-08-16:

- 11 locations, 2 vendors, 11 products, 9 stock batches (389 units)
- **40 customers — 27 of them owing ₹23,61,834.85**
- 10 customers holding 86 cylinders between them

### The three ways forward

**A — New database on the same Neon project (recommended).**
Create a second database (or a Neon branch) alongside `ujjwala`. Deploy against
that. The old one stays exactly as it is, as the archive. This is what
`CLAUDE.md` has assumed all along: *"keep the old database as an archive"*.
Nothing is lost, and it is reversible at any point.

**B — Carry the data across into a fresh database.**
As A, but populate it from the old one first:

```bash
LEGACY_DATABASE_URL=<old neon url> npm run legacy:export   # read-only
npm run legacy:import                                      # dry run
npm run legacy:import -- --apply
```

This carries master data, what each customer owes, and what each holds. It does
**not** carry transactional history — the append-only ledgers cannot represent
the old rows faithfully, which is why the old database is kept as the archive.
Seven rows need a decision first; see §2.

**C — Wipe and rebuild `ujjwala` in place.**
Drop every table and start from `0_init`. **Irreversible, and it destroys the
₹23.6 lakh of receivable records above** unless B's export is run first and
imported afterwards. Take a Neon branch as a restore point before doing this.

---

## 2. The seven rows blocking an import

The new schema forbids negative cylinder custody, so these must be resolved or
explicitly overridden before `legacy:import` will run:

| Customer | Product | Qty |
|---|---|---|
| ABHINAV | (deleted product) | −47 |
| SURENDRAN | 14.2 KG CYLINDER | −5 |
| BEACH HOTEL | 19 KG CYLINDER | −5 |
| PARAMOUNT TOWER | 19 KG CYLINDER | −7 |
| KOVILAKAM | 19 KG CYLINDER | −2 |
| customer 5 | product 9 (deleted) | −47 |
| customer 6 | product 9 (deleted) | 1 |

A negative count means more cylinders came back than went out — a data-entry
gap in the old system. Someone who knows the customers has to say what the true
figure is. Treating them as zero is defensible; guessing a positive number is not.

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

---

## 4. First deploy, step by step

1. **Set the environment variables** above.
2. **Prepare the database** (from a machine with the URL, not from Vercel):

   ```bash
   DATABASE_URL=<new neon url> npx prisma migrate deploy
   DATABASE_URL=<new neon url> SEED_PASSWORD=<strong> NODE_ENV=production npx prisma db seed
   ```

   The seed creates the `OWNER` / `OFFICE_STAFF` / `FIELD_STAFF` roles, the
   permission catalogue, and the three logins. It is idempotent.
3. **Optionally import the legacy data** (§1B).
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
