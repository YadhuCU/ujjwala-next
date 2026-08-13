import { z } from "zod";

const emptyToUndefined = (value: string) =>
  value.trim() === "" ? undefined : value;

export const StockFormSchema = z.object({
  batchNo: z
    .string("Batch number is required")
    .trim()
    .min(1, "Batch number is required")
    .max(50, "Batch number cannot exceed 50 characters"),

  productId: z.number("Select a product").int(),

  invoiceNo: z
    .string()
    .trim()
    .transform((v) => emptyToUndefined(v))
    .optional(),

  quantity: z.coerce
    .number("Quantity is required")
    .int()
    .min(0, "Quantity cannot be negative"),

  productCost: z.coerce
    .number()
    .min(0, "Cost cannot be negative")
    .optional(),

  // Manual batches move the cylinder ledger, so they need a reason the same way
  // a stock adjustment does.
  reason: z
    .string("Reason is required")
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason cannot exceed 500 characters"),
});

export type StockFormValues = z.infer<typeof StockFormSchema>;
