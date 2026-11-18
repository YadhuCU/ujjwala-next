-- AlterTable
ALTER TABLE "customer_payment_ledger" ADD COLUMN     "payment_method" "PaymentType";

-- Backfill payments taken on an invoice from that sale's payment type. A
-- ledger row stores only `ref_id`, and domestic, ARB and commercial sales are
-- numbered separately, so a row is filled only when exactly one sale matches
-- its customer, id and paid amount. Standalone payments (ref_type MANUAL) never
-- stored their method, and stay NULL.
WITH candidates AS (
  SELECT l.id AS ledger_id, s.payment_type
  FROM "customer_payment_ledger" l
  JOIN (
    SELECT id, customer_id, paid_amount, payment_type FROM "commercial_sales"
    UNION ALL
    SELECT id, customer_id, paid_amount, payment_type FROM "arb_sales"
    UNION ALL
    SELECT id, customer_id, paid_amount, payment_type FROM "dom_sales"
  ) s ON s.id = l.ref_id
     AND s.customer_id = l.customer_id
     AND s.paid_amount = -l.amount
  WHERE l.entry_type = 'PAYMENT' AND l.ref_type = 'INVOICE'
),
unique_match AS (
  SELECT ledger_id, MIN(payment_type::text) AS payment_type
  FROM candidates
  GROUP BY ledger_id
  HAVING COUNT(*) = 1
)
UPDATE "customer_payment_ledger" l
SET "payment_method" = u.payment_type::"PaymentType"
FROM unique_match u
WHERE l.id = u.ledger_id;
