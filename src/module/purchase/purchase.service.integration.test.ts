import { beforeEach, describe, expect, it } from "vitest";
import { ProductType, PurchaseType, TxnType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertGodownMatchesLedger,
  godownOf,
  makeProduct,
  makeUser,
  makeVendor,
  seedGodown,
} from "@/test/factories";
import * as PurchaseService from "./purchase.service";

let userId: number;
let vendorId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
  vendorId = (await makeVendor()).id;
});

function purchaseInput(
  productId: number,
  overrides: {
    quantity?: number;
    purchaseType?: PurchaseType;
    batchNo?: string;
  } = {},
) {
  const quantity = overrides.quantity ?? 10;

  return {
    invoiceNo: undefined,
    vendorId,
    purchaseDate: new Date("2026-08-14"),
    notes: undefined,
    items: [
      {
        productId,
        batchNo: overrides.batchNo,
        quantity,
        unitCost: 800,
        totalCost: 800 * quantity,
        purchaseType: overrides.purchaseType ?? PurchaseType.FULL,
      },
    ],
  };
}

describe("createPurchase", () => {
  it("moves filled cylinders into the godown for a FULL purchase", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    await PurchaseService.createPurchase(purchaseInput(product.id), userId);

    const godown = await godownOf(product.id);
    expect(godown.filledQty).toBe(10);
    expect(godown.emptyQty).toBe(0);

    const txns = await prisma.cylinderTransaction.findMany({
      where: { productId: product.id },
    });
    expect(txns).toHaveLength(1);
    expect(txns[0].txnType).toBe(TxnType.PURCHASE_FULL);
    expect(txns[0].filledDelta).toBe(10);
    expect(txns[0].emptyDelta).toBe(0);
  });

  it("swaps empties for filled on a FILL purchase", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { emptyQty: 10 });

    await PurchaseService.createPurchase(
      purchaseInput(product.id, { purchaseType: PurchaseType.FILL }),
      userId,
    );

    const godown = await godownOf(product.id);
    expect(godown.filledQty).toBe(10);
    expect(godown.emptyQty).toBe(0);
  });

  it("refuses a FILL purchase with too few empties", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { emptyQty: 3 });

    await expect(
      PurchaseService.createPurchase(
        purchaseInput(product.id, { purchaseType: PurchaseType.FILL }),
        userId,
      ),
    ).rejects.toThrow(/Insufficient empty cylinders/);

    // The whole thing is one transaction — nothing should have landed
    expect(await prisma.purchase.count()).toBe(0);
    expect(await prisma.stock.count()).toBe(0);
    expect((await godownOf(product.id)).emptyQty).toBe(3);
  });

  it("sums a product across lines before checking empties", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { emptyQty: 10 });

    const input = purchaseInput(product.id, {
      purchaseType: PurchaseType.FILL,
      quantity: 6,
    });
    // Two lines of 6 against 10 empties: fine one at a time, not together
    input.items.push({ ...input.items[0], batchNo: "SECOND" });

    await expect(
      PurchaseService.createPurchase(input, userId),
    ).rejects.toThrow(/Insufficient empty cylinders/);
  });

  // ARB is bulk LPG — Stock batches only, no cylinder ledger, no godown.
  it("keeps ARB purchases out of the cylinder ledger and godown", async () => {
    const product = await makeProduct(ProductType.ARB);

    await PurchaseService.createPurchase(purchaseInput(product.id), userId);

    expect(
      await prisma.cylinderTransaction.count({
        where: { productId: product.id },
      }),
    ).toBe(0);
    expect((await godownOf(product.id)).filledQty).toBe(0);

    // …but the batch still exists to sell from
    const stock = await prisma.stock.findFirstOrThrow({
      where: { productId: product.id },
    });
    expect(stock.quantity).toBe(10);
  });

  it("generates a batch number when the vendor gives none", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    const purchase = await PurchaseService.createPurchase(
      purchaseInput(product.id),
      userId,
    );

    const stock = await prisma.stock.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });
    expect(stock.batchNo).toMatch(/^BATCH-\d{8}-P\d+-PR\d+-1$/);

    // PurchaseItem and Stock must agree on it
    const item = await prisma.purchaseItem.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });
    expect(item.batchNo).toBe(stock.batchNo);
  });
});

describe("updatePurchase", () => {
  it("voids the original ledger rows and reposts the new quantity", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    const purchase = await PurchaseService.createPurchase(
      purchaseInput(product.id, { quantity: 10 }),
      userId,
    );

    await PurchaseService.updatePurchase(
      purchase.id,
      purchaseInput(product.id, { quantity: 4 }),
      userId,
    );

    // 10 in, 10 reversed, 4 in
    expect((await godownOf(product.id)).filledQty).toBe(4);

    const { filled, empty } = await assertGodownMatchesLedger(product.id);
    expect(filled[0]).toBe(filled[1]);
    expect(empty[0]).toBe(empty[1]);

    const reversals = await prisma.cylinderTransaction.findMany({
      where: { productId: product.id, voidedTxnId: { not: null } },
    });
    expect(reversals).toHaveLength(1);
    expect(reversals[0].filledDelta).toBe(-10);
  });

  it("frees the batch number of the voided batch", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    const purchase = await PurchaseService.createPurchase(
      purchaseInput(product.id, { batchNo: "VENDOR-1" }),
      userId,
    );

    // Reusing the same batch number would collide on the unique index if the
    // old row were not mangled
    await PurchaseService.updatePurchase(
      purchase.id,
      purchaseInput(product.id, { batchNo: "VENDOR-1" }),
      userId,
    );

    const active = await prisma.stock.findMany({
      where: { purchaseId: purchase.id, isDeleted: false },
    });
    expect(active).toHaveLength(1);
    expect(active[0].batchNo).toBe("VENDOR-1");

    const voided = await prisma.stock.findMany({
      where: { purchaseId: purchase.id, isDeleted: true },
    });
    expect(voided[0].batchNo).toMatch(/^VENDOR-1_VOID_\d+$/);
  });

  it("refuses to touch a purchase whose batch has been sold", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    const purchase = await PurchaseService.createPurchase(
      purchaseInput(product.id),
      userId,
    );
    const stock = await prisma.stock.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });

    const customer = await prisma.customer.create({
      data: { name: "Buyer", initialPendingAmount: 0 },
    });
    const sale = await prisma.domSale.create({
      data: { customerId: customer.id, totalAmount: 100, paidAmount: 0 },
    });
    await prisma.domSaleItem.create({
      data: {
        domSaleId: sale.id,
        stockId: stock.id,
        productId: product.id,
        quantity: 1,
        salePrice: 100,
        netTotal: 100,
      },
    });

    await expect(
      PurchaseService.updatePurchase(
        purchase.id,
        purchaseInput(product.id, { quantity: 4 }),
        userId,
      ),
    ).rejects.toThrow(/used in sales/);
  });
});

describe("deletePurchase", () => {
  it("takes the cylinders back out of the godown and keeps the ledger true", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    const purchase = await PurchaseService.createPurchase(
      purchaseInput(product.id),
      userId,
    );

    await PurchaseService.deletePurchase(purchase.id, userId);

    expect((await godownOf(product.id)).filledQty).toBe(0);

    const { filled } = await assertGodownMatchesLedger(product.id);
    expect(filled[0]).toBe(filled[1]);

    const deleted = await prisma.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.updatedById).toBe(userId);
  });
});
