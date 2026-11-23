# report

**Purpose.** Read-only reports over the same models, with Excel/PDF export.

**Files.** `src/module/report/{report.service,report.payload.schema,report.serializer,report.export,report.lines,report.rollup}.ts`
· UI `src/app/(dashboard)/reports/` (shared `_components/`: filter card, summary
tiles, results table, filter state, `SaleReportView`) · tests
`report.service.integration.test.ts`, `report.export.test.ts`, `report.lines.test.ts`,
`report.rollup.test.ts`

**Reports.** Sale (`DOM` / `ARB` / `COM`), **product wise**, **customer wise**,
expense, purchase. Each has `/export`. (Product wise replaced sale-by-product on
2026-11-18.) They return `{ summary, data, pagination }` — **not** the
`ApiResponse` envelope; the pages consume that shape directly.

**Scope.** `ReportActor = Actor`; `authorFilter(actor, staffId?)` uses
`SCOPES.REPORT`: own-scope → pinned to `createdById = userId` (a `staffId` sent by
hand is ignored); `"none"` throws; all-scope may narrow by `staffId`. Applies to
the sale, expense and purchase reports (purchase had no actor before 2026-08-16
and leaked agency-wide figures). **Product wise and customer wise are not
scoped**: they are agency-wide by nature (stock, customer balances), so each has
a permission of its own — `report.product_wise`, `report.customer_wise` — held by
no starter role. Only the owner sees them until a role is granted one.

**Dates.** `assertAndNormalizeRange` → `startOfBusinessDay(from)` /
`endOfBusinessDay(to)` (India time); `from > to` is refused. Sales are filtered on
`createdAt`, purchases on `purchaseDate`, expenses on `date`.

**Sale reports — one row per item** (since 2026-09-30). `toSaleLines` in
`report.lines.ts` expands invoices to lines; the table **and** the export both use
it, so they match row for row. Columns: Tr No, Date, Customer (domestic: **Field
staff**), Staff (domestic: "Entered by"), Item, Batch,
**Type** (dom and commercial only — ARB has none), **Qty**, With Customer
(commercial only, per line), Discount, Paid, Total. **Money columns only on an
invoice's first line**, so column totals are right. A collection-only commercial
invoice is one row, "Collection only". The results header says "N invoices"
(`countNoun`) since rows now outnumber invoices. Pagination is per invoice.

**Export (`report.export.ts`).** `excel` is CSV Excel opens natively; `pdf` is a
tab-separated text listing (no PDF renderer bundled). `saleExportColumns({ withType,
withCustody, withFieldStaff })`: dom `{ withType, withFieldStaff }`, commercial
`{ withType, withCustody }`, ARB `{}`.

**Domestic scopes on the field staff.** `ownerColumn("DOM") = "fieldStaffId"`:
own scope and the staff filter key on whose round it was rather than who
entered it. The customer filter does not apply to domestic (the UI hides it).

**Product wise** (`getProductWiseReport`). Per product: Opening Stock, Purchase
Qty, Sales Qty, Adjustments, Closing Stock, Total Amount — and **Opening +
Purchase − Sales + Adjustments = Closing** on every row (asserted in tests).
- Cylinders read the cylinder ledger: opening = Σ `filledDelta` before the
  range; purchase = `PURCHASE_FULL/FILL`, sales = −(`SALE_OUT` + `RENT_DELIVERY` + `REFILL`),
  adjustments = `ADJUSTMENT`, all inside it. Reversal rows keep their type with
  the sign flipped, so a sale voided in the range nets out. Closing is what the
  godown held — equal to `GodownInventory.filledQty` when the range ends today.
- ARB / other have no ledger: closing is today's `Stock.quantity` walked back
  through purchases (dated by `Purchase.createdAt`), sale lines and manual
  batches recorded after the range; opening then walks back through the range.
  A manual batch (`purchaseId` null) counts as an adjustment at the quantity it
  started with (left + sold from it). Edits to a manual batch's quantity have no
  dated record, so they land in its creation.
- Sales Qty for cylinders is ledger-net; Total Amount is the current sale lines
  of undeleted sales. They agree unless a sale is edited or deleted *after* the
  range it was made in.

**Customer wise** (`getCustomerWiseReport`, pure fold in `report.rollup.ts`).
One row per customer, with a **sub row per cylinder size** when there is more
than one (`ReportResults` `subRows`; the export writes the same lines, money on
the customer line only).
- Money from the ledger: opening = everything before the range plus `OPENING`
  rows whenever dated; sales = `SALE_CHARGE` + invoice `ADJUSTMENT`s; receipts =
  `PAYMENT` − payment reversals (`voidedEntryId`). Opening + Sales − Receipts =
  Outstanding = `CustomerBalance` when the range ends today.
- Receipt type from `CustomerPaymentLedger.paymentMethod`; "Not recorded" for
  standalone payments made before 2026-11-18 (the method was validated and
  dropped — see customer-txn).
- Cylinders have no ledger of their own, so `customerCylinderEvents` rebuilds
  them from dated records: onboarding balance (opening), commercial RENT lines
  (rented), SALE lines (sold outright — counted, never held),
  `CommercialSaleReturn` (taken back), per-line `PATCH …/return` returns (dated
  by their `Cylinder return — COM #<sale> item #<line>` ledger rows, remainder by
  the line's `updatedAt`), and customer-linked domestic sales from before
  2026-11-02. Opening + Rented − Taken back = Balance =
  `CustomerCylinderLedger.pendingCylinder` when the range ends today (tested).
- Customers registered after the range, or with nothing to show, are left out.

**Routes.** `GET /api/reports/{dom-sale,arb-sale,commercial-sale,expense,purchase}`
(`report.read`), `/product-wise` (`report.read` + `report.product_wise`),
`/customer-wise` (`report.read` + `report.customer_wise`); each `…/export` adds
`report.export`.

**Open client requests** (`TODO.md`): lock the date range for sales users; hide
discount from sales users.
