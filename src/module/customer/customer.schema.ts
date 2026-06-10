import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const CustomerCylinderBalanceSchema = z.object({
  productId: z.number("Select a product").int("Select a product"),

  qty: z.coerce.number().int().min(0, "Must be ≥ 0"),
});

export const CustomerFormSchema = z.object({
  name: z.string("Name is required").trim().min(1, "Name is required").max(50),

  phone: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{10}$/, "Phone must contain 10 digits")
      .optional(),
  ),

  address: z.preprocess(emptyToUndefined, z.string().optional()),

  locationId: z.preprocess(emptyToUndefined, z.number().optional()),

  discount: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().min(0).max(100).optional(),
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
    z
      .string()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
        "Invalid GST number",
      )
      .optional(),
  ),

  initialPendingAmount: z.coerce.number().min(0).default(0),

  initialCylinderBalances: z.array(CustomerCylinderBalanceSchema).default([]),
});

export type CustomerFormValues = z.infer<typeof CustomerFormSchema>;

/* ---------- Create ---------- */

function normalizeCreateCustomer(data: z.infer<typeof CustomerFormSchema>) {
  return {
    ...data,

    // locationId: data.locationId ? parseInt(data.locationId) : null,

    initialPendingAmount: Math.round(data.initialPendingAmount * 100) / 100,
  };
}

export const CreateCustomerSchema = CustomerFormSchema.transform(
  normalizeCreateCustomer,
);

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

/* ---------- Update ---------- */

function normalizeUpdateCustomer(
  data: Partial<z.infer<typeof CustomerFormSchema>>,
) {
  return {
    ...data,

    locationId:
      data.locationId !== undefined
        ? data.locationId
          ? data.locationId
          : null
        : undefined,

    initialPendingAmount:
      data.initialPendingAmount !== undefined
        ? Math.round(data.initialPendingAmount * 100) / 100
        : undefined,
  };
}

export const UpdateCustomerSchema = CustomerFormSchema.partial().transform(
  normalizeUpdateCustomer,
);

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;
