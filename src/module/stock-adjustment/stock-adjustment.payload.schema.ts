import { z } from "zod";

export const CreateStockAdjustmentSchema = z
  .object({
    productId: z.number().int(),
    filledDelta: z.number().int(),
    emptyDelta: z.number().int(),
    reason: z.string().trim().min(1).max(500),
  })
  .refine((data) => data.filledDelta !== 0 || data.emptyDelta !== 0, {
    message: "An adjustment must move at least one quantity",
    path: ["filledDelta"],
  });

export const StockAdjustmentQuerySchema = z.object({
  productId: z.coerce.number().int().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateStockAdjustmentInput = z.infer<
  typeof CreateStockAdjustmentSchema
>;
export type StockAdjustmentQuery = z.infer<typeof StockAdjustmentQuerySchema>;
