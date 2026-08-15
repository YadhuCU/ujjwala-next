# TODO

Verified against the code on 2026-08-15 (branch `refactor-vibe-code`). Each item
was checked in the source, not assumed — notes say where something is only
partly true.

## 22/02/2026

- [x] User Type | Add New Usertype - Sales, total - Owner, Office, Sales
      — seeded as `OWNER` / `OFFICE_STAFF` / `FIELD_STAFF`
- [x] Commercial Sale | Payment Type - Cash, Cheque
- [x] ARB Product | New Sale Type (All Usertype)
      — `FIELD_STAFF` now has create on all three sale types (read-own only,
      no update or delete), plus the product and stock reads a sale form needs
- [ ] Dashboard | Add Check & Cash Details in Collection Card
      — collections is one total; the ledger has `paymentType`, so the split is
      available but not surfaced
- [x] Dashboard | Add Stock Information, Add List of customers (cylinders, pending amount)
      — low-stock table + `commercialAnalytics` (cylinders out, high balances)
- [x] Dashboard | Add Customer information about pending amount, cylinder
- [x] Dashboard | Sale Trend
- [x] Dashboard | Move Stock information to Top
      — the dashboard now opens with a godown panel: filled, empty, out with
      customers, and the busiest products, above everything else
- [ ] Dashboard | Change Revenue name to Sale
      — still "Total Revenue", "Revenue & Profit Trend", "Revenue by Product"
- [x] Product | Add Product type ARB, Domestic, Commercial and Other (Dropdown)
- [ ] Product | Remove price field, Use stock price for sale
      — `Product.salePrice` still exists and the sale forms prefill from it
- [x] Report | Add Expence Report(new options.)

Sale User Type Changes,
- [ ] Commercial Sale | Disable Discount for Sales User — field is not role-gated
- [ ] Customer | Disable Discount for When creating the Customer — not role-gated
- [ ] Report | Sale Report | Disable From and To — always editable

- Dashboard
- [ ] Remove Transaction — the Recent Transactions card is still there
- [x] Add Stock Information, Add List of customers (cylinders, pending amount)
- [x] Add Customer information about pending amount, cylinder
- [x] Sale Trend.
- [ ] Quick Actions(Commercial, Domestic, Reports)
      — has Commercial / Domestic / ARB / Expense / Purchase / Stock; **no
      Reports link**

Owner User Type Changes,
- [ ] Dashboard | Add Stock Card(Today) — no today-scoped stock card
- [ ] Dashboard | Expence, Profit Pie chart — only revenue-by-product is a pie
- [ ] Dashboard | Export Every Card — no export anywhere on the dashboard

Office User Type Changes,
- [x] Dashboard | Remove Reveneu Card, Net Profit
      — both hidden from non-owners; Collections is now scoped to what that
      user collected, so the card they keep shows their own figure
- [x] Dashboard | Remove Reveneu & Profit Card — same as above
- [x] Dashboard | Remove Revenue by Product Card — hidden for non-owners
- [ ] Dashboard | Pie chart Expence, and Sale — not built
- [x] Dashboard | Pie chart Sale by Proeduct. — revenue-by-product pie (owner only)
- [ ] Dashboard | Change Revenue name to Sale — duplicate of the item above

## 03/03/2026

- [x] Filter product query for each pages (Commercial, Domestic, ARB).
- [x] Customer initial balance with new balance mismatching.
      — every customer now gets a `CustomerBalance` row and an `OPENING` ledger
      entry; the cache is asserted equal to `SUM(ledger)` in the tests
- [ ] Customerwise Report.
      — `/customer-txn/[id]` shows one customer's ledger, but there is no report
      under Reports
- [x] Move the pending amount to Top section.
- [x] When updating time, the pending amount and cylinder id wrong.
      — update is void-and-repost; integration tests assert both caches still
      match their ledgers afterwards
- [x] Empty Sale entry.
      — payload schemas require at least one line item
- [x] Add Customer option in both ARB & Domestic Sale.
- [x] Edit option for ARB Sale.
- [ ] Report | Customer Pending Report(Or Customer Outstanding Report Or Customer Dues Report) - To view the closing balace of the customers.
- [x] Dashboard | Add ARB Sales

## Summary

23 done, 12 outstanding. Everything outstanding is a **feature or UI-polish
request** — none of it is refactor debt, and none of it blocks a production
cutover. The clusters worth deciding on:

1. **Dashboard rework** (9 items) — rename Revenue → Sale, drop Recent
   Transactions, add expense/profit pies, per-card export, cash/cheque split,
   and a today-scoped stock card.
2. **Role-based field rules** (2 items) — hide discount from sales users and
   lock the report date range for them.
3. **Two new reports** — customer-wise and customer outstanding/dues.
4. **Product pricing** — drop `Product.salePrice` in favour of the batch price.
