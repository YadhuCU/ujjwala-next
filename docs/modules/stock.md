# stock

**Purpose.** Batches — what a sale actually draws from. Most are created by a
purchase; manual batches exist for opening stock.

**Files.** `src/module/stock/{…,stock.display}.ts` · UI `src/app/(dashboard)/stock/`
· tests `stock.service.integration.test.ts`, `stock.display.test.ts`

**Model.** `Stock { id, batchNo (@unique), productId?, invoiceNo?, quantity,
productCost?, vendorId?, purchaseId?, isDeleted, createdAt }`. Serializer adds
`isManual = purchaseId === null`.

**Rules.**
- A batch from a purchase is **read-only** here (`assertManualBatch`) — editing it
  would desync the purchase, the ledger and the godown. The UI links to the purchase.
- A manual batch's create / update / delete each post a `writeStockAdjustment` for
  the quantity delta (`postManualQuantityDelta`), because nothing else would tell
  the cylinder ledger those cylinders exist. So every manual stock write needs a
  `reason`. Skipped for non-cylinder products.
- Refused once the batch appears on any sale line (`assertBatchNotSold`).
- `GET /api/stock?type=&includeEmpty=` — lists hide drained batches unless
  `includeEmpty=true`. Sale forms want stock on hand; the stock page wants all.
- API list order is **newest first** (the stock page wants that).

**Sale-form presentation — `stock.display.ts`.** `sortStockOldestFirst` (FIFO,
ties → larger quantity first) and `stockOptionLabel` →
`"Domestic 19kg — added 12 Jun 2026 · 49 left"`. The sale forms sort client-side
because the API order suits the stock page. Batch numbers were removed from the
sale dropdowns at the client's request (they meant nothing to staff); they remain
on invoices, the stock page and purchases. Two batches of one product added the
same day differ only by quantity in the label.

**Routes.** `GET/POST /api/stock`, `GET/PUT/DELETE /api/stock/[id]` —
`stock.read / create / update / delete`.
