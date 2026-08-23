-- NOTE: Prisma keeps wanting to drop the DEFAULT on roles.updated_at, added in
-- an earlier migration so the column could be backfilled. It is kept on purpose
-- (see 20260816120000_rbac_audit_log), so that statement is omitted here.

-- CreateTable
CREATE TABLE "commercial_sale_returns" (
    "id" SERIAL NOT NULL,
    "commercial_sale_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commercial_sale_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_sale_returns_commercial_sale_id_idx" ON "commercial_sale_returns"("commercial_sale_id");

-- AddForeignKey
ALTER TABLE "commercial_sale_returns" ADD CONSTRAINT "commercial_sale_returns_commercial_sale_id_fkey" FOREIGN KEY ("commercial_sale_id") REFERENCES "commercial_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_sale_returns" ADD CONSTRAINT "commercial_sale_returns_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

