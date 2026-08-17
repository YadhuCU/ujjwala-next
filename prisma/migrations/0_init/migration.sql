-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CASH', 'CHEQUE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('ARB', 'DOMESTIC', 'COMMERCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "txn_type" AS ENUM ('PURCHASE_FILL', 'PURCHASE_FULL', 'SALE_OUT', 'RENT_DELIVERY', 'CYLINDER_RETURN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ref_type" AS ENUM ('PURCHASE', 'INVOICE', 'MANUAL');

-- CreateEnum
CREATE TYPE "purchase_type" AS ENUM ('FILL', 'FULL');

-- CreateEnum
CREATE TYPE "CommercialSaleType" AS ENUM ('RENT', 'SALE');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('SALE_CHARGE', 'PAYMENT', 'ADJUSTMENT', 'OPENING');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200),
    "password" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email" VARCHAR(50),
    "mobile" VARCHAR(20),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" SERIAL NOT NULL,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50),
    "district" VARCHAR(50),
    "pincode" VARCHAR(10),
    "locality" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(10),
    "location_id" INTEGER,
    "concerned_person" VARCHAR(30),
    "concerned_person_mobile" VARCHAR(30),
    "discount" INTEGER,
    "gst_number" VARCHAR(15),
    "initial_pending_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_initial_cylinder_balances" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_initial_cylinder_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" "ProductType" NOT NULL,
    "weight" VARCHAR(50),
    "sale_price" DECIMAL(10,2),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "godown_inventory" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "filled_qty" INTEGER NOT NULL,
    "empty_qty" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "godown_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cylinder_transactions" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "txn_type" "txn_type" NOT NULL,
    "filled_delta" INTEGER NOT NULL,
    "empty_delta" INTEGER NOT NULL,
    "ref_type" "ref_type" NOT NULL,
    "ref_id" INTEGER NOT NULL,
    "voided_txn_id" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cylinder_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stocks" (
    "id" SERIAL NOT NULL,
    "batch_no" VARCHAR(50) NOT NULL,
    "product_id" INTEGER,
    "invoice_no" VARCHAR(50),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "product_cost" DECIMAL(10,2),
    "vendor_id" INTEGER,
    "purchase_id" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" SERIAL NOT NULL,
    "invoice_no" VARCHAR(50),
    "vendor_id" INTEGER NOT NULL,
    "total_cost" DECIMAL(10,2) NOT NULL,
    "purchase_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

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
    "purchase_type" "purchase_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "filled_delta" INTEGER NOT NULL,
    "empty_delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dom_sales" (
    "id" SERIAL NOT NULL,
    "tr_no" VARCHAR(30),
    "customer_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2),
    "payment_type" "PaymentType" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dom_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dom_sale_items" (
    "id" SERIAL NOT NULL,
    "dom_sale_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2),
    "net_total" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dom_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arb_sales" (
    "id" SERIAL NOT NULL,
    "tr_no" VARCHAR(30),
    "customer_id" INTEGER NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2),
    "payment_type" "PaymentType" NOT NULL DEFAULT 'CASH',
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arb_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arb_sale_items" (
    "id" SERIAL NOT NULL,
    "arb_sale_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "stock_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2),
    "net_total" DECIMAL(10,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arb_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_sales" (
    "id" SERIAL NOT NULL,
    "tr_no" VARCHAR(30),
    "customer_id" INTEGER,
    "total_amount" DECIMAL(10,2),
    "paid_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2),
    "payment_type" "PaymentType" NOT NULL DEFAULT 'CASH',
    "invoice_date" DATE NOT NULL,
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_sale_items" (
    "id" SERIAL NOT NULL,
    "commercial_sale_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "stock_id" INTEGER,
    "sale_type" "CommercialSaleType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "sale_price" DECIMAL(10,2),
    "net_total" DECIMAL(10,2),
    "cylinders_dispatched" INTEGER NOT NULL DEFAULT 0,
    "cylinders_returned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "expense" VARCHAR(100),
    "date" DATE,
    "amount" DECIMAL(10,2),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payment_ledger" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "ref_type" "ref_type" NOT NULL,
    "ref_id" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payment_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_balances" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "pending_amount" DECIMAL(10,2) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_cylinder_ledgers" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "pending_cylinder" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_cylinder_ledgers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_role_id_user_id_key" ON "user_roles"("role_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customers_name_key" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_initial_cylinder_balances_customer_id_product_id_key" ON "customer_initial_cylinder_balances"("customer_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_name_key" ON "vendors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "godown_inventory_product_id_key" ON "godown_inventory"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "cylinder_transactions_voided_txn_id_key" ON "cylinder_transactions"("voided_txn_id");

-- CreateIndex
CREATE INDEX "cylinder_transactions_product_id_idx" ON "cylinder_transactions"("product_id");

-- CreateIndex
CREATE INDEX "cylinder_transactions_ref_type_ref_id_idx" ON "cylinder_transactions"("ref_type", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "stocks_batch_no_key" ON "stocks"("batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_invoice_no_key" ON "purchases"("invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "dom_sales_tr_no_key" ON "dom_sales"("tr_no");

-- CreateIndex
CREATE INDEX "dom_sales_customer_id_idx" ON "dom_sales"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "arb_sales_tr_no_key" ON "arb_sales"("tr_no");

-- CreateIndex
CREATE INDEX "arb_sales_customer_id_idx" ON "arb_sales"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_sales_tr_no_key" ON "commercial_sales"("tr_no");

-- CreateIndex
CREATE INDEX "commercial_sales_customer_id_idx" ON "commercial_sales"("customer_id");

-- CreateIndex
CREATE INDEX "commercial_sales_invoice_date_idx" ON "commercial_sales"("invoice_date");

-- CreateIndex
CREATE INDEX "customer_payment_ledger_customer_id_idx" ON "customer_payment_ledger"("customer_id");

-- CreateIndex
CREATE INDEX "customer_payment_ledger_ref_type_ref_id_idx" ON "customer_payment_ledger"("ref_type", "ref_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_balances_customer_id_key" ON "customer_balances"("customer_id");

-- CreateIndex
CREATE INDEX "customer_cylinder_ledgers_customer_id_idx" ON "customer_cylinder_ledgers"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_cylinder_ledgers_product_id_customer_id_key" ON "customer_cylinder_ledgers"("product_id", "customer_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_initial_cylinder_balances" ADD CONSTRAINT "customer_initial_cylinder_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_initial_cylinder_balances" ADD CONSTRAINT "customer_initial_cylinder_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "godown_inventory" ADD CONSTRAINT "godown_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_transactions" ADD CONSTRAINT "cylinder_transactions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cylinder_transactions" ADD CONSTRAINT "cylinder_transactions_voided_txn_id_fkey" FOREIGN KEY ("voided_txn_id") REFERENCES "cylinder_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stocks" ADD CONSTRAINT "stocks_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sales" ADD CONSTRAINT "dom_sales_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sale_items" ADD CONSTRAINT "dom_sale_items_dom_sale_id_fkey" FOREIGN KEY ("dom_sale_id") REFERENCES "dom_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sale_items" ADD CONSTRAINT "dom_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dom_sale_items" ADD CONSTRAINT "dom_sale_items_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sales" ADD CONSTRAINT "arb_sales_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sale_items" ADD CONSTRAINT "arb_sale_items_arb_sale_id_fkey" FOREIGN KEY ("arb_sale_id") REFERENCES "arb_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sale_items" ADD CONSTRAINT "arb_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arb_sale_items" ADD CONSTRAINT "arb_sale_items_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sales" ADD CONSTRAINT "commercial_sales_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sale_items" ADD CONSTRAINT "commercial_sale_items_commercial_sale_id_fkey" FOREIGN KEY ("commercial_sale_id") REFERENCES "commercial_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sale_items" ADD CONSTRAINT "commercial_sale_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sale_items" ADD CONSTRAINT "commercial_sale_items_stock_id_fkey" FOREIGN KEY ("stock_id") REFERENCES "stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_balances" ADD CONSTRAINT "customer_balances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cylinder_ledgers" ADD CONSTRAINT "customer_cylinder_ledgers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_cylinder_ledgers" ADD CONSTRAINT "customer_cylinder_ledgers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

