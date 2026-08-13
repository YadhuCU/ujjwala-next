import { ProductType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const StockPayloadSchema = z.object({
  batchNo: z.string().trim().min(1).max(50),
  productId: z.number().int(),
  invoiceNo: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  quantity: z.number().int().min(0),
  productCost: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
  reason: z.string().trim().min(1).max(500),
});

const roundCost = (data: z.infer<typeof StockPayloadSchema>) => ({
  ...data,
  productCost:
    data.productCost !== undefined
      ? Math.round(data.productCost * 100) / 100
      : undefined,
});

export const CreateStockSchema = StockPayloadSchema.transform(roundCost);
export const UpdateStockSchema = StockPayloadSchema.transform(roundCost);

export const DeleteStockSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const StockQuerySchema = z.object({
  type: z.preprocess(emptyToUndefined, z.enum(ProductType).optional()),
  productId: z.coerce.number().int().optional(),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
  /** Batches drained to zero are hidden by default — sale forms only want stock on hand. */
  includeEmpty: z
    .preprocess(emptyToUndefined, z.enum(["true", "false"]).optional())
    .transform((v) => v === "true"),
});

export type CreateStockInput = z.infer<typeof CreateStockSchema>;
export type UpdateStockInput = z.infer<typeof UpdateStockSchema>;
export type DeleteStockInput = z.infer<typeof DeleteStockSchema>;
export type StockQuery = z.infer<typeof StockQuerySchema>;
