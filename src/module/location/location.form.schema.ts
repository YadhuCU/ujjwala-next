import { z } from "zod";

const optionalTrimmedString = (field: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${field} cannot exceed ${max} characters`)
    .transform((value) => (value === "" ? undefined : value))
    .optional();

export const LocationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Location name is required")
    .max(50, "Location cannot exceed 50 characters"),

  district: optionalTrimmedString("District", 50),

  locality: optionalTrimmedString("Locality", 50),

  pincode: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .optional()
    .refine(
      (value) => !value || /^\d{6}$/.test(value),
      "Pincode must contain 6 digits",
    ),
});

export type LocationFormValues = z.infer<typeof LocationFormSchema>;
