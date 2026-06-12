import { PurchaseType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

/* ---------- Purchase Item ---------- */

export const PurchaseItemFormSchema = z.object({
  productId: z.number("Select a product").min(1, "Select a product"),

  batchNo: z
    .string()
    .trim()
    .max(50, "Batch number cannot exceed 50 characters")
    .optional(),

  quantity: z.coerce
    .number("Quantity required")
    .int()
    .min(1, "Quantity must be greater than 0"),

  unitCost: z.coerce
    .number("Unit cost required")
    .min(0, "Unit cost cannot be negative"),

  purchaseType: z.enum(PurchaseType, "Purchase type is required"),
});

export type PurchaseItemFormValues = z.infer<typeof PurchaseItemFormSchema>;

/* ---------- Purchase ---------- */

export const PurchaseCreateFormSchema = z.object({
  invoiceNo: z
    .string()
    .trim()
    .transform((v) => emptyToUndefined(v))
    .optional(),

  vendorId: z.number().min(1, "Select a vendor"),

  purchaseDate: z.date().min(1, "Purchase date is required"),

  notes: z
    .string()
    .trim()
    .transform((v) => emptyToUndefined(v))
    .optional(),

  items: z
    .array(PurchaseItemFormSchema)
    .min(1, "At least one item is required"),
});

export type PurchaseFormValues = z.infer<typeof PurchaseCreateFormSchema>;
