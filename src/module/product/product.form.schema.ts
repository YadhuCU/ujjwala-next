import { ProductType } from "@/generated/enums";
import { z } from "zod";

export const ProductTypeSchema = z.enum(ProductType, {
  error: "Please select a valid product type",
});

export const ProductFormSchema = z.object({
  name: z
    .string("Product name is required")
    .trim()
    .min(1, "Product name is required")
    .max(50, "Product name cannot exceed 50 characters"),

  type: ProductTypeSchema,

  weight: z
    .string()
    .trim()
    .max(50, "Weight cannot exceed 50 characters")
    .optional(),

  salePrice: z.coerce
    .number()
    .min(0, "Sale price cannot be negative")
    .optional(),
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;
