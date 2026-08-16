# Access control, module by module

Who can do what, how it is decided, and what to tick when configuring a role.
Verified against the code on 2026-08-16.

---

## 1. The idea in one minute

Three things decide whether an action is allowed:

1. **Permissions** — fixed codes like `expense.read` or `purchase.delete`. Every
   API route names the permission it needs. Codes are defined in the source
   because a permission no route checks would grant nothing, so they cannot be
   invented from the screen.
2. **Roles** — named bundles of permissions. Fully managed at **Roles &
   Permissions** in the sidebar: create, edit, delete, and tick a matrix.
3. **Users** — hold **one or more roles**. What they can do is the union of
   every role they hold.

**Nothing is decided by a role's name.** A role called `ACCOUNTANT` gets its
power from the boxes ticked against it, not from what it is called. The single
exception is the **system role** (`OWNER`), which is structurally special — see
§5.

Changes take effect within about a minute without anyone signing out, and
immediately for the person who made them.

---

## 2. Reading a permission code

```
expense . read . own
   │       │      │
   │       │      └── scope: whose records (optional)
   │       └───────── action: read / create / update / delete
   └───────────────── module
```

Most modules have four: view, add, edit, delete. Three modules add a **scope**,
because their records belong to whoever recorded them.

---

## 3. Every module

Legend: **View / Add / Edit / Delete** are the four codes for that module.
"Author-scoped" means the module distinguishes *your* records from everyone's.

| Module | Screen | Permissions | Author-scoped | Notes |
|---|---|---|---|---|
| **Dashboard** | `/` | `dashboard.read` + a scope, plus `dashboard.financials` | **Yes** | See §4. Money totals are a separate tick from how far the figures reach. |
| **Godown** | `/godown` | `stock.read` | No | Read-only. Cylinder position per product and the movement ledger. |
| **Stock** | `/stock` | `stock.*` | No | `stock.update` also gates posting a stock adjustment. |
| **Stock adjustments** | `/stock-adjustments` | View: `stock.read`, Post: `stock.update` | No | Append-only; nothing can edit or delete one. |
| **Purchases** | `/purchases` | `purchase.*` | No | Everyone who can view purchases sees all of them. |
| **Domestic sale** | `/dom-sales` | `domestic_sale.*` | No | See the note below the table. |
| **ARB sale** | `/arb-sales` | `arb_sale.*` | No | |
| **Commercial sale** | `/commercial-sales` | `commercial_sale.*` | No | Recording a cylinder return needs `commercial_sale.update`. |
| **Customers** | `/customers` | `customer.*` | No | |
| **Customer transactions** | `/customer-txn/[id]` | View: `customer.read`, Payments: `customer.update` | No | Recording and reversing payments both need `customer.update`. |
| **Expenses** | `/expenses` | `expense.read` + a scope, `expense.create/update/delete` | **Yes** | Editing and deleting are limited to what the user can see. |
| **Products** | `/products` | `product.*` | No | |
| **Vendors** | `/vendors` | `vendor.*` | No | |
| **Locations** | `/locations` | `location.*` | No | |
| **Reports** | `/reports/*` | `report.read` + a scope, `report.export` | **Yes** | Agency-wide scope also unlocks the "Staff" filter. |
| **Users** | `/users` | `user.*` | No | Extra guards in §5. |
| **Roles & permissions** | `/roles` | `role.*` | No | Changes are recorded — see §6. |

> **Sale and purchase lists are not author-scoped.** Anyone who can view a sale
> type sees every invoice of it, including colleagues'. Only expenses, reports
> and the dashboard distinguish own records. This was a deliberate choice; if
> the agency wants field staff to see only their own invoices, it is a small
> addition rather than a redesign.

---

## 4. The three author-scoped modules

These need **two** ticks, not one:

- **`…read`** — may open the module at all.
- **`…read.own`** — sees only records they recorded.
- **`…read.all`** — sees everyone's.

Tick `read` plus exactly one scope. `read.all` wins if both are ticked.

**Ticking `read` and no scope means the user can open the module and see
nothing.** The role editor warns about this in amber before you save.

| | `expense.*` | `report.*` | `dashboard.*` |
|---|---|---|---|
| Own only | `read` + `read.own` | `read` + `read.own` | `read` + `read.own` |
| Whole agency | `read` + `read.all` | `read` + `read.all` | `read` + `read.all` |

