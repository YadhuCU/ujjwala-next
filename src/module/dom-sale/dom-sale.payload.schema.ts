import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const DomSaleItemPayloadSchema = z
  .object({
    stockId: z.number().int(), // optional batch traceability
    quantity: z.number().int().min(1),
    salePrice: z.number().min(0),
    // RENT is a refill (full out, empty back); SALE is sold outright. Defaults
    // to SALE, which is what every domestic line was before RENT existed.
    saleType: z.enum(CommercialSaleType).default(CommercialSaleType.SALE),
    // Empties brought back on this line. The form fills it with the quantity
    // on a refill — one empty for each full — and it can be lowered when a
    // house had none to give.
    emptiesCollected: z.number().int().min(0).default(0),
  })
  .refine(
    (item) =>
      item.saleType === CommercialSaleType.RENT || item.emptiesCollected === 0,
    {
      message: "Empties are only collected on a refill (RENT)",
      path: ["emptiesCollected"],
    },
  )
  // A refill swaps an empty for a full, so a round cannot bring back more
  // empties than it handed out fulls.
  .refine((item) => item.emptiesCollected <= item.quantity, {
    message: "Cannot collect more empties than cylinders handed out",
    path: ["emptiesCollected"],
  });

// No customer and no paid amount: a domestic sale is a field staff member's
// round, paid in full at each door. The service records it as fully paid.
const DomSalePayloadSchema = z.object({
  // Who made the round. Only someone who can see every field staff's sales
  // may name another person; for everyone else the service records the sale
  // as their own, and refuses a different id.
  fieldStaffId: z.preprocess(emptyToUndefined, z.number().int().optional()),
  paymentType: z.enum(PaymentType),
  /// Flat rupee discount applied to this invoice (not a percentage).
  /// Pre-fill from Customer.discount % × subtotal on the client form.
  discount: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  items: z.array(DomSaleItemPayloadSchema).min(1), // at least 1 item
});

const roundItems = (data: z.infer<typeof DomSalePayloadSchema>) => ({
  ...data,
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
  fieldStaffId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDomSaleInput = z.infer<typeof CreateDomSaleSchema>;
export type UpdateDomSaleInput = z.infer<typeof UpdateDomSaleSchema>;
export type DomSaleQuery = z.infer<typeof DomSaleQuerySchema>;
