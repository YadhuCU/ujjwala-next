# report

**Purpose.** Read-only reports over the same models, with Excel/PDF export.

**Files.** `src/module/report/{report.service,report.payload.schema,report.serializer,report.export,report.lines}.ts`
· UI `src/app/(dashboard)/reports/` (shared `_components/`: filter card, summary
tiles, results table, filter state, `SaleReportView`) · tests
`report.service.integration.test.ts`, `report.export.test.ts`, `report.lines.test.ts`

**Reports.** Sale (`DOM` / `ARB` / `COM`), sale-by-product, expense, purchase. Each
has `/export`. They return `{ summary, data, pagination }` — **not** the
`ApiResponse` envelope; the pages consume that shape directly.

**Scope.** `ReportActor = Actor`; `authorFilter(actor, staffId?)` uses
`SCOPES.REPORT`: own-scope → pinned to `createdById = userId` (a `staffId` sent by
hand is ignored); `"none"` throws; all-scope may narrow by `staffId`. Applies to
**all** reports, purchase and sale-by-product included (those two had no actor
before 2026-08-16 and leaked agency-wide figures).

**Dates.** `assertAndNormalizeRange` → `startOfBusinessDay(from)` /
`endOfBusinessDay(to)` (India time); `from > to` is refused. Sales are filtered on
`createdAt`, purchases on `purchaseDate`, expenses on `date`.

**Sale reports — one row per item** (since 2026-09-30). `toSaleLines` in
`report.lines.ts` expands invoices to lines; the table **and** the export both use
it, so they match row for row. Columns: Tr No, Date, Customer, Staff, Item, Batch,
**Type** (dom and commercial only — ARB has none), **Qty**, With Customer
(commercial only, per line), Discount, Paid, Total. **Money columns only on an
invoice's first line**, so column totals are right. A collection-only commercial
invoice is one row, "Collection only". The results header says "N invoices"
(`countNoun`) since rows now outnumber invoices. Pagination is per invoice.

**Export (`report.export.ts`).** `excel` is CSV Excel opens natively; `pdf` is a
tab-separated text listing (no PDF renderer bundled). `saleExportColumns({ withType,
withCustody })`: dom `{ withType }`, commercial `{ withType, withCustody }`, ARB `{}`.
Sale-by-product rolls up the three `*SaleItem` tables (lines carry the product).

**Routes.** `GET /api/reports/{dom-sale,arb-sale,commercial-sale,sale-by-product,expense,purchase}`
(`report.read`) and `…/export` (`report.export`).

**Open client requests** (`TODO.md`): customer-wise and customer outstanding/dues
reports; lock the date range for sales users; hide discount from sales users.
