# customer

**Purpose.** Customer master data plus their **opening** position: money owed and
cylinders already held when they were brought onto the system.

**Files.** `src/module/customer/*` · UI `src/app/(dashboard)/customers/` ·
tests `customer.service.integration.test.ts`

**Models.**
- `Customer { id, name, address?, phone?, locationId?, concernedPerson?,
  concernedPersonMobile?, discount? (int %), gstNumber?, initialPendingAmount, isDeleted }`
- `CustomerInitialCylinderBalance { customerId, productId, qty }` — immutable
  record of what they held at onboarding.
- `CustomerCylinderLedger { customerId, productId, pendingCylinder }` — the
  **live** holding (a cache, but written directly by sale services).
- `CustomerBalance { customerId, pendingAmount }` — money cache over
  `CustomerPaymentLedger`.

**Create (`createCustomer`), one transaction.**
1. `assertProductsExist` — every opening-holding product must exist **and be a
   cylinder** (`BadRequestError` otherwise; tightened 2026-09-30).
2. `seedCylinderBalances` — writes `CustomerInitialCylinderBalance` and seeds
   `CustomerCylinderLedger.pendingCylinder` per product.
3. If `initialPendingAmount > 0`, one `OPENING` ledger row.
4. **Always** creates a `CustomerBalance` row (even at 0). Every later write
   increments it rather than creating it — a customer without one breaks
   payments (this was a real bug, fixed with `backfill-customer-balances.ts`).

**Update.** Master fields only. The update payload does **not** carry opening
balances — they are migration data. There is no way to correct a holding later
(README known issue #3).

**Delete.** Soft, refused by `assertCustomerSettled` while
`pendingAmount !== 0` or any `pendingCylinder > 0`.

**Onboarding UI.** `customer-form.tsx` offers **every cylinder product** (domestic
and commercial) for opening holdings — it filters `productsOptions()` with
`isCylinderTypeProduct`. Before 2026-09-30 it offered commercial only, which made
domestic refills impossible for existing customers.

**Routes.** `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/[id]` —
`customer.read / create / update / delete`.
