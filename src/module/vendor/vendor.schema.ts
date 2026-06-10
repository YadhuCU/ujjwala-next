import { z } from "zod";

export const VendorCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vendor name is required")
    .max(100, "Vendor name cannot exceed 100 characters"),

  phone: z
    .string()
    .trim()
    .max(20, "Phone number cannot exceed 20 characters")
    .transform((v) => v || undefined)
    .optional(),

  address: z
    .string()
    .trim()
    .transform((v) => v || undefined)
    .optional(),

  gstNumber: z
    .string()
    .trim()
    .max(15, "GST number cannot exceed 15 characters")
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
      "Invalid GST number",
    )
    .transform((v) => v || undefined)
    .optional(),
});

export type VendorCreateInput = z.input<typeof VendorCreateSchema>;

export const VendorUpdateSchema = VendorCreateSchema.partial();
