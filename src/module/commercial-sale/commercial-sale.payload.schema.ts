import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const CommercialSaleItemPayloadSchema = z.object({
  stockId: z.number().int(),
  saleType: z.enum(CommercialSaleType),
  quantity: z.number().int().min(1),
  salePrice: z.number().min(0),
});

const CommercialSalePayloadSchema = z.object({
  customerId: z.preprocess(emptyToUndefined, z.number().int()),
  invoiceDate: z.coerce.date(),
  paymentType: z.enum(PaymentType),
  paidAmount: z.number().min(0),
  discount: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  items: z.array(CommercialSaleItemPayloadSchema).min(1), // at least 1 item
});

const roundItems = (data: z.infer<typeof CommercialSalePayloadSchema>) => ({
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

export const CreateCommercialSaleSchema =
  CommercialSalePayloadSchema.transform(roundItems);
// Update accepts same shape as create — full replacement, not partial
export const UpdateCommercialSaleSchema =
  CommercialSalePayloadSchema.transform(roundItems);

// Cylinder return — a separate business event, not an edit of the invoice
export const CylinderReturnSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.number().int(),
        returnQty: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const CommercialSaleQuerySchema = z.object({
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCommercialSaleInput = z.infer<
  typeof CreateCommercialSaleSchema
>;
export type UpdateCommercialSaleInput = z.infer<
  typeof UpdateCommercialSaleSchema
>;
export type CylinderReturnInput = z.infer<typeof CylinderReturnSchema>;
export type CommercialSaleQuery = z.infer<typeof CommercialSaleQuerySchema>;
