# dom-sale

**Purpose.** Domestic cylinder sales. Each line is **RENT** (a refill: full out,
the customer's empty back) or **SALE** (sold outright).

**Files.** `src/module/dom-sale/*` · UI `src/app/(dashboard)/dom-sales/` ·
tests `dom-sale.service.integration.test.ts`, `dom-sale.payload.schema.test.ts`

**Models.** `DomSale` (same header shape as ARB). `DomSaleItem { domSaleId,
productId, stockId, quantity, salePrice, netTotal, saleType (CommercialSaleType,
default SALE), cylindersDispatched (default 0), emptiesCollected (default 0) }`.
The enum is shared with commercial; the three columns arrived in migration
`20260930000000_domestic_rent`.

**Custody — full tracking, with one deliberate difference from commercial.**
- **Both RENT and SALE add to what the customer holds** (`cylindersDispatched =
  quantity` on every line). Chosen explicitly by the client: otherwise a customer
  who *bought* a cylinder could never hand its empty back for a refill — the
  system would say they hold none.
- Empties collected (RENT only; the payload refuses them on SALE) come off the
  holding and go into the godown as `CYLINDER_RETURN`.
- **Guard `assertCustomerHoldsEmpties`**: empties must be ones the customer held
  **before** this invoice — this visit's own deliveries cannot cover them. All
  lines of one product are summed.
- Net effect per product = Σ quantity − Σ emptiesCollected, applied by
  `applyDomesticCustody`.
- Opening holdings come from customer onboarding (`customer.md`); without them a
  refill of an existing customer is refused until staff collect fewer empties.

**Ledger rows.** Full cylinders out grouped per (product, kind): `RENT_DELIVERY`
for RENT, `SALE_OUT` for SALE, filled `−q`. Empties per product:
`CYLINDER_RETURN`, empty `+q`. Godown: filled −q, empty +collected.

**Reversal (update / delete).**
- `reverseCylinderTransactions` voids every row the invoice wrote **and** undoes
  each row's own godown movement — filled and empty. (It used to void rows and
  separately restore only `filledQty`, which would have left a refill's empties
  behind.)
- Custody is reversed from what each line **recorded** (`resolveOriginalCustody`),
  not recomputed from quantity. Rows from before domestic custody existed are
  0/0, so reversing an old sale leaves the holding alone. Existing UAT rows (6 at
  migration time) were backfilled SALE / 0 / 0.
- **Guard `assertReversalKeepsCustody`** — refused if it would take the holding
  below zero, i.e. those cylinders came back on a later invoice. Correct that one
  first. (Commercial lacks this guard — README #1.)
- On update, holdings for the new empties are checked **after** the reversal.

**Money.** As ARB. `trNo = DOM-{yyyymmdd}-{00001}` using `businessDayKey` (India date).

**Form (`dom-sale-form.tsx`).** Columns: Stock | Type | Qty | Empties back | Price |
Total. Type defaults to SALE. Choosing RENT sets "Empties back" to the quantity;
typing a quantity on a RENT line re-syncs it (`syncEmpties`); SALE sets 0. Below
the empties input: "Customer holds N" from `getCustomerSummary` (hidden in edit
mode, where the holding already includes this invoice). The selected stock label
reads the live `formField.value` — reading the `useFieldArray` `field` snapshot
blanked it on UAT (`_platform.md`).

**Caveat.** Unlike commercial, domestic does not check `GodownInventory.filledQty`
before selling — only the batch's `Stock.quantity`. If batches and godown ever
drift (manual corrections), a domestic sale could push `filledQty` negative.

**Routes.** `GET/POST /api/dom-sales`, `GET/PUT/DELETE /api/dom-sales/[id]` —
`domestic_sale.read / create / update / delete`.
