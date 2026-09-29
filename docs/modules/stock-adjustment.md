# stock-adjustment

**Purpose.** Correct the godown when the shelf disagrees with the system. Append-only.

**Files.** `src/module/stock-adjustment/*` · UI `src/app/(dashboard)/stock-adjustments/`
(list + create only) · tests `stock-adjustment.service.integration.test.ts`

**Model.** `StockAdjustment { id, productId, filledDelta, emptyDelta, reason
(required), createdById, createdAt }`.

**`writeStockAdjustment(tx, …)`** — **exported** so other modules post adjustments
inside their own transaction (stock does; the test factory `seedGodown` does).
Always writes, together: the `StockAdjustment` row, an `ADJUSTMENT`
`CylinderTransaction`, and the `GodownInventory` delta.

**Rules.** `assertGodownStaysNonNegative` — refuses a delta that would take filled
or empty below 0 (a data-entry error, not a correction). Adjustments are **never**
updated or deleted — post the opposite one.

**Routes.** `GET /api/stock-adjustments`, `GET /api/stock-adjustments/[id]`
(`stock.read`), `POST /api/stock-adjustments` — **`stock.update`**, not
`stock.create`. There is no detail page in the UI though the route exists.
