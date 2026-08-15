# Ujjwala — Demo Walkthrough

A script for demonstrating the system, and a map of what it does. Everything
here was verified against the app on 2026-08-15.

---

## 1. What the system is, in one minute

An LPG gas agency buys cylinders from vendors, sells or rents them to customers,
and has to answer two questions at any moment:

- **Where are my cylinders?** In the godown (filled or empty), or with a customer.
- **Who owes me money?** Per customer, with the history behind the number.

Everything in the app serves those two questions. Sales, purchases, returns and
adjustments are all just events that move cylinders or money.

**The one idea worth explaining in a demo.** Two tables are append-only and
never edited: the **cylinder ledger** (every cylinder movement) and the **money
ledger** (every charge and payment). Every number you see on screen — godown
counts, customer balances, cylinders held — is a running total derived from
those ledgers. Nothing is ever silently overwritten, and a mistake is corrected
by posting a reversal, not by editing history.

That is what makes the numbers trustworthy, and it is the thing to say out loud
when someone asks "how do we know this is right?".

---

## 2. Before the demo

```bash
npx prisma migrate deploy     # build the schema
npx prisma db seed            # roles, permissions, three users
npm run dev                   # http://localhost:3000
```

Seeded logins (development passwords — production takes them from
`SEED_PASSWORD`):

| Username | Password | Role | Use it to show |
|---|---|---|---|
| `owner` | `owner123` | OWNER | everything |
| `office` | `office123` | OFFICE_STAFF | restricted view |
| `field` | `field123` | FIELD_STAFF | salesperson view |

**Have this ready before you present**, or the first five minutes are data
entry: one location, one vendor, two products (a 14.2 kg DOMESTIC and a 19 kg
COMMERCIAL), one purchase of ~20 of each, and two or three customers. Steps 1–3
below create it, so you can either rehearse them or do them live.

---

## 3. The demo script

Twelve steps, roughly 15 minutes. Each says what to do and what to point out.

### Step 1 — Products (`/products`)

Create **14.2 kg Domestic** (type DOMESTIC) and **19 kg Commercial** (type
COMMERCIAL).

> Say: product type is not cosmetic. DOMESTIC and COMMERCIAL are cylinders and
> get tracked individually; ARB (bulk gas) and OTHER (stoves, hoses, gas books)
> are stock lines only. The system knows the difference and behaves differently
> for each.

### Step 2 — Vendor and location (`/vendors`, `/locations`)

Create one of each. Fast, but sets up the purchase.

### Step 3 — Purchase (`/purchases/add`)

Vendor, invoice number, date, then **Add Item**: product, type **FULL**,
quantity 20, unit cost.

> Say: this is a delivery of brand-new full cylinders. **FILL** is the other
> case — we send empties, the vendor sends them back full. The system will not
> let you record a FILL for more empties than you actually have.

### Step 4 — Godown (`/godown`) ← the money shot

> Say: 20 cylinders arrived, and here they are. Filled, empty, with customers,
> and every movement that produced those numbers.

Point at the **in sync** badge: the totals are re-derived from the ledger on
every page load and compared to the running count. If they ever disagree, this
page says so and names the product.

### Step 5 — Domestic sale (`/dom-sales/add`)

Customer, pick the batch, quantity 2, price, part payment.

> Say: you sell from a **batch**, not from a product — that keeps traceability
> from vendor delivery to customer. Note the customer's outstanding balance
> shows at the top of the form before you commit.

### Step 6 — Back to the godown

Filled has dropped by 2, and there is a new **Sold out** movement.

> Say: one action, three consistent effects — the batch, the godown, and the
> customer's balance. All inside one transaction: if any part fails, none of it
> happens.

### Step 7 — Commercial rental (`/commercial-sales/add`)

Customer, line type **RENT**, quantity 5.

> Say: renting is different from selling. The cylinders leave the godown but we
> still own them, so the system tracks custody — who has how many.

### Step 8 — Cylinder return (return icon on the invoice row)

Return 2 of the 5.

> Say: a return is its own event, days or weeks later — not an edit of the
> invoice. Empties come back into the godown, the customer's held count drops
> to 3. Try to return 6 and it refuses.

### Step 9 — Customer transactions (ledger icon on `/customers`)

> Say: what they owe, what they're holding, and every entry behind it.

**Record Payment** → 500. The balance drops. Then hit the reverse arrow on that
payment.

> Say: the payment is not deleted. A reversing entry is added, and both stay on
> the record forever. And it can only be reversed once — the database enforces
> that, not just the app.

### Step 10 — Correction (`/purchases`, edit the purchase from step 3)

Change quantity 20 → 12, save. Then go back to `/godown`.

> Say: this is the part that matters for an audit. The original entry was not
> rewritten — you can see the reversal, then the corrected entry. The godown
> lands on the right number and the trail explains how.

The movements list shows the reversal rows badged **reversal**.

### Step 11 — Stock adjustment (`/stock-adjustments/add`)

Product, filled −1, reason "Physical count short by one".

> Say: when the shelf disagrees with the system, you correct it here — and the
> reason is mandatory. Adjustments cannot be edited or deleted; if one was
> wrong, you post the opposite. Frequent adjustments are a signal that something
> upstream is being missed.

### Step 12 — Reports and dashboard

`/reports/dom-sale` → set the date range → **Search** → **Export**
(Excel or PDF). Then the dashboard, which opens with the same godown position
you showed in step 4 — cylinders first, money second — followed by revenue,
profit, collections, the trend, and the customers worth chasing.

