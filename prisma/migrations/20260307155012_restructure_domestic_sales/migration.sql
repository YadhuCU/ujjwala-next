-- Restructure DomSale to match ArbSale structure (multiple items support)

-- Drop the old dom_sales table (this will delete all existing domestic sales data)
DROP TABLE IF EXISTS "dom_sales" CASCADE;

-- Create new dom_sales header table with master-detail pattern
CREATE TABLE "dom_sales" (
    "id" SERIAL NOT NULL,
    "tr_no" VARCHAR(30),
    "total_amount" DECIMAL(10,2),
    "customer_id" INTEGER,
    "payment_type" "PaymentType" NOT NULL DEFAULT 'cash',
    "discount" DECIMAL(10,2),
    "notes" TEXT,
    "collection_amount" DECIMAL(10,2),
    "created_by_id" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dom_sales_pkey" PRIMARY KEY ("id")
);

-- Create new dom_sale_items table for line items
CREATE TABLE "dom_sale_items" (
    "id" SERIAL NOT NULL,
    "dom_sale_id" INTEGER NOT NULL,
    "stock_id" INTEGER,
    "product_id" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2),
    "net_total" DECIMAL(10,2),

    CONSTRAINT "dom_sale_items_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for dom_sales
ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys for dom_sale_items
ALTER TABLE "dom_sale_items" ADD CONSTRAINT "dom_sale_items_dom_sale_id_fkey" FOREIGN KEY ("dom_sale_id") REFERENCES "dom_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dom_sale_items" ADD CONSTRAINT "dom_sale_items_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dom_sale_items" ADD CONSTRAINT "dom_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