**The dashboard has a fourth tick.** `dashboard.financials` controls the money
cards — Revenue, Net Profit, Total Expenses. Without it the dashboard still
shows cylinder counts and Collections. It is separate from scope on purpose:
a supervisor can see agency-wide *volumes* without seeing agency-wide *money*,
or see their own revenue without seeing anyone else's.

---

## 5. The system role, and why it cannot be edited

`OWNER` is marked as a **system role**. It cannot be renamed, edited or
deleted, by anyone, and it always holds every permission — that is enforced in
code, not by the ticks stored against it, so a permission added in a future
release works for the owner before anyone re-runs the seed.

This exists so a misconfiguration is always recoverable. Everything else is
freely editable precisely *because* this one is not.

Guards that follow from it:

- The **last active owner** cannot be deleted, deactivated, or stripped of the
  owner role.
- Only an owner may **grant the owner role**, or **change another owner's
  password**.
- Nobody may **change their own role assignments** — an owner has to do it.
- Nobody may **grant a permission they do not hold themselves**, so `role.update`
  cannot be used to mint unlimited access.
- A role **still held by users cannot be deleted**; reassign them first. A user
  can never be left with zero roles.

If the owner password is ever lost:

```bash
SEED_FORCE_OWNER_PASSWORD=1 npx prisma db seed
```

---

## 6. Access history

**Roles & Permissions → Access history** (`/roles/audit`) records every change:
who made it, when, to which role or user, and exactly which permission codes
were added or removed.

It is append-only — never edited, never deleted — and it keeps the name of a
role or user even after that role or user is gone, so an entry still reads
correctly months later. Saving a form without actually changing anything
records nothing.

---

## 7. What the three seeded roles start with

Starting points only. All three are editable except OWNER, and re-running the
seed will not undo your changes to them.

| | Owner | Office staff | Field staff |
|---|---|---|---|
| Permissions held | all 58 | 19 | 15 |
| Record sales (all three kinds) | ✅ | ✅ | ✅ |
| Record expenses | ✅ | ✅ | ✅ |
| See others' expenses | ✅ | ❌ own only | ❌ own only |
| Create customers | ✅ | ✅ | ❌ |
| View customers, products, stock, godown, locations | ✅ | ✅ | ✅ |
| View vendors | ✅ | ✅ | ❌ |
| Purchases | ✅ | ❌ | ❌ |
| Cylinder returns, payments, stock adjustments | ✅ | ❌ | ❌ |
| Edit or delete anything posted | ✅ | ❌ | ❌ |
| Reports | ✅ whole agency | ⚠️ own records only | ❌ |
| Dashboard money cards | ✅ | ❌ | ❌ |
| Users, roles | ✅ | ❌ | ❌ |

Two people can look at the same screen and correctly see different numbers.

---

## 8. Configuring a new role — worked example

*"Accountant: sees all expenses and all reports, but cannot record sales."*

1. **Roles & Permissions → Add Role**, name it `Accountant`.
2. Expenses: tick **Open expenses** and **See everyone's expenses**.
3. Reports: tick **Open reports**, **Report on the whole agency**, and
   **Export to Excel / PDF**.
4. Dashboard: tick **Open the dashboard**, **Agency-wide figures**, and
   **See revenue, profit and expense totals**.
5. Leave every sale module unticked.
6. Save, then **Users → edit the person → tick Accountant**. Leave their
   existing role ticked as well if they should keep it — permissions add up.

They will see the change within about a minute, without signing out.

---

## 9. For developers

- Route enforcement: `withAuth(handler, [PERMISSIONS.X])` in
  `src/lib/api-auth.ts`. An array means *all* of them; `{ anyOf: [...] }` means
  any one.
- Scope: `resolveScope(actor, SCOPES.EXPENSE)` in `src/lib/access-scope.ts` is
  the only place own-vs-all is decided.
- The catalogue: `PERMISSIONS` and `PERMISSION_REGISTRY` in
  `src/lib/permissions.ts`. A unit test fails if a code exists without matching
  registry metadata, so a new permission cannot be added without becoming
  grantable from the screen.
- `npx prisma db seed` syncs the catalogue **and deletes codes no longer in the
  registry**, taking their grants with them. Run it after every deploy.
- Client-side gating (`usePermission`, `<ProtectedPage>`) decides what renders.
  It is a courtesy, not a boundary — `withAuth` is the boundary.
