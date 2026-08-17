import { z } from "zod";

const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const VendorFormSchema = z.object({
  name: z
    .string("Vendor name is required")
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
    .transform((v) => v || undefined)
    .optional()
    .refine((v) => !v || GST_PATTERN.test(v), "Invalid GST number"),
});

export type VendorFormValues = z.infer<typeof VendorFormSchema>;