> Say: every report scopes to who is asking. An owner sees the whole agency; a
> staff member sees only their own paperwork.

**Optional finish:** log out, log in as `field`, and show the same app with
fewer options — no reports, no purchases, no edit or delete.

---

## 4. Feature map

| Area | Where | What it does |
|---|---|---|
| Dashboard | `/` | Opens with the godown position — filled, empty, out with customers — then revenue, profit, expenses, collections, daily trend, revenue by product, low stock, and customers holding cylinders or debt too long |
| Godown | `/godown` | Filled/empty per product, cylinders with customers, full movement ledger, cache-vs-ledger check |
| Stock | `/stock` | Batches on hand; manual batches for opening stock (posts an adjustment) |
| Stock adjustments | `/stock-adjustments` | Manual corrections with a mandatory reason; append-only log |
| Purchases | `/purchases` | FILL and FULL deliveries, auto or vendor batch numbers, correction by void-and-repost |
| Domestic sale | `/dom-sales` | Outright cylinder sale from a batch |
| ARB sale | `/arb-sales` | Bulk gas / accessories — stock and money only, no cylinder tracking |
| Commercial sale | `/commercial-sales` | Per-line RENT or SALE, cylinder custody, separate return event |
| Customers | `/customers` | Master data plus opening balances captured once at registration |
| Customer transactions | `/customer-txn/[id]` | Balance, cylinders held, full ledger, record and reverse payments |
| Expenses | `/expenses` | Private to whoever recorded them; owners see everyone's |
| Reports | `/reports/*` | Commercial, domestic, ARB, sale-by-product, expense, purchase — all with Excel/PDF export |
| Users | `/users` | Accounts and roles, activate/deactivate |

---

## 5. Who can do what

| | Owner | Office | Field (sales) |
|---|---|---|---|
| Record sales (all three kinds) | ✅ | ✅ | ✅ |
| Record expenses | ✅ | ✅ | ✅ |
| See other people's sales/expenses | ✅ | ❌ own only | ❌ own only |
| Create customers | ✅ | ✅ | ❌ |
| Read locations, products, stock | ✅ | ✅ | ✅ |
| Purchases | ✅ | ❌ | ❌ |
| Cylinder returns, payments, adjustments | ✅ | ❌ | ❌ |
| Edit or delete anything posted | ✅ | ❌ | ❌ |
| Reports | ✅ | ✅ | ❌ |
| Dashboard money cards | ✅ full | ⚠️ collections only | ⚠️ collections only |
| Users and roles | ✅ | ❌ | ❌ |

Staff dashboards and reports are scoped to what that person recorded — including
collections. Two people can look at the same screen and correctly see different
numbers.

---

## 6. If someone asks a hard question

**"What if someone makes a mistake?"** — Step 10. Corrections are reversals, and
both entries survive. Nothing is quietly rewritten.

**"How do we know the stock figure is right?"** — Step 4. The godown page
re-derives the total from the ledger and shows whether the two agree, per
product.

**"Can a salesperson see the whole agency's numbers?"** — No. Show it: log in as
`field`, look at the dashboard.

**"What stops a bad entry?"** — Selling more than the batch holds, refilling
more empties than exist, returning more cylinders than were dispatched, paying
more than the invoice total, deleting a customer who still owes money, deleting
a rental with cylinders outstanding, deactivating the last owner: all refused,
with the reason shown.

**"Is it tested?"** — 42 unit tests and 137 integration tests against a real
database, plus CI that migrates and seeds a fresh database on every change.

---

## 7. Known gaps — steer around these

Honest list, so nothing surprises you mid-demo.

- **Empty-cylinder counts start at zero** and only populate as rentals come
  back. Don't open the godown page expecting empties on a fresh database.
- **The reports and dashboard have no per-role card rules yet** beyond hiding
  revenue and profit from staff. The dashboard rework (rename Revenue → Sale,
  stock at the top, expense/profit pies, per-card export) is still open — see
  `TODO.md`.
- **No customer outstanding/dues report** yet. Per-customer balances live on the
  customer transactions page instead.
- **Product still carries its own sale price**; the intent was to price from the
  batch. Sale forms prefill from the product.
- **The purchase date picker stays open** after you pick a date and covers the
  Save button until you click elsewhere. Cosmetic, but it will look clumsy live
  — click away deliberately.
- **Discounts are not hidden from sales users** yet, and the sale report date
  range is editable by everyone.

If you change roles or permissions, re-run `npx prisma db seed` — permissions
live in the database, so an edit to `prisma/seed.ts` alone changes nothing until
it is applied. A stale seed shows up as unexplained 403s in the browser console
while the page still renders.

---

## 8. Route cheat sheet

```
/                       dashboard
/godown                 cylinder position + movement ledger
/stock                  batches          /stock/add
/stock-adjustments      corrections      /stock-adjustments/add
/purchases              deliveries       /purchases/add
/dom-sales              domestic sales   /dom-sales/add
/arb-sales              bulk / accessory /arb-sales/add
/commercial-sales       rent and sale    /commercial-sales/add
/customers              customers        /customers/add
/customer-txn/[id]      balance + ledger + payments
/expenses               expenses         /expenses/add
/products /vendors /locations /users
/reports/commercial-sale  /reports/dom-sale  /reports/arb-sale
/reports/sale-by-product  /reports/expense   /reports/purchase
```
