# customer-txn

**Purpose.** Where a customer stands — balance, cylinders held, full money ledger —
and standalone payments.

**Files.** `src/module/customer-txn/*` · UI `src/app/(dashboard)/customer-txn/[id]/`
(reached from the ledger icon on the customer list) · tests `customer-txn.service.integration.test.ts`

**Service.**
- `getCustomerSummary(customerId)` → `{ pendingAmount, pendingCylinders (only > 0),
  allCylinderLedgers }`. The sale forms use this for the "Pending cylinders"
  banner and the "N held" / "Customer holds N" hints.
- `getCustomerTransactions(customerId, { entryType?, from?, to?, page, limit })`
  — the ledger, newest first. (`from`/`to` are whole India days — `businessDayRange`.)
- `recordPayment` — appends a `PAYMENT` row with **negative** amount
  (`refId = customerId` for a standalone payment) and its `paymentMethod`
  (CASH / CHEQUE), decrements `CustomerBalance`. Until 2026-11-18 the method was
  validated and then dropped, so older standalone payments have none; invoice
  payments (commercial, ARB) carry their sale's `paymentType`, and migration
  `ledger_payment_method` backfilled them where the sale was unambiguous.
  Needs an existing balance row. **Not capped** at what is owed (README #3).
- `reversePayment` — never deletes. `assertPaymentReversible` then an
  `ADJUSTMENT` row of the opposite sign with `voidedEntryId = paymentId`,
  balance incremented back. `voidedEntryId` is `@unique`, so the database
  guarantees a payment is reversed at most once; the guard turns that into a
  clean 409.

**Routes.**
| Route | Permission |
|---|---|
| `GET /api/customer-txn/[id]/balance` | `customer.read` |
| `GET /api/customer-txn/[id]/transactions` | `customer.read` |
| `POST /api/customer-txn/[id]/payments` | `customer.update` |
| `DELETE /api/customer-txn/[id]/payments/[paymentId]` (reverse) | `customer.update` |

Recording and reversing payments ride on `customer.update`, not a permission of
their own.
