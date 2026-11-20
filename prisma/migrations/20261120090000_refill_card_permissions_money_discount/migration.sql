-- REFILL: a sale line that swaps a filled cylinder for the customer's empty.
-- No custody is tracked; one cylinder row carries both halves of the swap.
ALTER TYPE "CommercialSaleType" ADD VALUE IF NOT EXISTS 'REFILL';
ALTER TYPE "txn_type" ADD VALUE IF NOT EXISTS 'REFILL';

-- Customer discount becomes a flat rupee amount per invoice. The old values
-- were percentages; carried across as rupees they would silently bill the
-- wrong amount, so they are cleared and re-entered as money.
UPDATE "customers" SET "discount" = NULL WHERE "discount" IS NOT NULL;
ALTER TABLE "customers" ALTER COLUMN "discount" SET DATA TYPE DECIMAL(10,2);

-- One permission per dashboard card. `prisma db seed` keeps labels and order
-- in step with PERMISSION_REGISTRY afterwards; inserting them here means a
-- database that is only ever migrated gets them too.
INSERT INTO "permissions" ("code", "module", "label", "description", "sort_order") VALUES
  ('dashboard.cylinder_position', 'Dashboard', 'Card: Cylinder position', 'Commercial cylinders filled and empty in the godown, and with customers. Agency-wide.', 62),
  ('dashboard.kpis', 'Dashboard', 'Card: Headline figures', 'Collections; revenue, profit and expenses also need the totals permission above.', 63),
  ('dashboard.revenue_trend', 'Dashboard', 'Card: Revenue & profit trend', 'Profit and expense bars also need the totals permission above.', 64),
  ('dashboard.sales_by_type', 'Dashboard', 'Card: Sales by type', 'Number of commercial, domestic and ARB invoices per period.', 65),
  ('dashboard.product_breakdown', 'Dashboard', 'Card: Revenue by product', 'Also needs the totals permission above.', 66),
  ('dashboard.low_stock', 'Dashboard', 'Card: Low stock alert', 'Batches running low. Agency-wide.', 67),
  ('dashboard.commercial_alerts', 'Dashboard', 'Card: Commercial sale alerts', 'Customers long overdue with cylinders or payments, and the highest balances. Agency-wide.', 68)
ON CONFLICT ("code") DO NOTHING;

-- Grant each card to the roles that could already see it, so nobody loses a
-- card on upgrade. Cylinder position goes to every dashboard role: field staff
-- are meant to see it, which before needed the godown permission.
CREATE TEMP TABLE "_card_grants" AS
SELECT r."id" AS role_id, p."id" AS permission_id, p."code"
FROM "roles" r
JOIN "permissions" p ON p."code" IN (
  'dashboard.cylinder_position', 'dashboard.kpis', 'dashboard.revenue_trend',
  'dashboard.sales_by_type', 'dashboard.product_breakdown',
  'dashboard.low_stock', 'dashboard.commercial_alerts'
)
WHERE EXISTS (
    SELECT 1 FROM "role_permissions" rp JOIN "permissions" g ON g."id" = rp."permission_id"
    WHERE rp."role_id" = r."id" AND g."code" = 'dashboard.read'
  )
  AND (
    p."code" IN ('dashboard.cylinder_position', 'dashboard.kpis', 'dashboard.revenue_trend')
    OR (p."code" IN ('dashboard.sales_by_type', 'dashboard.product_breakdown') AND EXISTS (
      SELECT 1 FROM "role_permissions" rp JOIN "permissions" g ON g."id" = rp."permission_id"
      WHERE rp."role_id" = r."id" AND g."code" = 'dashboard.financials'))
    OR (p."code" IN ('dashboard.low_stock', 'dashboard.commercial_alerts') AND EXISTS (
      SELECT 1 FROM "role_permissions" rp JOIN "permissions" g ON g."id" = rp."permission_id"
      WHERE rp."role_id" = r."id" AND g."code" = 'dashboard.read.all'))
  )
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" rp
    WHERE rp."role_id" = r."id" AND rp."permission_id" = p."id"
  );

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role_id, permission_id FROM "_card_grants";

-- Every RBAC change is audited, this one included.
INSERT INTO "rbac_audit_logs" ("action", "actor_name", "role_id", "role_name", "added", "removed")
SELECT 'ROLE_UPDATED', 'Migration: dashboard card permissions', r."id", r."name",
       array_agg(g."code" ORDER BY g."code"), ARRAY[]::TEXT[]
FROM "_card_grants" g JOIN "roles" r ON r."id" = g.role_id
GROUP BY r."id", r."name";
DROP TABLE "_card_grants";
