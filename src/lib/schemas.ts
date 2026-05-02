import { z } from "zod";

// Shared customer schema — used in both customers/add and customers/[id]/edit
export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().max(10).optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  discount: z.number().int().min(0).optional(),
  concernedPerson: z.string().optional().or(z.literal("")),
  concernedPersonMobile: z.string().optional().or(z.literal("")),
  gstNumber: z.string().max(15).optional().or(z.literal("")),
  initialCylinderBalance: z.number().default(0),
  initialPendingAmount: z.coerce.number().default(0),
  initialCylinderBalances: z
    .array(
      z.object({
        productId: z.string().min(1, "Select a product"),
        quantity: z.number().int().min(0, "Must be ≥ 0"),
      })
    )
    .default([]),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

