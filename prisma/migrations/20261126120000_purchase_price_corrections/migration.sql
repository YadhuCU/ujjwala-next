-- CreateTable
CREATE TABLE "purchase_price_corrections" (
    "id" SERIAL NOT NULL,
    "purchase_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "batch_no" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "old_unit_cost" DECIMAL(10,2),
    "new_unit_cost" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_price_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_price_corrections_purchase_id_idx" ON "purchase_price_corrections"("purchase_id");

-- AddForeignKey
ALTER TABLE "purchase_price_corrections" ADD CONSTRAINT "purchase_price_corrections_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_price_corrections" ADD CONSTRAINT "purchase_price_corrections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_price_corrections" ADD CONSTRAINT "purchase_price_corrections_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

