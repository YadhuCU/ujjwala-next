import { ProductType } from "@/generated/client";

// Only these product types are physical cylinders. ARB (bulk LPG) and OTHER are
// tracked by Stock batches alone — they write no CylinderTransaction and no
// GodownInventory rows. Every module that touches the cylinder ledger filters
// on this first.
const CYLINDER_PRODUCT_TYPES = new Set<ProductType>([
  ProductType.COMMERCIAL,
  ProductType.DOMESTIC,
]);

export function isCylinderTypeProduct(type: ProductType): boolean {
  return CYLINDER_PRODUCT_TYPES.has(type);
}
