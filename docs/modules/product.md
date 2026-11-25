# product

**Purpose.** What the agency sells. `type` decides how every other module treats it.

**Files.** `src/module/product/{…,product.rules}.ts` · UI `src/app/(dashboard)/products/`

**Model.** `Product { id, name, type: ProductType, weight?, salePrice?, isDeleted }`
with a 1:1 `GodownInventory`. `ProductType = ARB | DOMESTIC | COMMERCIAL | OTHER`.

**The cylinder rule.** `isCylinderTypeProduct(type)` in `product.rules.ts` — true
for DOMESTIC and COMMERCIAL only. Imports `ProductType` from `@/generated/enums`
so client components can use it (the purchase form and customer form do).

**Rules.**
- `createProduct` also creates the `GodownInventory` row (0/0) so the ledger
  always has somewhere to post — for every type, though non-cylinders never use it.
- Soft delete, refused by `assertGodownEmpty` (filled or empty > 0) and
  `assertNoStockOnHand` (a batch with quantity > 0). The row is renamed
  `<name> (deleted #<id>)` so the name can be used again — see
  `src/lib/soft-delete.ts`.
- `salePrice` is only used to pre-fill the sale forms. **No UAT product has one.**
- `assertTypeChangeAllowed`: moving a product across the cylinder line
  (DOMESTIC/COMMERCIAL ↔ ARB/OTHER) is refused once it has any stock batch,
  cylinder movement, customer holding or opening holding — it would strand
  what it already posted, or give existing batches no ledger rows. A change
  within one side, or before any history, is allowed.

**Routes.** `GET/POST /api/products` (`?type=` filter), `GET/PUT/DELETE /api/products/[id]`
— `product.read / create / update / delete`.

