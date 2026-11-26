-- Moves the cylinder ledger's sale rows off the shared "INVOICE" ref type and
-- repairs what the collision broke. See 20261126090000_sale_ref_types.
--
-- 1. Relabel. Every sale row's note names its module — the services write
--    "DomSale #n" / "Empties collected — DomSale #n" for domestic and
--    "CommercialSale #n" / "Cylinders collected — COM #n" /
--    "Cylinder return — COM #n item #m" for commercial. A reversal belongs to
--    the document whose row it voids, so it takes its original's label — even
--    when the other module wrote it, which is exactly the damage below.
--
-- 2. Repair. A cross-void is a reversal written by one module that voided the
--    other module's row. Its document lost that movement without being edited
--    or deleted. Re-post the movement under its own document when:
--      - the document is still live, and
--      - the document's own module has not reversed it since (an edit after
--        the cross-void re-posted the document's lines itself, so the lost
--        row was superseded anyway).
--    The re-posted row is an ordinary original row of that document, so a
--    later edit or delete of it unwinds it like any other. Idempotent: a row
--    is restored once, recognised by its note.
--
-- The money ledger is untouched: its sale reversals post the invoice's own
-- totals and never look rows up by reference.

-- ─── 1. Relabel ─────────────────────────────────────────────────────────────

UPDATE "cylinder_transactions"
SET "ref_type" = 'DOMESTIC_SALE'
WHERE "ref_type" = 'INVOICE'
  AND "voided_txn_id" IS NULL
  AND "notes" LIKE '%DomSale #%';

UPDATE "cylinder_transactions"
SET "ref_type" = 'COMMERCIAL_SALE'
WHERE "ref_type" = 'INVOICE'
  AND "voided_txn_id" IS NULL
  AND ("notes" LIKE '%CommercialSale #%' OR "notes" LIKE '%COM #%');

UPDATE "cylinder_transactions" AS r
SET "ref_type" = o."ref_type"
FROM "cylinder_transactions" AS o
WHERE r."voided_txn_id" = o."id"
  AND r."ref_type" = 'INVOICE'
  AND o."ref_type" IN ('DOMESTIC_SALE', 'COMMERCIAL_SALE');

-- ─── 2. Repair ──────────────────────────────────────────────────────────────

-- One statement, so the re-posted rows and the godown cache commit together.
WITH "lost" AS (
  SELECT o."id" AS original_id, o."product_id", o."txn_type", o."filled_delta",
         o."empty_delta", o."ref_type", o."ref_id",
         r."id" AS reversal_id, r."notes" AS reversal_notes
  FROM "cylinder_transactions" AS r
  JOIN "cylinder_transactions" AS o ON o."id" = r."voided_txn_id"
  WHERE
    -- written by the other module
    (   (o."ref_type" = 'COMMERCIAL_SALE' AND r."notes" LIKE 'Reversal — DomSale #%')
     OR (o."ref_type" = 'DOMESTIC_SALE'   AND r."notes" LIKE 'Reversal — COM #%'))
    -- the document is still live
    AND (   (o."ref_type" = 'COMMERCIAL_SALE' AND EXISTS (
               SELECT 1 FROM "commercial_sales" s WHERE s."id" = o."ref_id" AND s."is_deleted" = false))
         OR (o."ref_type" = 'DOMESTIC_SALE' AND EXISTS (
               SELECT 1 FROM "dom_sales" s WHERE s."id" = o."ref_id" AND s."is_deleted" = false)))
    -- and its own module has not reversed it since
    AND NOT EXISTS (
      SELECT 1 FROM "cylinder_transactions" AS own
      WHERE own."voided_txn_id" IS NOT NULL
        AND own."created_at" > r."created_at"
        AND own."notes" LIKE CASE o."ref_type"
              WHEN 'COMMERCIAL_SALE' THEN 'Reversal — COM #' || o."ref_id" || ' %'
              ELSE 'Reversal — DomSale #' || o."ref_id" || ' %'
            END)
    -- not already restored
    AND NOT EXISTS (
      SELECT 1 FROM "cylinder_transactions" AS done
      WHERE done."notes" LIKE 'Restored — txn #' || o."id" || ' %')
),
"restored" AS (
  INSERT INTO "cylinder_transactions"
    ("product_id", "txn_type", "filled_delta", "empty_delta", "ref_type", "ref_id", "notes")
  SELECT "product_id", "txn_type", "filled_delta", "empty_delta", "ref_type", "ref_id",
         'Restored — txn #' || original_id || ' was wrongly voided by txn #' || reversal_id
           || ' (' || reversal_notes || ')'
  FROM "lost"
  RETURNING "product_id", "filled_delta", "empty_delta"
)
-- The godown cache follows its ledger
UPDATE "godown_inventory" AS g
SET "filled_qty" = g."filled_qty" + d.filled,
    "empty_qty"  = g."empty_qty"  + d.empty,
    "updated_at" = now()
FROM (
  SELECT "product_id", SUM("filled_delta") AS filled, SUM("empty_delta") AS empty
  FROM "restored" GROUP BY "product_id"
) AS d
WHERE g."product_id" = d."product_id";
