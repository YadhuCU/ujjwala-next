import { ProductType } from "@/generated/enums";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const ProductPayloadSchema = z.object({
  name: z.string().trim().min(1).max(50),
  type: z.enum(ProductType),
  weight: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  salePrice: z.preprocess(emptyToUndefined, z.number().min(0).optional()),
});

const roundPrice = (data: z.infer<typeof ProductPayloadSchema>) => ({
  ...data,
  salePrice:
    data.salePrice !== undefined
      ? Math.round(data.salePrice * 100) / 100
      : undefined,
});

export const CreateProductSchema = ProductPayloadSchema.transform(roundPrice);
export const UpdateProductSchema = ProductPayloadSchema.transform(roundPrice);

export const ProductQuerySchema = z.object({
  type: z.preprocess(emptyToUndefined, z.enum(ProductType).optional()),
  search: z.preprocess(emptyToUndefined, z.string().optional()),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ProductQuery = z.infer<typeof ProductQuerySchema>;
