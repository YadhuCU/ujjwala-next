-- Profit report: its own permission, like product wise and customer wise —
-- the report is agency-wide and shows what stock cost. `prisma db seed` keeps
-- labels and order in step with PERMISSION_REGISTRY afterwards; inserting it
-- here means a database that is only ever migrated can grant it too.
-- Granted to no role: the owner sees it (system role) until someone grants it.
INSERT INTO "permissions" ("code", "module", "label", "description", "sort_order") VALUES
  ('report.profit', 'Reports', 'Profit report', 'Sales, cost and gross profit by category and by item, agency-wide. Shows what stock cost.', 14)
ON CONFLICT ("code") DO NOTHING;
