/*
  Warnings:

  - The `type` column on the `products` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('cash', 'cheque');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ARB', 'Domestic', 'Commercial', 'Other');

-- AlterTable
ALTER TABLE "products" DROP COLUMN "type",
ADD COLUMN     "type" "ProductType";

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "payment_type" "PaymentType" NOT NULL DEFAULT 'cash';

-- CreateTable
CREATE TABLE "arb_sales" (
    "id" SERIAL NOT NULL,
    "tr_no" VARCHAR(30),
    "stock_id" INTEGER,
    "product_id" INTEGER,
    "quantity" VARCHAR(30),
    "sale_price" VARCHAR(30),
    "net_total" VARCHAR(30),
    "created_by_id" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arb_sales_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
