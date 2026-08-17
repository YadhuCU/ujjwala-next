import { describe, expect, it } from "vitest";
import { ProductType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import { makeProduct, makeUser, makeVendor } from "@/test/factories";
import * as VendorService from "./vendor.service";

describe("deleteVendor", () => {
  it("refuses while purchases reference the vendor", async () => {
    const vendor = await makeVendor();
    const user = await makeUser();

    await prisma.purchase.create({
      data: {
        vendorId: vendor.id,
        totalCost: 1000,
        purchaseDate: new Date("2026-08-14"),
        createdById: user.id,
      },
    });

    await expect(VendorService.deleteVendor(vendor.id)).rejects.toThrow(
      /purchases or stock batches/,
    );
  });

  it("refuses while stock batches reference the vendor", async () => {
    const vendor = await makeVendor();
    const product = await makeProduct(ProductType.DOMESTIC);

    await prisma.stock.create({
      data: {
        batchNo: "B-1",
        productId: product.id,
        quantity: 0,
        vendorId: vendor.id,
      },
    });

    await expect(VendorService.deleteVendor(vendor.id)).rejects.toThrow(
      /purchases or stock batches/,
    );
  });

  it("allows retiring a vendor with no history", async () => {
    const vendor = await makeVendor();

    const deleted = await VendorService.deleteVendor(vendor.id);
    expect(deleted.isDeleted).toBe(true);
  });
});
