import { describe, expect, it } from "vitest";
import { ProductType } from "@/generated/client";
import { isCylinderTypeProduct } from "./product.rules";

// This one predicate decides whether a line touches CylinderTransaction and
// GodownInventory at all. Getting it backwards silently corrupts the godown,
// so it is pinned here explicitly rather than inferred from a set.
describe("isCylinderTypeProduct", () => {
  it("treats DOMESTIC and COMMERCIAL as cylinders", () => {
    expect(isCylinderTypeProduct(ProductType.DOMESTIC)).toBe(true);
    expect(isCylinderTypeProduct(ProductType.COMMERCIAL)).toBe(true);
  });

  it("does not treat ARB or OTHER as cylinders", () => {
    expect(isCylinderTypeProduct(ProductType.ARB)).toBe(false);
    expect(isCylinderTypeProduct(ProductType.OTHER)).toBe(false);
  });
});
