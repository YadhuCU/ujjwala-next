# dashboard

**Purpose.** One aggregate screen: godown position first, then sales, money, trend,
alerts.

**Files.** `src/module/dashboard/*` · UI `src/app/(dashboard)/dashboard-client.tsx`
+ `_components/` (`godown-preview`, `quick-actions`, `kpi-cards`, `trend-charts`,
`product-breakdown`, `inventory-txns`, `commercial-alerts`) · tests
`dashboard.service.integration.test.ts`

**Service `getDashboard({ from?, to? }, actor)`.**
- Range via `resolveRange` with `business-day.ts` (default: last 30 business days);
  `todayStart = startOfBusinessDay(now)`; trend buckets keyed by `businessDayKey`.
- Scope `SCOPES.DASHBOARD` applied to sales, expenses and payment-ledger
  collections; **not** to customer count, low stock, custody or balances.
- Returns `scope` and `canSeeFinancials` (`dashboard.financials` or a system
  role) **instead of a role name** — the client used to compare `role !== "OWNER"`.
- `kpis`: totalRevenue, totalProfit (revenue − cost − expenses), totalExpenses,
  totalCollections, totalQtySold, customerCount, todayRevenue, invoice counts.

**Client.** Revenue / Net Profit / Total Expenses cards need `canSeeFinancials`;
Collections always shows. Trend cost/profit series and the product breakdown need
`canSeeFinancials`; low stock and commercial alerts need `scope === "all"`.
Dates are sent with `format(date, "yyyy-MM-dd")`.

**Freshness.** Every mutation refreshes `dashboard` and `godown` (`use-api.ts`
`ALWAYS_INVALIDATE`). Before 2026-09-30 nothing did: a ₹777 sale left the cards at
₹0 until reload. Picked dates were also sent a day early (fixed the same day).

**Open client requests** (`TODO.md`): rename "Revenue" to "Sale" (asked **twice**,
still "Revenue"), cash/cheque split in Collections, expense/profit pies,
per-card export, a today-scoped stock card, drop Recent Transactions.

**Route.** `GET /api/dashboard?from&to` — `dashboard.read`.
