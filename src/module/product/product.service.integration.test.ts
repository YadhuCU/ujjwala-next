import { describe, expect, it } from "vitest";
import { ProductType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import * as ProductService from "./product.service";

function productInput(name = "14.2 kg Domestic") {
  return {
    name,
    type: ProductType.DOMESTIC,
    weight: "14.2 kg",
    salePrice: 1100,
  };
}

describe("createProduct", () => {
  // Everything that posts to the cylinder ledger assumes this row exists.
  it("seeds the godown inventory row", async () => {
    const product = await ProductService.createProduct(productInput());

    const inventory = await prisma.godownInventory.findUniqueOrThrow({
      where: { productId: product.id },
    });
    expect(inventory.filledQty).toBe(0);
    expect(inventory.emptyQty).toBe(0);
  });

  it("refuses a duplicate name", async () => {
    await ProductService.createProduct(productInput("Duplicate"));

    await expect(
      ProductService.createProduct(productInput("Duplicate")),
    ).rejects.toThrow();
  });
});

describe("deleteProduct", () => {
  it("refuses while the godown holds filled cylinders", async () => {
    const product = await ProductService.createProduct(productInput());
    await prisma.godownInventory.update({
      where: { productId: product.id },
      data: { filledQty: 5 },
    });

    await expect(ProductService.deleteProduct(product.id)).rejects.toThrow(
      /godown still holds/,
    );
  });

  it("refuses while the godown holds empties", async () => {
    const product = await ProductService.createProduct(productInput());
    await prisma.godownInventory.update({
      where: { productId: product.id },
      data: { emptyQty: 3 },
    });

    await expect(ProductService.deleteProduct(product.id)).rejects.toThrow(
      /godown still holds/,
    );
  });

  it("refuses while a batch still has quantity", async () => {
    const product = await ProductService.createProduct(productInput());
    await prisma.stock.create({
      data: { batchNo: "B-1", productId: product.id, quantity: 4 },
    });

    await expect(ProductService.deleteProduct(product.id)).rejects.toThrow(
      /still have quantity/,
    );
  });

  it("allows retiring an empty product and hides it from the list", async () => {
    const product = await ProductService.createProduct(productInput());

    const deleted = await ProductService.deleteProduct(product.id);
    expect(deleted.isDeleted).toBe(true);

    expect(await ProductService.getProducts({})).toHaveLength(0);
  });
});

describe("getProducts", () => {
  it("filters by type", async () => {
    await ProductService.createProduct(productInput("Domestic one"));
    await ProductService.createProduct({
      ...productInput("Bulk one"),
      type: ProductType.ARB,
    });

    const arb = await ProductService.getProducts({ type: ProductType.ARB });
    expect(arb.map((p) => p.name)).toEqual(["Bulk one"]);
  });
});
