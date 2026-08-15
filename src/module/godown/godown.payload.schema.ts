import { TxnType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" || v === "all" ? undefined : v);

export const GodownMovementQuerySchema = z.object({
  productId: z.coerce.number().int().optional(),
  txnType: z.preprocess(emptyToUndefined, z.enum(TxnType).optional()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type GodownMovementQuery = z.infer<typeof GodownMovementQuerySchema>;
