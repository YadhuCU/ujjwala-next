# commercial-sale

**Purpose.** Commercial cylinders, per line RENT or SALE, with custody and — since
2026-08-23 — cylinders **collected on the invoice being written**.

**Files.** `src/module/commercial-sale/*` · UI `src/app/(dashboard)/commercial-sales/`
(incl. `commercial-sale-return-dialog.tsx`) · tests
`commercial-sale.service.integration.test.ts`, `commercial-sale.serializer.test.ts`

**Models.**
- `CommercialSale { …header…, invoiceDate (date), returns[] }`
- `CommercialSaleItem { saleType RENT|SALE, quantity, cylindersDispatched,
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
- An invoice may have **zero items** if it has returns (a collection-only visit;
  appears at ₹0 in reports). Both empty is refused. A product may appear once in
  `returns`.

**Per-line return (correction path).** `PATCH /api/commercial-sales/[id]/return`
(`commercial_sale.update`), `returnCylinders`: RENT lines only, ≤ outstanding,
increments `cylindersReturned`, writes `CYLINDER_RETURN`, godown, custody.

**Update.** Refused if any **per-line** return exists (`assertNoReturnsRecorded`).
Otherwise reverse (ledger + godown via the invoice's own rows, stock, custody of
outstanding rentals, `reverseRecordedReturns` restores collected custody and
deletes the return rows, money) then repost; the holding check for new
collections runs after the reversal. **Known issue #1**: the custody reversal has
no `>= 0` guard.

**Delete.** Refused while any RENT line has cylinders outstanding
(`assertNoOutstandingCylinders`); then the same reversal and a soft delete.

**Form.** Item rows: Stock | Type (RENT default) | Qty | Rate | Total. Section
"Cylinders collected": a row per product the customer holds (from
`getCustomerSummary`), each with "N held"; on edit, products already collected by
this invoice are merged in so they are not wiped. Zero rows are stripped on submit.

**Routes.** `GET/POST /api/commercial-sales`, `GET/PUT/DELETE /api/commercial-sales/[id]`,
`PATCH /api/commercial-sales/[id]/return` — `commercial_sale.read / create / update / delete`.
