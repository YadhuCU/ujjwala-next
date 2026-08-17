-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "label" VARCHAR(120) NOT NULL DEFAULT '',
ADD COLUMN     "module" VARCHAR(50) NOT NULL DEFAULT '',
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
-- Prisma emits this without a default, which fails on a table that already has
-- rows. @updatedAt is maintained by the client, so the default only has to
-- cover the backfill of existing roles.
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "permissions_module_sort_order_idx" ON "permissions"("module", "sort_order");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

