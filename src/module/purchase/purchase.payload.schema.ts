import { PurchaseType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const PurchaseItemPayloadSchema = z.object({
  productId: z.number().int(),

  batchNo: z.string().trim().max(50).optional(),

  quantity: z.number().int().min(1),

  unitCost: z.number().min(0),

  totalCost: z.number().min(0),

  purchaseType: z.enum(PurchaseType),
});

const PurchasePayloadSchema = z.object({
  invoiceNo: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50).optional(),
  ),

  vendorId: z.number().int(),

  purchaseDate: z.coerce.date(),

  notes: z.preprocess(emptyToUndefined, z.string().optional()),

  items: z.array(PurchaseItemPayloadSchema).min(1),
});

export const CreatePurchasePayloadSchema = PurchasePayloadSchema.transform(
  (data) => ({
    ...data,

    items: data.items.map((item) => ({
      ...item,

      unitCost: Math.round(item.unitCost * 100) / 100,

      totalCost: Math.round(item.totalCost * 100) / 100,
    })),
  }),
);

export const UpdatePurchasePayloadSchema = PurchasePayloadSchema.transform(
  (data) => ({
    ...data,

    items:
      data.items?.map((item) => ({
        ...item,

        unitCost: Math.round(item.unitCost * 100) / 100,

        totalCost: Math.round(item.totalCost * 100) / 100,
      })) ?? undefined,
  }),
);

export const PurchaseQuerySchema = z.object({
  vendorId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePurchasePayloadInput = z.infer<
  typeof CreatePurchasePayloadSchema
>;
export type UpdatePurchasePayloadInput = z.infer<
  typeof UpdatePurchasePayloadSchema
>;
export type PurchaseQuery = z.infer<typeof PurchaseQuerySchema>;
