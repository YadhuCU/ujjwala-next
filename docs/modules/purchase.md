# purchase

**Purpose.** Stock in from a vendor. Every line becomes a `Stock` batch; cylinder
lines also move the godown.

**Files.** `src/module/purchase/*` · UI `src/app/(dashboard)/purchases/` ·
tests `purchase.service.integration.test.ts`. The reference module for a
purchase-shaped flow.

**Models.** `Purchase { id, invoiceNo?, vendorId, totalCost, purchaseDate, notes?,
isDeleted, createdById, updatedById }`, `PurchaseItem { purchaseId, productId,
batchNo, quantity, unitCost?, totalCost?, purchaseType: FILL | FULL }`.

**FILL vs FULL.**
- `FULL` — new full cylinders: `PURCHASE_FULL`, filled `+q`.
- `FILL` — the vendor refilled **our** empties: `PURCHASE_FILL`, filled `+q`,
  empty `−q`. Guard `assertEmptyStockAvailable`: `GodownInventory.emptyQty >=`
  the **summed** FILL quantity per product (a product can appear on several lines).
- Non-cylinder products (ARB, OTHER) write **no** ledger rows and skip the godown;
  `writePurchaseItems` and `applyGodownDelta` filter on `isCylinderTypeProduct`.
  The form **hides** the FILL/FULL select for them and records `FULL` (the column
  is required). An inverted version of that filter was the original bug in this
  module.

**Create.** `assertAndAttachProductTypes` (type read from `Product`, never the
client) → `assertEmptyStockAvailable` → header → items + batches + ledger rows →
godown cache. `batchNo` is the vendor's, or `BATCH-{yyyymmdd}-P{purchaseId}-PR{productId}-{n}`
(UTC date — README #2). The same value is written to `PurchaseItem` and `Stock`.

**Update / delete.** Allowed only while **none** of the purchase's batches appear
on any sale line (`assertStockNotInUse`). Void-and-repost: inverted ledger rows
(`reverseCylinderTransactions`), godown reversed, batches soft-deleted with
`batchNo` mangled to `…_VOID_<id>` (frees the unique slot for the repost), items
hard-deleted, then the create path reruns. The FILL guard on update runs **after**
the reversal, so a corrected FILL can use the empties the original consumed.
Header updated in place.

**Routes.** `GET/POST /api/purchases`, `GET/PUT/DELETE /api/purchases/[id]` —
`purchase.read / create / update / delete`.

**History.** Export used a non-existent `p.totalAmount` and always summed ₹0;
fixed to `totalCost`. The purchase date picker once stayed open over the Save
button (cosmetic).
