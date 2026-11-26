import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommercialSaleType,
  PaymentType,
  ProductType,
  PurchaseType,
  TxnType,
} from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertGodownMatchesLedger,
  godownOf,
  makeCustomer,
  makeProduct,
  makeUser,
  makeVendor,
  seedGodown,
} from "@/test/factories";
import * as PurchaseService from "./purchase.service";
import * as CommercialSaleService from "@/module/commercial-sale/commercial-sale.service";
import * as ReportService from "@/module/report/report.service";

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

    const late = await atIndiaEarlyMorning(() =>
      PurchaseService.createPurchase(purchaseInput(product.id), userId),
    );
    const lateStock = await prisma.stock.findFirstOrThrow({
      where: { purchaseId: late.id },
    });
    // Dated by the India day, not UTC
    expect(lateStock.batchNo).toMatch(/^BATCH-20260815-P\d+-PR\d+-1$/);

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

// =============================================================================
// CORRECTING PRICES
// A unit cost moves no cylinders, so it can be fixed after the batch has been
// sold from — the one correction a full edit cannot make by then.
// =============================================================================

describe("correctPurchasePrices", () => {
  /** A commercial purchase at ₹800 a cylinder, 4 of its 10 sold on rent. */
  async function soldPurchase() {
    const product = await makeProduct(ProductType.COMMERCIAL);
    const purchase = await PurchaseService.createPurchase(
      { ...purchaseInput(product.id), invoiceNo: "INV-1" },
      userId,
    );
    const batch = purchase.stocks[0];
    const customer = await makeCustomer();

    await CommercialSaleService.createCommercialSale(
      {
        customerId: customer.id,
        invoiceDate: new Date(),
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [
          {
            stockId: batch.id,
            saleType: CommercialSaleType.RENT,
            quantity: 4,
            salePrice: 1000,
          },
        ],
        returns: [],
      },
      userId,
    );

    return { product, purchase, batch, line: purchase.items[0] };
  }

  const correction = (lineId: number, unitCost: number, extra = {}) => ({
    invoiceNo: "INV-1",
    notes: undefined,
    reason: "Vendor bill says ₹850",
    items: [{ id: lineId, unitCost }],
    ...extra,
  });

  it("is the way to fix a sold purchase — the full edit is refused", async () => {
    const { product, purchase } = await soldPurchase();

    await expect(
      PurchaseService.updatePurchase(purchase.id, purchaseInput(product.id), userId),
    ).rejects.toThrow(/Correct its prices instead/);
    expect((await PurchaseService.getPurchaseById(purchase.id)).soldFrom).toBe(true);
  });

  it("changes the line, the batch's cost and the purchase total together", async () => {
    const { purchase, batch, line } = await soldPurchase();

    const corrected = await PurchaseService.correctPurchasePrices(
      purchase.id,
      correction(line.id, 850),
      userId,
    );

    expect(Number(corrected.totalCost)).toBe(8500);
    expect(corrected.updatedById).toBe(userId);
    const item = await prisma.purchaseItem.findUniqueOrThrow({ where: { id: line.id } });
    expect(Number(item.unitCost)).toBe(850);
    expect(Number(item.totalCost)).toBe(8500);
    const stock = await prisma.stock.findUniqueOrThrow({ where: { id: batch.id } });
    expect(Number(stock.productCost)).toBe(850);
  });

  it("moves no cylinders and leaves the batch and its sale alone", async () => {
    const { product, purchase, batch, line } = await soldPurchase();
    const ledgerBefore = await prisma.cylinderTransaction.count();
    const godownBefore = await godownOf(product.id);

    await PurchaseService.correctPurchasePrices(purchase.id, correction(line.id, 850), userId);

    expect(await prisma.cylinderTransaction.count()).toBe(ledgerBefore);
    expect(await godownOf(product.id)).toMatchObject({
      filledQty: godownBefore.filledQty,
      emptyQty: godownBefore.emptyQty,
    });
    const stock = await prisma.stock.findUniqueOrThrow({ where: { id: batch.id } });
    expect(stock.quantity).toBe(6);
    expect(stock.isDeleted).toBe(false);
    expect(await prisma.commercialSaleItem.count({ where: { stockId: batch.id } })).toBe(1);
    await assertGodownMatchesLedger(product.id);
  });

  it("carries through to the profit on what was already sold", async () => {
    const { purchase, line } = await soldPurchase();
    const range = {
      from: new Date(Date.now() - 86_400_000),
      to: new Date(Date.now() + 86_400_000),
      view: "category" as const,
      category: "COMMERCIAL" as const,
    };

    const before = await ReportService.getProfitReport(range);
    expect(before.summary.cost).toBe(3200); // 4 × 800

    await PurchaseService.correctPurchasePrices(purchase.id, correction(line.id, 850), userId);

    const after = await ReportService.getProfitReport(range);
    expect(after.summary.cost).toBe(3400); // 4 × 850
    expect(after.summary.sales).toBe(before.summary.sales);
  });

  it("logs each changed line with the old and new price, who and why", async () => {
    const { purchase, line, product } = await soldPurchase();

    await PurchaseService.correctPurchasePrices(purchase.id, correction(line.id, 850), userId);

    const detail = await PurchaseService.getPurchaseById(purchase.id);
    expect(detail.priceCorrections).toHaveLength(1);
    const [entry] = detail.priceCorrections;
    expect(entry).toMatchObject({
      productId: product.id,
      batchNo: line.batchNo,
      quantity: 10,
      reason: "Vendor bill says ₹850",
      createdById: userId,
    });
    expect(Number(entry.oldUnitCost)).toBe(800);
    expect(Number(entry.newUnitCost)).toBe(850);
  });

  it("copies a corrected invoice number onto the batches", async () => {
    const { purchase, batch, line } = await soldPurchase();

    await PurchaseService.correctPurchasePrices(
      purchase.id,
      correction(line.id, 800, { invoiceNo: "INV-1A" }),
      userId,
    );

    const stock = await prisma.stock.findUniqueOrThrow({ where: { id: batch.id } });
    expect(stock.invoiceNo).toBe("INV-1A");
    // only the header changed, so there is no price to log
    expect(await prisma.purchasePriceCorrection.count()).toBe(0);
  });

  it("refuses a line from another purchase", async () => {
    const { purchase } = await soldPurchase();
    const other = await PurchaseService.createPurchase(
      purchaseInput((await makeProduct(ProductType.COMMERCIAL)).id),
      userId,
    );

    await expect(
      PurchaseService.correctPurchasePrices(
        purchase.id,
        correction(other.items[0].id, 850),
        userId,
      ),
    ).rejects.toThrow(/not on purchase/);
  });

  it("refuses a correction that changes nothing", async () => {
    const { purchase, line } = await soldPurchase();

    await expect(
      PurchaseService.correctPurchasePrices(purchase.id, correction(line.id, 800), userId),
    ).rejects.toThrow(/Nothing to correct/);
  });

  it("refuses a deleted purchase", async () => {
    const product = await makeProduct(ProductType.COMMERCIAL);
    const purchase = await PurchaseService.createPurchase(purchaseInput(product.id), userId);
    await PurchaseService.deletePurchase(purchase.id, userId);

    await expect(
      PurchaseService.correctPurchasePrices(
        purchase.id,
        correction(purchase.items[0].id, 850),
        userId,
      ),
    ).rejects.toThrow(/not found/);
  });
});

// 20:00 UTC on 14 Aug is 01:30 on 15 Aug in India — the agency's day
async function atIndiaEarlyMorning<T>(run: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-08-14T20:00:00Z"));
  try {
    return await run();
  } finally {
    vi.useRealTimers();
  }
}
