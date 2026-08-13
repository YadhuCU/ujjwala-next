import { z } from "zod";

export const StockAdjustmentFormSchema = z
  .object({
    productId: z.number("Select a product").int(),

    filledDelta: z.coerce.number("Filled delta is required").int().default(0),

    emptyDelta: z.coerce.number("Empty delta is required").int().default(0),

    // Free text on purpose — a dropdown would hide why the count drifted.
    reason: z
      .string("Reason is required")
      .trim()
      .min(1, "Reason is required")
      .max(500, "Reason cannot exceed 500 characters"),
  })
  .refine((data) => data.filledDelta !== 0 || data.emptyDelta !== 0, {
    message: "Enter a filled or empty quantity to adjust",
    path: ["filledDelta"],
  });

export type StockAdjustmentFormValues = z.infer<
  typeof StockAdjustmentFormSchema
>;
