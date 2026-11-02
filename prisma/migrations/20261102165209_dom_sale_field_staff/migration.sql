-- AlterTable
ALTER TABLE "dom_sales" ADD COLUMN     "field_staff_id" INTEGER,
ALTER COLUMN "customer_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "dom_sales_field_staff_id_idx" ON "dom_sales"("field_staff_id");

-- AddForeignKey
ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_field_staff_id_fkey" FOREIGN KEY ("field_staff_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every domestic sale so far was made by whoever entered it, so its
-- author is its field staff. That keeps a field staff member's own-scope view of
-- their history intact.
UPDATE "dom_sales" SET "field_staff_id" = "created_by_id" WHERE "field_staff_id" IS NULL;
