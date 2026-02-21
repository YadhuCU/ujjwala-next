-- CreateEnum
CREATE TYPE "SaleType" AS ENUM ('sale', 'rent');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "sale_type" "SaleType" NOT NULL DEFAULT 'sale';
