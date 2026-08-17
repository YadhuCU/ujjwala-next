import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const CustomerBaseSchema = z.object({
  name: z.string().trim().min(1).max(50),
  phone: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{10}$/, "Phone must contain 10 digits").optional(),
  ),
  address: z.preprocess(emptyToUndefined, z.string().optional()),
  locationId: z.preprocess(emptyToUndefined, z.number().int().optional()),
  discount: z.preprocess(
    emptyToUndefined,
    z.number().int().min(0).max(100).optional(),
  ),
  concernedPerson: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(30).optional(),
  ),
  concernedPersonMobile: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(30).optional(),
  ),
  gstNumber: z.preprocess(
    emptyToUndefined,
    z.string().regex(GST_PATTERN, "Invalid GST number").optional(),
  ),
});

export const CreateCustomerSchema = CustomerBaseSchema.extend({
  initialPendingAmount: z.number().min(0).default(0),
  initialCylinderBalances: z
    .array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().min(0),
      }),
    )
    .default([]),
}).transform((data) => ({
  ...data,
  initialPendingAmount: Math.round(data.initialPendingAmount * 100) / 100,
}));

// Opening balances are never editable — they are not part of the update payload.
export const UpdateCustomerSchema = CustomerBaseSchema;

export const CustomerQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  locationId: z.coerce.number().int().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;
