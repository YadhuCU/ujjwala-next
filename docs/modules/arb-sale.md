# arb-sale

**Purpose.** Sales of bulk gas and accessories (stoves, hoses, gas books). **The
reference module** for the sale shape — read this one first when building a sale
flow.

**Files.** `src/module/arb-sale/*` · UI `src/app/(dashboard)/arb-sales/` ·
tests `arb-sale.service.integration.test.ts`

**Models.** `ArbSale { id, trNo, customerId, totalAmount, paidAmount, discount?,
paymentType, notes?, isDeleted, createdById, updatedById }`,
`ArbSaleItem { arbSaleId, productId, stockId, quantity, salePrice, netTotal }`.
No sale type — an ARB line is neither rented nor sold outright in the cylinder sense.

**Rules.**
- **No cylinder code at all**: no `CylinderTransaction`, no `GodownInventory`, no
  custody. Only `Stock.quantity` and money move. (The godown step is left as a
  commented-out line in update, on purpose.)
- `assertAndFetchStocks` groups lines by `stockId` so two lines on one batch are
  checked against its quantity together; `productId` comes from the stock row.
- `paidAmount <= totalAmount` (`BadRequestError`).
- `trNo = ARB-{yyyymmdd}-{00001}`, assigned after the header insert (UTC date —
  README #2).
- Ledger (shared with dom): `SALE_CHARGE +total`, `PAYMENT −paid` if paid > 0,
  `CustomerBalance += total − paid`. Reversal: one `ADJUSTMENT −(total − paid)`.
- Customer is required by the payload; the service's "walk-in" branches are dead.

**Update / delete.** Void-and-repost: restore `Stock.quantity`, reverse the money
ledger, delete items, repost; header updated in place / soft-deleted.

**UI.** Stock dropdown: oldest first, label from `stockOptionLabel` (see
`stock.md`). The selected-value label reads the live `formField.value` and falls
back with `undefined` — see the form note in `_platform.md`.

**Routes.** `GET/POST /api/arb-sales`, `GET/PUT/DELETE /api/arb-sales/[id]` —
`arb_sale.read / create / update / delete`. Reports: `report.md`.
