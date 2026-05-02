-- Add paid_amount to dom_sales
ALTER TABLE "dom_sales" ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add paid_amount to arb_sales
ALTER TABLE "arb_sales" ADD COLUMN IF NOT EXISTS "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Add new columns to collections table
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "arb_sale_id" INTEGER;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "commercial_sale_id" INTEGER;
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "dom_sale_id" INTEGER;

-- Add FK for arb_sale_id on collections
ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_arb_sale_id_fkey";
ALTER TABLE "collections" ADD CONSTRAINT "collections_arb_sale_id_fkey" FOREIGN KEY ("arb_sale_id") REFERENCES "arb_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add commercial_sale_item_id to rent_transactions
ALTER TABLE "rent_transactions" ADD COLUMN IF NOT EXISTS "commercial_sale_item_id" INTEGER;
ALTER TABLE "rent_transactions" DROP CONSTRAINT IF EXISTS "rent_transactions_commercial_sale_item_id_fkey";
ALTER TABLE "rent_transactions" ADD CONSTRAINT "rent_transactions_commercial_sale_item_id_fkey" FOREIGN KEY ("commercial_sale_item_id") REFERENCES "commercial_sale_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add initial fields to customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "initial_cylinder_balance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "initial_pending_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Create commercial_sales table
CREATE TABLE IF NOT EXISTS "commercial_sales" (
    "id" SERIAL NOT NULL,
    "tr_no" VARCHAR(30),
    "total_amount" DECIMAL(10,2),
    "customer_id" INTEGER,
    "payment_type" "PaymentType" NOT NULL DEFAULT 'cash',
    "discount" DECIMAL(10,2),
    "notes" TEXT,
    "created_by_id" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT "commercial_sales_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "commercial_sales" DROP CONSTRAINT IF EXISTS "commercial_sales_customer_id_fkey";
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_sales" DROP CONSTRAINT IF EXISTS "commercial_sales_created_by_id_fkey";
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add commercial_sale_id FK on collections
ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_commercial_sale_id_fkey";
ALTER TABLE "collections" ADD CONSTRAINT "collections_commercial_sale_id_fkey" FOREIGN KEY ("commercial_sale_id") REFERENCES "commercial_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add dom_sale_id FK on collections
ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_dom_sale_id_fkey";
ALTER TABLE "collections" ADD CONSTRAINT "collections_dom_sale_id_fkey" FOREIGN KEY ("dom_sale_id") REFERENCES "dom_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create commercial_sale_items table
CREATE TABLE IF NOT EXISTS "commercial_sale_items" (
    "id" SERIAL NOT NULL,
    "commercial_sale_id" INTEGER NOT NULL,
    "stock_id" INTEGER,
    "product_id" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2),
    "net_total" DECIMAL(10,2),
    "sale_type" TEXT NOT NULL DEFAULT 'sale',
    "cylinders_dispatched" INTEGER NOT NULL DEFAULT 0,
    "cylinders_returned" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "commercial_sale_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "commercial_sale_items" DROP CONSTRAINT IF EXISTS "commercial_sale_items_commercial_sale_id_fkey";
ALTER TABLE "commercial_sale_items" ADD CONSTRAINT "commercial_sale_items_commercial_sale_id_fkey" FOREIGN KEY ("commercial_sale_id") REFERENCES "commercial_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_sale_items" DROP CONSTRAINT IF EXISTS "commercial_sale_items_stock_id_fkey";
ALTER TABLE "commercial_sale_items" ADD CONSTRAINT "commercial_sale_items_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_sale_items" DROP CONSTRAINT IF EXISTS "commercial_sale_items_product_id_fkey";
ALTER TABLE "commercial_sale_items" ADD CONSTRAINT "commercial_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create customer_initial_cylinder_balances table
CREATE TABLE IF NOT EXISTS "customer_initial_cylinder_balances" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "customer_initial_cylinder_balances_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "customer_initial_cylinder_balances" DROP CONSTRAINT IF EXISTS "customer_initial_cylinder_balances_customer_id_fkey";
ALTER TABLE "customer_initial_cylinder_balances" ADD CONSTRAINT "customer_initial_cylinder_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_initial_cylinder_balances" DROP CONSTRAINT IF EXISTS "customer_initial_cylinder_balances_product_id_fkey";
ALTER TABLE "customer_initial_cylinder_balances" ADD CONSTRAINT "customer_initial_cylinder_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "customer_initial_cylinder_balances_customer_id_product_id_key" ON "customer_initial_cylinder_balances"("customer_id", "product_id");
