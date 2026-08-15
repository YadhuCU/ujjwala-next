import { beforeEach, describe, expect, it } from "vitest";
import { CommercialSaleType, PaymentType, ProductType, TxnType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  makeCustomer,
  makeProduct,
  makeStock,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as GodownService from "./godown.service";
import * as CommercialSaleService from "@/module/commercial-sale/commercial-sale.service";

let userId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
});

describe("getGodownStatus", () => {
  it("reports filled, empty and sellable stock per product", async () => {
    const product = await makeProduct(ProductType.DOMESTIC, { name: "14.2 kg" });
    await seedGodown(product.id, { filledQty: 40, emptyQty: 12 });
    await makeStock(product.id, 30);
    await makeStock(product.id, 10);

    const { rows, totals } = await GodownService.getGodownStatus();
    const row = rows.find((r) => r.productId === product.id)!;

    expect(row.filledQty).toBe(40);
    expect(row.emptyQty).toBe(12);
    expect(row.batchQty).toBe(40);
    expect(row.batchCount).toBe(2);
    expect(row.inSync).toBe(true);

    expect(totals.filledQty).toBe(40);
    expect(totals.emptyQty).toBe(12);
    expect(totals.outOfSync).toBe(0);
  });

  // ARB and OTHER never touch the cylinder ledger, so a godown row for them
  // would always read zero and only confuse the page.
  it("leaves non-cylinder products out", async () => {
    const arb = await makeProduct(ProductType.ARB);
    await makeStock(arb.id, 50);

    const { rows } = await GodownService.getGodownStatus();

    expect(rows.some((r) => r.productId === arb.id)).toBe(false);
  });

  it("counts cylinders held by customers separately from the godown", async () => {
    const customerId = (await makeCustomer()).id;
    const product = await makeProduct(ProductType.COMMERCIAL);
    await seedGodown(product.id, { filledQty: 50 });
    const stock = await makeStock(product.id, 50);

    await CommercialSaleService.createCommercialSale(
      {
        customerId,
        invoiceDate: new Date(),
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [
          {
            stockId: stock.id,
            saleType: CommercialSaleType.RENT,
            quantity: 8,
            salePrice: 100,
          },
        ],
      },
      userId,
    );

    const { rows, totals } = await GodownService.getGodownStatus();
    const row = rows.find((r) => r.productId === product.id)!;

    expect(row.filledQty).toBe(42); // 50 dispatched down by 8
    expect(row.withCustomers).toBe(8);
    expect(totals.withCustomers).toBe(8);
    expect(row.inSync).toBe(true);
  });

  // The page exists partly to surface this, so it has to actually detect it.
  it("flags a product whose cache no longer matches the ledger", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 20 });

    // Corrupt the cache the way a bad write would
    await prisma.godownInventory.update({
      where: { productId: product.id },
      data: { filledQty: 999 },
    });

    const { rows, totals } = await GodownService.getGodownStatus();
    const row = rows.find((r) => r.productId === product.id)!;

    expect(row.inSync).toBe(false);
    expect(row.filledQty).toBe(999);
    expect(row.ledgerFilled).toBe(20);
    expect(totals.outOfSync).toBe(1);
  });
});

describe("getGodownMovements", () => {
  it("lists the ledger newest first", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 10 });
    await seedGodown(product.id, { filledQty: 5 });

    const { data, meta } = await GodownService.getGodownMovements({
      page: 1,
      limit: 20,
    });

    expect(meta.total).toBe(2);
    expect(data[0].id).toBeGreaterThan(data[1].id);
    expect(data[0].txnType).toBe(TxnType.ADJUSTMENT);
  });

  it("filters by product and movement type", async () => {
    const domestic = await makeProduct(ProductType.DOMESTIC);
    const commercial = await makeProduct(ProductType.COMMERCIAL);
    await seedGodown(domestic.id, { filledQty: 10 });
    await seedGodown(commercial.id, { filledQty: 7 });

    const byProduct = await GodownService.getGodownMovements({
      productId: domestic.id,
      page: 1,
      limit: 20,
    });
    expect(byProduct.meta.total).toBe(1);

    const byType = await GodownService.getGodownMovements({
      txnType: TxnType.SALE_OUT,
      page: 1,
      limit: 20,
    });
    expect(byType.meta.total).toBe(0);
  });
});
