import { beforeEach, describe, expect, it } from "vitest";
import {
  CommercialSaleType,
  PaymentType,
  ProductType,
  RefType,
  TxnType,
} from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertGodownMatchesLedger,
  balanceOf,
  custodyOf,
  godownOf,
  makeCustomer,
  makeProduct,
  makeStock,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as CommercialSaleService from "./commercial-sale.service";

let userId: number;
let customerId: number;
let productId: number;
let stockId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
  customerId = (await makeCustomer()).id;

  const product = await makeProduct(ProductType.COMMERCIAL);
  productId = product.id;
  await seedGodown(productId, { filledQty: 100 });
  stockId = (await makeStock(productId, 100)).id;
});

function saleInput(
  saleType: CommercialSaleType,
  quantity = 10,
  paidAmount = 0,
) {
  return {
    customerId,
    invoiceDate: new Date("2026-08-14"),
    paymentType: PaymentType.CASH,
    paidAmount,
    discount: undefined,
    notes: undefined,
    items: [{ stockId, saleType, quantity, salePrice: 100 }],
  };
}

describe("createCommercialSale — RENT", () => {
  it("dispatches cylinders and records the customer's custody", async () => {
    await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT),
      userId,
    );

    expect((await godownOf(productId)).filledQty).toBe(90);
    expect(await custodyOf(customerId, productId)).toBe(10);
    expect(await balanceOf(customerId)).toBe(1000);

    const txn = await prisma.cylinderTransaction.findFirstOrThrow({
      where: { productId, refType: RefType.INVOICE },
    });
    expect(txn.txnType).toBe(TxnType.RENT_DELIVERY);
    expect(txn.filledDelta).toBe(-10);
    expect(txn.emptyDelta).toBe(0);

    const item = await prisma.commercialSaleItem.findFirstOrThrow({});
    expect(item.cylindersDispatched).toBe(10);
    expect(item.cylindersReturned).toBe(0);
  });
});

describe("createCommercialSale — SALE", () => {
  it("sells outright and tracks no custody", async () => {
    await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.SALE),
      userId,
    );

    expect((await godownOf(productId)).filledQty).toBe(90);
    expect(await custodyOf(customerId, productId)).toBe(0);

    const txn = await prisma.cylinderTransaction.findFirstOrThrow({
      where: { productId, refType: RefType.INVOICE },
    });
    expect(txn.txnType).toBe(TxnType.SALE_OUT);
  });

  it("refuses to dispatch more filled cylinders than the godown holds", async () => {
    // A second product with only 4 in the godown, but a batch big enough to
    // pass the stock check — so it is the godown guard that fires.
    const scarce = await makeProduct(ProductType.COMMERCIAL);
    await seedGodown(scarce.id, { filledQty: 4 });
    const scarceStock = await makeStock(scarce.id, 100);

    await expect(
      CommercialSaleService.createCommercialSale(
        {
          ...saleInput(CommercialSaleType.SALE, 10),
          items: [
            {
              stockId: scarceStock.id,
              saleType: CommercialSaleType.SALE,
              quantity: 10,
              salePrice: 100,
            },
          ],
        },
        userId,
      ),
    ).rejects.toThrow(/Insufficient filled cylinders/);

    expect(await prisma.commercialSale.count()).toBe(0);
  });
});

describe("returnCylinders", () => {
  it("brings empties back and reduces custody", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT),
      userId,
    );
    const item = await prisma.commercialSaleItem.findFirstOrThrow({});

    await CommercialSaleService.returnCylinders(
      sale.id,
      { items: [{ itemId: item.id, returnQty: 4 }] },
      userId,
    );

    const godown = await godownOf(productId);
    expect(godown.emptyQty).toBe(4);
    // Filled stays down — the cylinders came back empty
    expect(godown.filledQty).toBe(90);
    expect(await custodyOf(customerId, productId)).toBe(6);

    const { filled, empty } = await assertGodownMatchesLedger(productId);
    expect(filled[0]).toBe(filled[1]);
    expect(empty[0]).toBe(empty[1]);
  });

  it("refuses to take back more than the customer holds", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT),
      userId,
    );
    const item = await prisma.commercialSaleItem.findFirstOrThrow({});

    await expect(
      CommercialSaleService.returnCylinders(
        sale.id,
        { items: [{ itemId: item.id, returnQty: 11 }] },
        userId,
      ),
    ).rejects.toThrow(/exceeds cylinders held/);

    expect(await custodyOf(customerId, productId)).toBe(10);
  });

  it("refuses to return against an outright sale line", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.SALE),
      userId,
    );
    const item = await prisma.commercialSaleItem.findFirstOrThrow({});

    await expect(
      CommercialSaleService.returnCylinders(
        sale.id,
        { items: [{ itemId: item.id, returnQty: 1 }] },
        userId,
      ),
    ).rejects.toThrow(/Only rented cylinders/);
  });
});

describe("updateCommercialSale", () => {
  it("reverses custody and reposts the corrected quantity", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT, 10),
      userId,
    );

    await CommercialSaleService.updateCommercialSale(
      sale.id,
      saleInput(CommercialSaleType.RENT, 3),
      userId,
    );

    expect((await godownOf(productId)).filledQty).toBe(97);
    expect(await custodyOf(customerId, productId)).toBe(3);
    expect(await balanceOf(customerId)).toBe(300);

    const { filled } = await assertGodownMatchesLedger(productId);
    expect(filled[0]).toBe(filled[1]);
  });

  // Rewriting an invoice whose custody has already moved on cannot be made
  // correct, so it is refused rather than guessed at.
  it("refuses once a return has been recorded", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT),
      userId,
    );
    const item = await prisma.commercialSaleItem.findFirstOrThrow({});

    await CommercialSaleService.returnCylinders(
      sale.id,
      { items: [{ itemId: item.id, returnQty: 2 }] },
      userId,
    );

    await expect(
      CommercialSaleService.updateCommercialSale(
        sale.id,
        saleInput(CommercialSaleType.RENT, 5),
        userId,
      ),
    ).rejects.toThrow(/already has cylinder returns/);
  });
});

describe("deleteCommercialSale", () => {
  it("refuses while the customer still holds cylinders", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT),
      userId,
    );

    await expect(
      CommercialSaleService.deleteCommercialSale(sale.id, userId),
    ).rejects.toThrow(/still with the customer/);
  });

  it("unwinds both the dispatch and the return once everything is back", async () => {
    const sale = await CommercialSaleService.createCommercialSale(
      saleInput(CommercialSaleType.RENT),
      userId,
    );
    const item = await prisma.commercialSaleItem.findFirstOrThrow({});

    await CommercialSaleService.returnCylinders(
      sale.id,
      { items: [{ itemId: item.id, returnQty: 10 }] },
      userId,
    );

    await CommercialSaleService.deleteCommercialSale(sale.id, userId);

    // Back exactly where we started: filled restored, empties removed again
    const godown = await godownOf(productId);
    expect(godown.filledQty).toBe(100);
    expect(godown.emptyQty).toBe(0);
    expect(await balanceOf(customerId)).toBe(0);

    const { filled, empty } = await assertGodownMatchesLedger(productId);
    expect(filled[0]).toBe(filled[1]);
    expect(empty[0]).toBe(empty[1]);
  });
});
