-- Frees the names of customers, products and vendors deleted before a delete
-- started renaming the row (src/lib/soft-delete.ts, retiredName). Names are
-- unique across deleted rows too, so until now a deleted customer could never
-- be registered again under the same name.
--
-- Same rule as retiredName: "<name> (deleted #<id>)", the name trimmed so the
-- whole thing fits the column. Rows already renamed are left alone.

UPDATE "customers"
SET "name" = LEFT("name", 50 - LENGTH(' (deleted #' || "id" || ')')) || ' (deleted #' || "id" || ')'
WHERE "is_deleted" = true
  AND "name" NOT LIKE '% (deleted #' || "id" || ')';

UPDATE "products"
SET "name" = LEFT("name", 50 - LENGTH(' (deleted #' || "id" || ')')) || ' (deleted #' || "id" || ')'
WHERE "is_deleted" = true
  AND "name" NOT LIKE '% (deleted #' || "id" || ')';

UPDATE "vendors"
SET "name" = LEFT("name", 100 - LENGTH(' (deleted #' || "id" || ')')) || ' (deleted #' || "id" || ')'
WHERE "is_deleted" = true
  AND "name" NOT LIKE '% (deleted #' || "id" || ')';
