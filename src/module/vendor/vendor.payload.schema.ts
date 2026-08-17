import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const GST_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const VendorPayloadSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  address: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  gstNumber: z.preprocess(
    emptyToUndefined,
    z.string().trim().regex(GST_PATTERN, "Invalid GST number").optional(),
  ),
});

export const CreateVendorSchema = VendorPayloadSchema;
export const UpdateVendorSchema = VendorPayloadSchema;

export const VendorQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type CreateVendorInput = z.infer<typeof CreateVendorSchema>;
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;
export type VendorQuery = z.infer<typeof VendorQuerySchema>;
