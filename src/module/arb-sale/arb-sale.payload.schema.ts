import { PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const ArbSaleItemPayloadSchema = z.object({
  stockId: z.number().int(),
  quantity: z.number().int().min(1),
  salePrice: z.number().min(0),
});

const ArbSalePayloadSchema = z.object({
  customerId: z.preprocess(emptyToUndefined, z.number().int()),
  paymentType: z.enum(PaymentType),
  paidAmount: z.number().min(0),
  discount: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  items: z.array(ArbSaleItemPayloadSchema).min(1), // at least 1 item
});

const roundItems = (data: z.infer<typeof ArbSalePayloadSchema>) => ({
  ...data,
  paidAmount: Math.round(data.paidAmount * 100) / 100,
  discount:
    data.discount !== undefined
      ? Math.round(data.discount * 100) / 100
      : undefined,
  items: data.items.map((item) => ({
    ...item,
    salePrice: Math.round(item.salePrice * 100) / 100,
  })),
});

export const CreateArbSaleSchema = ArbSalePayloadSchema.transform(roundItems);
// Update accepts same shape as create — full replacement, not partial
export const UpdateArbSaleSchema = ArbSalePayloadSchema.transform(roundItems);

export const ArbSaleQuerySchema = z.object({
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateArbSaleInput = z.infer<typeof CreateArbSaleSchema>;
export type UpdateArbSaleInput = z.infer<typeof UpdateArbSaleSchema>;
export type ArbSaleQuery = z.infer<typeof ArbSaleQuerySchema>;
