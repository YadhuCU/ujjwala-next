-- AlterTable
ALTER TABLE "customer_payment_ledger" ADD COLUMN     "voided_entry_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "customer_payment_ledger_voided_entry_id_key" ON "customer_payment_ledger"("voided_entry_id");

-- AddForeignKey
ALTER TABLE "customer_payment_ledger" ADD CONSTRAINT "customer_payment_ledger_voided_entry_id_fkey" FOREIGN KEY ("voided_entry_id") REFERENCES "customer_payment_ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;

