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
  `assertNoStockOnHand` (a batch with quantity > 0).
- `salePrice` is only used to pre-fill the sale forms. **No UAT product has one.**

**Routes.** `GET/POST /api/products` (`?type=` filter), `GET/PUT/DELETE /api/products/[id]`
— `product.read / create / update / delete`.

**Known issue.** `updateProduct` changes `type` with no guard — see README #7.
