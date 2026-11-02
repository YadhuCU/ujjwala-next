# dom-sale

**Purpose.** A field staff member's round. They go door to door: each line is
**RENT** (a refill: a full cylinder out, the house's empty back) or **SALE** (a
cylinder sold outright, nothing back), paid in full at each door. **There is no
customer.** Changed 2026-11-02; before that a domestic sale was charged to a
customer and moved their cylinder holding (see "Sales from before" below).

**Files.** `src/module/dom-sale/*` · UI `src/app/(dashboard)/dom-sales/` · tests
`dom-sale.service.integration.test.ts`, `dom-sale.payload.schema.test.ts`

**Models.** `DomSale { …, customerId Int? (old sales only), fieldStaffId Int?
→ User ("DomSalesFieldStaff"), createdById, … }`. `DomSaleItem { domSaleId,
productId, stockId, quantity, salePrice, netTotal, saleType (CommercialSaleType,
default SALE), cylindersDispatched, emptiesCollected }`. Migration
`20261102165209_dom_sale_field_staff` made `customer_id` nullable, added
`field_staff_id` and backfilled it from `created_by_id`.

**Field staff — who the sale belongs to.** `fieldStaffId` is whose round it
was; `createdById` is who typed it in (often the office). Decided by the scope
pair `SCOPES.DOMESTIC_SALE` (`domestic_sale.read.all` / `.read.own`):
- **all** (the office, the owner): the form shows a Field staff dropdown and the
  payload must carry `fieldStaffId`; `assertIsFieldStaff` requires an active,
  undeleted user holding `domestic_sale.create` through a role (a system role
  counts). Same `fieldStaffWhere` feeds `GET /api/dom-sales/field-staff`, so the
  dropdown never offers someone the server would refuse.
- **own** (field staff): no dropdown; `resolveFieldStaff` records the actor.
  Naming anyone else is a `ForbiddenError`, not silently overridden.
- Lists, single reads, updates and deletes scope on **`fieldStaffId`**
  (`scopeFilter(actor, scope, "fieldStaffId")`), so a field staff member sees
  rounds the office entered for them. An own-scope `fieldStaffId` filter is
  ignored.

**Money.** `paidAmount = totalAmount`, always — the payload has no paid amount
and no customer (zod strips both if a stale client sends them). Nothing is
written to `CustomerPaymentLedger` / `CustomerBalance`. A discount above the
subtotal is refused. `trNo = DOM-{yyyymmdd}-{00001}`, India date. The dashboard
counts a customer-less domestic sale's `paidAmount` as collections, because that
cash never reaches the money ledger the collections figure reads.

**Cylinders.** Fulls out grouped per (product, kind): `RENT_DELIVERY` for RENT,
`SALE_OUT` for SALE, filled `−q`. Empties per product: `CYLINDER_RETURN`, empty
`+q`. Godown: filled −q, empty +collected. Empties are RENT-only and at most
the line's quantity (payload refine). **No custody** — nothing is written to
`CustomerCylinderLedger`.

**Reversal (update / delete).** `reverseCylinderTransactions` voids every row
the invoice wrote and undoes each row's own godown movement, filled and empty;
then `Stock.quantity` is restored. Update reposts with the new lines and keeps
the field staff unless the office names another.

**Sales from before (customer-linked).** Rows with a `customerId`:
- **Cannot be edited** (`assertNotCustomerSale`) — reposting in the new shape
  would drop the customer charge and wipe what they owe. The edit page says so
  and disables Save. Delete, then re-enter.
- **Delete** reverses them fully: `reverseCustomerLedger` (one `ADJUSTMENT` for
  total − paid) and the customer's holding from what each line recorded
  (`resolveOriginalCustody`, `cylindersDispatched − emptiesCollected`).
  `assertReversalKeepsCustody` refuses if those cylinders have since come back.

**Form (`dom-sale-form.tsx`).** Field staff (dropdown or the user's own name) ·
Discount · Notes · Payment type; lines Stock | Type | Qty | Empties back | Price |
Total. RENT sets "Empties back" to the quantity and re-syncs on quantity change;
SALE sets 0. Grand total is subtotal − discount, "Collected in full". The
selected stock label reads the live `formField.value` (`_platform.md`).

**Caveat.** Domestic does not check `GodownInventory.filledQty` before selling —
only the batch's `Stock.quantity`. If batches and godown drift (manual
corrections), a sale could push `filledQty` negative.

**Routes.** `GET/POST /api/dom-sales`, `GET/PUT/DELETE /api/dom-sales/[id]` —
`domestic_sale.read / create / update / delete`, scoped as above.
`GET /api/dom-sales/field-staff` — `domestic_sale.create` + `.read.all`.
