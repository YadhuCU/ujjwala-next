import { beforeEach, describe, expect, it } from "vitest";
import { ProductType, PurchaseType, TxnType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertGodownMatchesLedger,
  godownOf,
  makeCustomer,
  makeProduct,
  makeUser,
  makeVendor,
} from "@/test/factories";
import * as StockService from "./stock.service";
import * as PurchaseService from "@/module/purchase/purchase.service";

let userId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
});

function batchInput(
  productId: number,
  overrides: { batchNo?: string; quantity?: number } = {},
) {
  return {
    batchNo: overrides.batchNo ?? "OPENING-1",
    productId,
    invoiceNo: undefined,
    quantity: overrides.quantity ?? 25,
    productCost: 800,
    reason: "Opening stock from the old system",
  };
}

describe("createStock", () => {
  // A manual batch has no purchase behind it, so nothing else would tell the
  // ledger these cylinders exist.
  it("posts an adjustment so the godown matches the ledger", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    await StockService.createStock(batchInput(product.id), userId);

    expect((await godownOf(product.id)).filledQty).toBe(25);

    const adjustment = await prisma.stockAdjustment.findFirstOrThrow({});
    expect(adjustment.filledDelta).toBe(25);
    expect(adjustment.reason).toContain("Opening stock from the old system");
    expect(adjustment.createdById).toBe(userId);

    const txn = await prisma.cylinderTransaction.findFirstOrThrow({});
    expect(txn.txnType).toBe(TxnType.ADJUSTMENT);

    const { filled } = await assertGodownMatchesLedger(product.id);
    expect(filled[0]).toBe(filled[1]);
  });

  // ARB is bulk — the batch is the only record, there is no cylinder to count.
  it("writes no ledger row for a non-cylinder product", async () => {
    const product = await makeProduct(ProductType.ARB);

    await StockService.createStock(batchInput(product.id), userId);

    expect(await prisma.stockAdjustment.count()).toBe(0);
    expect(await prisma.cylinderTransaction.count()).toBe(0);
    expect((await godownOf(product.id)).filledQty).toBe(0);

    const stock = await prisma.stock.findFirstOrThrow({});
    expect(stock.quantity).toBe(25);
  });

  it("rejects an unknown product", async () => {
    await expect(
      StockService.createStock(batchInput(9999), userId),
    ).rejects.toThrow(/not found/);
  });
});

describe("updateStock", () => {
  it("posts only the difference when the quantity changes", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const stock = await StockService.createStock(
      batchInput(product.id, { quantity: 25 }),
      userId,
    );

    await StockService.updateStock(
      stock.id,
      { ...batchInput(product.id, { quantity: 30 }), reason: "recount" },
      userId,
    );

    expect((await godownOf(product.id)).filledQty).toBe(30);

    // The opening 25 and a correcting +5, not a second full 30
    const adjustments = await prisma.stockAdjustment.findMany({
      orderBy: { id: "asc" },
    });
    expect(adjustments.map((a) => a.filledDelta)).toEqual([25, 5]);

    const { filled } = await assertGodownMatchesLedger(product.id);
    expect(filled[0]).toBe(filled[1]);
  });

  it("moves the whole quantity when the batch changes product", async () => {
    const from = await makeProduct(ProductType.DOMESTIC);
    const to = await makeProduct(ProductType.COMMERCIAL);

    const stock = await StockService.createStock(
      batchInput(from.id, { quantity: 10 }),
      userId,
    );

    await StockService.updateStock(
      stock.id,
      { ...batchInput(to.id, { quantity: 10 }), reason: "wrong product" },
      userId,
    );

    expect((await godownOf(from.id)).filledQty).toBe(0);
    expect((await godownOf(to.id)).filledQty).toBe(10);
  });

  it("refuses to touch a batch that came from a purchase", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const vendor = await makeVendor();

    const purchase = await PurchaseService.createPurchase(
      {
        invoiceNo: undefined,
        vendorId: vendor.id,
        purchaseDate: new Date("2026-08-14"),
        notes: undefined,
        items: [
          {
            productId: product.id,
            batchNo: undefined,
            quantity: 10,
            unitCost: 800,
            totalCost: 8000,
            purchaseType: PurchaseType.FULL,
          },
        ],
      },
      userId,
    );

    const stock = await prisma.stock.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });

    await expect(
      StockService.updateStock(
        stock.id,
        { ...batchInput(product.id), reason: "nope" },
        userId,
      ),
    ).rejects.toThrow(/came from a purchase/);
  });

  it("refuses to touch a batch that has been sold from", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const customer = await makeCustomer();

    const stock = await StockService.createStock(
      batchInput(product.id),
      userId,
    );

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
      StockService.updateStock(
        stock.id,
        { ...batchInput(product.id), reason: "nope" },
        userId,
      ),
    ).rejects.toThrow(/used in sales/);
  });
});

describe("deleteStock", () => {
  it("takes the remaining quantity back out of the godown", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const stock = await StockService.createStock(
      batchInput(product.id, { quantity: 12 }),
      userId,
    );

    await StockService.deleteStock(
      stock.id,
      { reason: "entered twice" },
      userId,
    );

    expect((await godownOf(product.id)).filledQty).toBe(0);

    const { filled } = await assertGodownMatchesLedger(product.id);
    expect(filled[0]).toBe(filled[1]);
  });

  // batchNo is unique across active rows, so the slot has to be freed
  it("mangles the batch number so it can be reused", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const stock = await StockService.createStock(
      batchInput(product.id, { batchNo: "OPENING-1" }),
      userId,
    );

    await StockService.deleteStock(stock.id, { reason: "typo" }, userId);

    const deleted = await prisma.stock.findUniqueOrThrow({
      where: { id: stock.id },
    });
    expect(deleted.isDeleted).toBe(true);
    expect(deleted.quantity).toBe(0);
    expect(deleted.batchNo).toMatch(/^OPENING-1_VOID_\d+$/);

    // The freed number is usable again
    await expect(
      StockService.createStock(
        batchInput(product.id, { batchNo: "OPENING-1" }),
        userId,
      ),
    ).resolves.toBeTruthy();
  });
});

describe("getStocks", () => {
  it("hides drained batches unless asked for them", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);

    await StockService.createStock(
      batchInput(product.id, { batchNo: "FULL-1", quantity: 5 }),
      userId,
    );
    await StockService.createStock(
      batchInput(product.id, { batchNo: "EMPTY-1", quantity: 0 }),
      userId,
    );

    const onHand = await StockService.getStocks({ includeEmpty: false });
    expect(onHand.map((s) => s.batchNo)).toEqual(["FULL-1"]);

    const everything = await StockService.getStocks({ includeEmpty: true });
    expect(everything).toHaveLength(2);
  });

  it("filters by product type", async () => {
    const domestic = await makeProduct(ProductType.DOMESTIC);
    const arb = await makeProduct(ProductType.ARB);

    await StockService.createStock(
      batchInput(domestic.id, { batchNo: "DOM-1" }),
      userId,
    );
    await StockService.createStock(
      batchInput(arb.id, { batchNo: "ARB-1" }),
      userId,
    );

    const arbOnly = await StockService.getStocks({
      type: ProductType.ARB,
      includeEmpty: false,
    });

    expect(arbOnly.map((s) => s.batchNo)).toEqual(["ARB-1"]);
  });
});
