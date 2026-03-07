-- Remove collection_amount field from dom_sales table
ALTER TABLE "dom_sales" DROP COLUMN IF EXISTS "collection_amount";
