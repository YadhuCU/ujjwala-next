-- AlterTable
ALTER TABLE "collections" ADD COLUMN     "created_by_id" INTEGER;

-- AlterTable
ALTER TABLE "dom_sales" ADD COLUMN     "created_by_id" INTEGER;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "created_by_id" INTEGER;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "created_by_id" INTEGER;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
