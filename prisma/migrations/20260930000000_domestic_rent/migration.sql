-- AlterTable
ALTER TABLE "dom_sale_items" ADD COLUMN     "cylinders_dispatched" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "empties_collected" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sale_type" "CommercialSaleType" NOT NULL DEFAULT 'SALE';

