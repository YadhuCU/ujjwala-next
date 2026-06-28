import { z } from "zod"
import { PaymentType, LedgerEntryType } from "@/generated/enums"

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v)

export const RecordPaymentSchema = z.object({
  amount:        z.number().positive(),
  paymentMethod: z.enum(PaymentType),                      // CASH | CHEQUE
  notes:         z.preprocess(emptyToUndefined, z.string().optional()),
})

export const TransactionQuerySchema = z.object({
  entryType: z.enum(LedgerEntryType).optional(),           // filter by type
  from:      z.coerce.date().optional(),
  to:        z.coerce.date().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
})

export type RecordPaymentInput    = z.infer<typeof RecordPaymentSchema>
export type TransactionQueryInput = z.infer<typeof TransactionQuerySchema>