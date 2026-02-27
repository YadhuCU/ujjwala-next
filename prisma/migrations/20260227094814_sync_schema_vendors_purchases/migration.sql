/*
  Warnings:

  - You are about to drop the column `net_total` on the `arb_sales` table. All the data in the column will be lost.
  - You are about to drop the column `product_id` on the `arb_sales` table. All the data in the column will be lost.
  - You are about to drop the column `quantity` on the `arb_sales` table. All the data in the column will be lost.
  - You are about to drop the column `sale_price` on the `arb_sales` table. All the data in the column will be lost.
  - You are about to drop the column `stock_id` on the `arb_sales` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "arb_sales" DROP CONSTRAINT "arb_sales_product_id_fkey";

-- DropForeignKey
ALTER TABLE "arb_sales" DROP CONSTRAINT "arb_sales_stock_id_fkey";

-- AlterTable
ALTER TABLE "arb_sales" DROP COLUMN "net_total",
DROP COLUMN "product_id",
DROP COLUMN "quantity",
DROP COLUMN "sale_price",
DROP COLUMN "stock_id",
ADD COLUMN     "customer_id" INTEGER,
ADD COLUMN     "discount" DECIMAL(10,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_type" "PaymentType" NOT NULL DEFAULT 'cash',
ADD COLUMN     "total_amount" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "stocks" ADD COLUMN     "purchase_id" INTEGER,
ADD COLUMN     "vendor_id" INTEGER;

-- CreateTable
CREATE TABLE "arb_sale_items" (
    "id" SERIAL NOT NULL,
    "arb_sale_id" INTEGER NOT NULL,
    "stock_id" INTEGER,
    "product_id" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2),
    "net_total" DECIMAL(10,2),

    CONSTRAINT "arb_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(20),
    "address" TEXT,
    "gst_number" VARCHAR(15),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" SERIAL NOT NULL,
    "invoice_no" VARCHAR(50),
    "vendor_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2),
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" SERIAL NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "batch_no" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(10,2),
    "total_cost" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendors_name_key" ON "vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_invoice_no_key" ON "purchases"("invoice_no");

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sale_items" ADD CONSTRAINT "arb_sale_items_arb_sale_id_fkey" FOREIGN KEY ("arb_sale_id") REFERENCES "arb_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sale_items" ADD CONSTRAINT "arb_sale_items_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sale_items" ADD CONSTRAINT "arb_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
