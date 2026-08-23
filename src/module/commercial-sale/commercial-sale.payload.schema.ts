import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const CommercialSaleItemPayloadSchema = z.object({
  stockId: z.number().int(),
  saleType: z.enum(CommercialSaleType),
  quantity: z.number().int().min(1),
  salePrice: z.number().min(0),
});

/**
 * Cylinders collected from the customer during this visit.
 *
 * Per product rather than per line item: what the customer holds can come from
 * an opening balance with no invoice behind it, so a collection cannot always
 * be attributed to something they were once dispatched.
 */
export const CommercialSaleReturnPayloadSchema = z.object({
  productId: z.number().int(),
  quantity: z.number().int().min(1),
});

const CommercialSalePayloadSchema = z.object({
  customerId: z.preprocess(emptyToUndefined, z.number().int()),
  invoiceDate: z.coerce.date(),
  paymentType: z.enum(PaymentType),
  paidAmount: z.number().min(0),
  discount: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  // May be empty when the visit was a collection only — see the refinement below
  items: z.array(CommercialSaleItemPayloadSchema),
  returns: z.array(CommercialSaleReturnPayloadSchema).default([]),
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

// A visit has to have produced something: selling nothing and collecting
// nothing is not an invoice. And one product must not appear twice in the
// collected list, or the quantities would silently fight each other.
const CommercialSaleChecked = CommercialSalePayloadSchema.refine(
  (data) => data.items.length > 0 || data.returns.length > 0,
  {
    message: "Record at least one item sold or one cylinder collected",
    path: ["items"],
  },
).refine(
  (data) =>
    new Set(data.returns.map((r) => r.productId)).size === data.returns.length,
  {
    message: "The same product is listed twice in collected cylinders",
    path: ["returns"],
  },
);

export const CreateCommercialSaleSchema =
  CommercialSaleChecked.transform(roundItems);

// Update accepts same shape as create — full replacement, not partial
export const UpdateCommercialSaleSchema =
  CommercialSaleChecked.transform(roundItems);

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
