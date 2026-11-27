# commercial-sale

**Purpose.** Commercial cylinders, per line RENT, SALE or REFILL, with custody
for RENT and — since
2026-08-23 — cylinders **collected on the invoice being written**.

**Files.** `src/module/commercial-sale/*` · UI `src/app/(dashboard)/commercial-sales/`
(incl. `commercial-sale-return-dialog.tsx`) · tests
`commercial-sale.service.integration.test.ts`, `commercial-sale.serializer.test.ts`

**Models.**
- `CommercialSale { …header…, invoiceDate (date), returns[] }`
- `CommercialSaleItem { saleType RENT|SALE|REFILL, quantity, cylindersDispatched,
  cylindersReturned, … }` — `cylindersOutstanding` = dispatched − returned in the
  serializer.
- `CommercialSaleReturn { commercialSaleId, productId, quantity }` — collections
  recorded on the invoice, keyed on **product, not line**.

**Why collections are per product.** Custody can come from an opening balance with
no invoice behind it, so a collection cannot always be attributed to a line that
once dispatched it. It reduces the customer's holding and nothing more.

**Create.** `assertCustomerHoldsCylinders` (collections vs the holding **before**
this invoice) → stocks → `assertGodownHasFilled` (the only sale module that also
checks the godown) → header → `trNo` → items + ledger (`RENT_DELIVERY` / `SALE_OUT`)
→ godown → custody for RENT lines → `writeRecordedReturns` (return row +
`CYLINDER_RETURN` + godown empties via upsert + custody down) → money.
- Unlike domestic, **SALE lines do not add to custody** — outright, nothing expected back.
- **REFILL** (2026-11-20): the customer's empty is swapped for a filled one on
  the spot. One `REFILL` ledger row per product (filled `−q`, empty `+q`), the
  godown moves both ways (`applyGodownRefillEmpties`), no custody,
  `cylindersDispatched = 0`. The reversal unwinds it from the row like any other.
- **Unit discount** (2026-11-27): picking a customer pre-fills the invoice's
  `unitDiscount` with `Customer.discount` — ₹ off **each cylinder**, across
  every line (RENT, SALE, REFILL); it stays editable. The payload carries the
  rate only; `computeTotals` works out `discount = unitDiscount × cylinders`
  and both are stored. `assertUnitDiscountFits` refuses a rate above the
  cheapest line's price. A collection-only invoice has no discount. The form
  shows "₹20 × 12 cylinders = ₹240 off this invoice" and the detail view
  "₹240 (₹20 × 12)". Invoices from before have `unitDiscount = null` and a
  flat `discount`, kept as saved; the edit form spreads that flat amount over
  their cylinders (to the paisa), so saving one keeps its total.
- **Paid amount is uncapped** (2026-11-27): part payment, or more than the
  invoice — the excess settles the customer's earlier due, or stays as an
  advance. The form shows due before / this invoice / paid now / balance
  after (on edit, "due before" takes this invoice's own `total − paid` back
  out). Per-invoice balance displays go through `invoiceBalance` (never
  negative, plus "paid toward earlier due").
- An invoice may have **zero items** if it has returns (a collection-only visit;
  appears at ₹0 in reports). Both empty is refused. A product may appear once in
  `returns`.

**Per-line return (correction path).** `PATCH /api/commercial-sales/[id]/return`
(`commercial_sale.update`), `returnCylinders`: RENT lines only, ≤ outstanding,
increments `cylindersReturned`, writes `CYLINDER_RETURN`, godown, custody.

**Update.** Refused if any **per-line** return exists (`assertNoReturnsRecorded`).
Otherwise reverse (ledger + godown via the invoice's own rows — keyed on
`RefType.COMMERCIAL_SALE`, since a domestic sale can carry the same number — stock, custody of
outstanding rentals, `reverseRecordedReturns` restores collected custody and
deletes the return rows, money) then repost; the holding check for new
collections runs after the reversal. `assertCustodyNotNegative` then checks the
final position: if this invoice's rentals were since collected on a later
invoice and the edit rents out fewer (or moves them to another customer), it is
refused rather than leaving a negative holding; an edit that keeps the rentals
as they were still goes through.

**Delete.** Refused while any RENT line has cylinders outstanding
(`assertNoOutstandingCylinders`); then the same reversal and a soft delete.

**Form.** Item rows: Stock | Type (RENT default; RENT / SALE / REFILL) | Qty | Rate | Total. Section
"Cylinders collected": a row per product the customer holds (from
`getCustomerSummary`), each with "N held"; on edit, products already collected by
this invoice are merged in so they are not wiped. Zero rows are stripped on submit.

**Routes.** `GET/POST /api/commercial-sales`, `GET/PUT/DELETE /api/commercial-sales/[id]`,
`PATCH /api/commercial-sales/[id]/return` — `commercial_sale.read / create / update / delete`.
