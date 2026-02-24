import { z } from "zod";

// Shared customer schema — used in both customers/add and customers/[id]/edit
export const customerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().max(10, "Phone must be 10 digits or less").optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  discount: z.number().int().min(0).optional(),
  concernedPerson: z.string().optional().or(z.literal("")),
  concernedPersonMobile: z.string().optional().or(z.literal("")),
  gstNumber: z.string().max(15, "GST must be 15 characters or less").optional().or(z.literal("")),
  initialCylinderBalance: z.number(),
  initialPendingAmount: z.number(),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;
