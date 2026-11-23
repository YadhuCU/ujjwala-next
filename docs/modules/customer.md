# customer

**Purpose.** Customer master data plus their **opening** position: money owed and
cylinders already held when they were brought onto the system.

**Files.** `src/module/customer/*` · UI `src/app/(dashboard)/customers/` ·
tests `customer.service.integration.test.ts`

**Models.**
- `Customer { id, name, address?, phone?, locationId?, concernedPerson?,
  concernedPersonMobile?, discount? (Decimal ₹, flat per commercial invoice — was an int % until 2026-11-20; the migration cleared the old percentages), gstNumber?, initialPendingAmount, isDeleted }`
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

**Onboarding UI.** `customer-form.tsx` offers **commercial products only** for
opening holdings, and `assertProductsExist` refuses anything else. From
2026-09-30 to 2026-11-02 domestic was offered too, for customer-linked domestic
refills; a domestic sale is now a field staff member's round with no customer
(`dom-sale.md`), so nothing would ever collect a domestic holding back. Holdings
entered in that window stay in the data, read by nothing new.

**List.** `getCustomers` includes each customer's `CustomerBalance.pendingAmount`
and their `CustomerCylinderLedger` rows with cylinders out (> 0, with product
name); the serializer flattens them to `pendingAmount` and `pendingCylinders`,
shown as columns so staff need not open every ledger. A negative balance reads
as "credit". The ledger link sits with edit and delete in the Actions column.

**Routes.** `GET/POST /api/customers`, `GET/PUT/DELETE /api/customers/[id]` —
`customer.read / create / update / delete`.
