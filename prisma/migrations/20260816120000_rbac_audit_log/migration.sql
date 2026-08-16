-- CreateEnum
CREATE TYPE "RbacAuditAction" AS ENUM ('ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED', 'USER_ROLES_CHANGED');

-- NOTE: Prisma also wants to drop the DEFAULT on roles.updated_at, which the
-- previous migration added so the column could be backfilled. Keeping it costs
-- nothing (Prisma always supplies the value via @updatedAt) and means a raw
-- INSERT still works, so it is deliberately left in place.

-- CreateTable
CREATE TABLE "rbac_audit_logs" (
    "id" SERIAL NOT NULL,
    "action" "RbacAuditAction" NOT NULL,
    "actor_id" INTEGER,
    "actor_name" VARCHAR(200),
    "role_id" INTEGER,
    "role_name" VARCHAR(50),
    "target_user_id" INTEGER,
    "target_user_name" VARCHAR(200),
    "added" TEXT[],
    "removed" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rbac_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rbac_audit_logs_created_at_idx" ON "rbac_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "rbac_audit_logs_role_id_idx" ON "rbac_audit_logs"("role_id");

-- CreateIndex
CREATE INDEX "rbac_audit_logs_target_user_id_idx" ON "rbac_audit_logs"("target_user_id");

-- AddForeignKey
ALTER TABLE "rbac_audit_logs" ADD CONSTRAINT "rbac_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

