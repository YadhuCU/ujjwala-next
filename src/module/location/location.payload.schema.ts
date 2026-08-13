import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const LocationPayloadSchema = z.object({
  name: z.string().trim().min(1).max(50),
  district: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  locality: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  pincode: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Pincode must contain 6 digits")
      .optional(),
  ),
});

export const CreateLocationSchema = LocationPayloadSchema;
// Update is a full replacement, not a patch — the form always sends every field
export const UpdateLocationSchema = LocationPayloadSchema;

export const LocationQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type CreateLocationInput = z.infer<typeof CreateLocationSchema>;
export type UpdateLocationInput = z.infer<typeof UpdateLocationSchema>;
export type LocationQuery = z.infer<typeof LocationQuerySchema>;
