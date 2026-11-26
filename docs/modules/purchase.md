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
(India date, `businessDayKey`). The same value is written to `PurchaseItem` and `Stock`.

**Update / delete.** Allowed only while **none** of the purchase's batches appear
on any sale line (`assertStockNotInUse`). Void-and-repost: inverted ledger rows
(`reverseCylinderTransactions`), godown reversed, batches soft-deleted with
`batchNo` mangled to `…_VOID_<id>` (frees the unique slot for the repost), items
hard-deleted, then the create path reruns. The FILL guard on update runs **after**
the reversal, so a corrected FILL can use the empties the original consumed.
Header updated in place.

**Correct prices** (`correctPurchasePrices`, `PATCH /api/purchases/[id]/prices`).
Allowed after the batches have been sold from. A unit cost moves no cylinders
and no customer money, so it is changed **in place**: the line's `unitCost` /
`totalCost`, its batch's `Stock.productCost` (matched on `purchaseId` +
`batchNo`) and `Purchase.totalCost` together, plus the invoice number (copied
onto the batches) and notes. Quantity, product, line type, vendor and date are
not in the payload — each moves cylinders or a report period. The profit report
and the dashboard read `productCost`, so profit on what was already sold follows
the corrected cost. Every changed line is logged in the append-only
`PurchasePriceCorrection` (old and new cost, reason, who), denormalised because
a later full edit replaces the `PurchaseItem` rows. A request that changes
nothing is refused.

The detail read (`GET /api/purchases/[id]`) carries `soldFrom` and
`priceCorrections`. The edit page opens the full form when `soldFrom` is false
and `purchase-price-correction.tsx` (prices only, with the correction history)
when it is true.

**Routes.** `GET/POST /api/purchases`, `GET/PUT/DELETE /api/purchases/[id]`,
`PATCH /api/purchases/[id]/prices` —
`purchase.read / create / update / delete`; correcting prices needs
`purchase.update`.

**History.** Export used a non-existent `p.totalAmount` and always summed ₹0;
fixed to `totalCost`. The purchase date picker once stayed open over the Save
button (cosmetic).
