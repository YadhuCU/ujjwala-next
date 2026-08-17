import { PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const DomSaleItemPayloadSchema = z.object({
  stockId: z.number().int(), // optional batch traceability
  quantity: z.number().int().min(1),
  salePrice: z.number().min(0),
});

const DomSalePayloadSchema = z.object({
  customerId: z.preprocess(emptyToUndefined, z.number().int()),
  paymentType: z.enum(PaymentType),
  paidAmount: z.number().min(0),
  /// Flat rupee discount applied to this invoice (not a percentage).
  /// Pre-fill from Customer.discount % × subtotal on the client form.
  discount: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  items: z.array(DomSaleItemPayloadSchema).min(1), // at least 1 item
});

const roundItems = (data: z.infer<typeof DomSalePayloadSchema>) => ({
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

export const CreateDomSaleSchema = DomSalePayloadSchema.transform(roundItems);
// Update accepts same shape as create — full replacement, not partial
export const UpdateDomSaleSchema = DomSalePayloadSchema.transform(roundItems);

export const DomSaleQuerySchema = z.object({
  customerId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDomSaleInput = z.infer<typeof CreateDomSaleSchema>;
export type UpdateDomSaleInput = z.infer<typeof UpdateDomSaleSchema>;
export type DomSaleQuery = z.infer<typeof DomSaleQuerySchema>;
