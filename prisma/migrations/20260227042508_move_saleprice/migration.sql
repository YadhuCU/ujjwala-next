/*
  Warnings:

  - You are about to drop the column `price` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `sale_price` on the `stocks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "products" DROP COLUMN "price",
ADD COLUMN     "sale_price" DECIMAL(10,2);

-- Copy the latest sale price from stocks to products
UPDATE "products" p 
SET "sale_price" = (
  SELECT s."sale_price" 
  FROM "stocks" s 
  WHERE s."product_id" = p."id" AND s."sale_price" IS NOT NULL 
  ORDER BY s."id" DESC 
  LIMIT 1
);

-- AlterTable
ALTER TABLE "stocks" DROP COLUMN "sale_price";
