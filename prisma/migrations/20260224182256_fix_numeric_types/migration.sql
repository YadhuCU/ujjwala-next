-- Safe in-place type conversion: String → Int/Decimal
-- Uses ALTER COLUMN TYPE ... USING to PRESERVE existing data.
-- PostgreSQL will cast "100" → 100, "99.50" → 99.50 automatically.
-- NULL or empty strings are handled by NULLIF to avoid cast errors.

-- ═══════════════════════════════════════════════════════════════════
-- arb_sales
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "arb_sales"
  ALTER COLUMN "quantity" TYPE INTEGER USING COALESCE(NULLIF("quantity", '')::INTEGER, 0),
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "quantity" SET NOT NULL;

ALTER TABLE "arb_sales"
  ALTER COLUMN "sale_price" TYPE DECIMAL(10,2) USING NULLIF("sale_price", '')::DECIMAL(10,2);

ALTER TABLE "arb_sales"
  ALTER COLUMN "net_total" TYPE DECIMAL(10,2) USING NULLIF("net_total", '')::DECIMAL(10,2);

-- ═══════════════════════════════════════════════════════════════════
-- collections
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "collections"
  ALTER COLUMN "amount" TYPE DECIMAL(10,2) USING NULLIF("amount", '')::DECIMAL(10,2);

-- ═══════════════════════════════════════════════════════════════════
-- customers
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "customers"
  ALTER COLUMN "discount" TYPE INTEGER USING NULLIF("discount", '')::INTEGER;

-- ═══════════════════════════════════════════════════════════════════
-- dom_sales
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "dom_sales"
  ALTER COLUMN "quantity" TYPE INTEGER USING COALESCE(NULLIF("quantity", '')::INTEGER, 0),
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "quantity" SET NOT NULL;

ALTER TABLE "dom_sales"
  ALTER COLUMN "sale_price" TYPE DECIMAL(10,2) USING NULLIF("sale_price", '')::DECIMAL(10,2);

ALTER TABLE "dom_sales"
  ALTER COLUMN "collection_amount" TYPE DECIMAL(10,2) USING NULLIF("collection_amount", '')::DECIMAL(10,2);

ALTER TABLE "dom_sales"
  ALTER COLUMN "net_total" TYPE DECIMAL(10,2) USING NULLIF("net_total", '')::DECIMAL(10,2);

-- ═══════════════════════════════════════════════════════════════════
-- expenses
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "expenses"
  ALTER COLUMN "amount" TYPE DECIMAL(10,2) USING NULLIF("amount", '')::DECIMAL(10,2);

-- ═══════════════════════════════════════════════════════════════════
-- products
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "products"
  ALTER COLUMN "price" TYPE DECIMAL(10,2) USING NULLIF("price", '')::DECIMAL(10,2);

-- ═══════════════════════════════════════════════════════════════════
-- rent_products
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "rent_products"
  ALTER COLUMN "quantity" TYPE INTEGER USING COALESCE(NULLIF("quantity", '')::INTEGER, 0),
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "quantity" SET NOT NULL;

-- ═══════════════════════════════════════════════════════════════════
-- sales
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "sales"
  ALTER COLUMN "quantity" TYPE INTEGER USING COALESCE(NULLIF("quantity", '')::INTEGER, 0),
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "quantity" SET NOT NULL;

ALTER TABLE "sales"
  ALTER COLUMN "product_cost" TYPE DECIMAL(10,2) USING NULLIF("product_cost", '')::DECIMAL(10,2);

ALTER TABLE "sales"
  ALTER COLUMN "sale_price" TYPE DECIMAL(10,2) USING NULLIF("sale_price", '')::DECIMAL(10,2);

ALTER TABLE "sales"
  ALTER COLUMN "net_total" TYPE DECIMAL(10,2) USING NULLIF("net_total", '')::DECIMAL(10,2);

-- ═══════════════════════════════════════════════════════════════════
-- stocks
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE "stocks"
  ALTER COLUMN "quantity" TYPE INTEGER USING COALESCE(NULLIF("quantity", '')::INTEGER, 0),
  ALTER COLUMN "quantity" SET DEFAULT 0,
  ALTER COLUMN "quantity" SET NOT NULL;

ALTER TABLE "stocks"
  ALTER COLUMN "product_cost" TYPE DECIMAL(10,2) USING NULLIF("product_cost", '')::DECIMAL(10,2);

ALTER TABLE "stocks"
  ALTER COLUMN "sale_price" TYPE DECIMAL(10,2) USING NULLIF("sale_price", '')::DECIMAL(10,2);
