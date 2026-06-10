import { Product } from "@/generated/client";

export function serializeProduct(product: Product) {
  return {
    ...product,
    salePrice: product.salePrice?.toNumber(),
    weight: product.weight ?? undefined,
  };
}

export type ProductResponse = ReturnType<typeof serializeProduct>;
