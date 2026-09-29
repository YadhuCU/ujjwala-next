# vendor

**Purpose.** Who purchases (and so stock batches) come from.

**Files.** `src/module/vendor/*` · UI `src/app/(dashboard)/vendors/` · tests `vendor.service.integration.test.ts`

**Model.** `Vendor { id, name, phone?, address?, gstNumber?, isDeleted }`.
`Purchase.vendorId` and `Stock.vendorId` are `onDelete: Restrict`.

**Rules.**
- Soft delete, refused by `assertVendorHasNoHistory` while any non-deleted
  purchase **or** stock batch references it — retiring it would orphan that
  paperwork in the UI.

**Routes.** `GET/POST /api/vendors`, `GET/PUT/DELETE /api/vendors/[id]` —
`vendor.read / create / update / delete`.

**History.** The "Add Vendor" button was gated on `vendor.update` while the route
needs `vendor.create`; fixed 2026-08-16.
