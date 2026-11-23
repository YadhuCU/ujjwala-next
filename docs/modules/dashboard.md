# dashboard

**Purpose.** One aggregate screen: commercial cylinder position first, then
headline figures, trends, revenue by product, low stock and commercial alerts —
over a period the viewer picks.

**Files.** `src/module/dashboard/*` (`dashboard.period.ts` resolves periods) ·
UI `src/app/(dashboard)/dashboard-client.tsx` + `_components/`
(`period-picker`, `period`, `godown-preview`, `quick-actions`, `kpi-cards`,
`trend-charts`, `product-breakdown`, `low-stock`, `commercial-alerts`) · tests
`dashboard.service.integration.test.ts`, `dashboard.period.test.ts`

**Periods (2026-11-20).** `view = day | month | year`, **month by default**.
`resolvePeriod(view, from?, to?)` turns picked dates into whole buckets, in
India dates: day = any range, one bucket per day (default last 30 days); month =
whole months, one bucket per month (default last 12, ending this month); year =
whole years (default last 5). Too many buckets (400 / 120 / 50) or start after
end is a 400. The response echoes `period { view, from, to, currentLabel }` and
the picker shows that, so a month view always reads as whole months. Every
figure covers the period and every chart has one bar per bucket; the KPI
subtitle calls out the current bucket ("Today" / "This month" / "This year",
`kpis.currentRevenue`). Clicking a bar drills in: a year opens its months, a
month its days (`drillInto`).

**Cards are permissions.** `dashboard.cylinder_position`, `.kpis`,
`.revenue_trend`, `.sales_by_type`, `.product_breakdown` (also needs
`dashboard.financials`), `.low_stock`, `.commercial_alerts`. The service
returns `cards { … }` booleans and skips the queries for cards not held; the
client renders from `cards`. Migration
`20261120090000_refill_card_permissions_money_discount` granted each card to
roles that already saw it (and Cylinder position to every `dashboard.read`
role), audited as `ROLE_UPDATED` by "Migration: dashboard card permissions".

**Service `getDashboard({ view?, from?, to? }, actor)`.**
- Scope `SCOPES.DASHBOARD` applied to sales, expenses and payment-ledger
  collections; **not** to customer count or low stock. Domestic sales scope on
  `fieldStaffId` (whose round), the rest on `createdById`.
- **Collections** = PAYMENT rows on the money ledger **plus** `paidAmount` of
  every domestic sale with no customer — a field staff round is paid in full
  but writes nothing to the ledger.
- Returns `scope` and `canSeeFinancials` **instead of a role name**.
- `kpis`: totalRevenue, totalProfit (revenue − cost − expenses), totalExpenses,
  totalCollections, totalQtySold, customerCount, currentRevenue, invoice counts.
  `trend[]` (bucket `date` key), `productBreakdown[]`, `lowStock[]`.
- Recent Transactions was removed on 2026-11-20 (a client request).

**`getCylinderPosition()`** — `GET /api/dashboard/cylinders`
(`dashboard.read` + `dashboard.cylinder_position`). The godown status filtered
to **COMMERCIAL** products only, with its own totals. Served here so the card
can be granted without `stock.read`; the "Full view" link to `/godown` only
shows to holders of `stock.read`.

**`getCommercialAlerts({ cylinderDays, paymentDays })`** — `GET
/api/dashboard/alerts` (`dashboard.read` + `dashboard.commercial_alerts`).
Both thresholds default to 30, are typed into each card's header, debounced,
and remembered per browser in `localStorage`. High balance accounts has no
threshold (top 5). Pending payments times a balance from the customer's last
payment that still stands (a reversed one does not count); a customer who
has never paid is timed from the first charge that started the debt and comes
back with `neverPaid: true` — never as 0 days, which once hid exactly the
longest debts. Pending empty cylinders works the same way
(`custodyTimelines`): days since the customer's last return — a collection on
any invoice (`CommercialSaleReturn`), a return against one line (that line's
`updatedAt`), or empties on a pre-2026-11-02 domestic sale — and for a customer
who has never returned one, since the opening holding or first rental, with
`neverReturned: true`. It reads the documents, not `CylinderTransaction`,
whose `refId` is shared by every invoice type.

**Client.** Revenue / Net Profit / Total Expenses tiles and the profit/expense
bars need `canSeeFinancials`; Collections always shows. Revenue & profit trend
is a grouped bar chart. The page keeps the previous figures (dimmed) while a
new period loads.

**Freshness.** Every mutation refreshes `dashboard` (all three queries live
under that key) and `godown` (`use-api.ts` `ALWAYS_INVALIDATE`).

**Open client requests** (`TODO.md`): rename "Revenue" to "Sale", cash/cheque
split in Collections, expense/profit pies, per-card export.

**Route.** `GET /api/dashboard?view&from&to` — `dashboard.read`.
