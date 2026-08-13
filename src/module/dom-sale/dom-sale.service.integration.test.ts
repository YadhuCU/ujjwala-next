import { beforeEach, describe, expect, it } from "vitest";
import {
  LedgerEntryType,
  PaymentType,
  ProductType,
  RefType,
  TxnType,
} from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertBalanceMatchesLedger,
  assertGodownMatchesLedger,
  balanceOf,
  godownOf,
  makeCustomer,
  makeProduct,
  makeStock,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as DomSaleService from "./dom-sale.service";
import * as ArbSaleService from "@/module/arb-sale/arb-sale.service";

let userId: number;
let customerId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
  customerId = (await makeCustomer()).id;
});

describe("createDomSale", () => {
  it("draws down the batch, the godown and the customer's balance", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 50 });
    const stock = await makeStock(product.id, 50);

    await DomSaleService.createDomSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 400,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 2, salePrice: 500 }],
      },
      userId,
    );

    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(48);
    expect((await godownOf(product.id)).filledQty).toBe(48);

    // 1000 charged, 400 paid → 600 outstanding
    expect(await balanceOf(customerId)).toBe(600);

    const ledger = await prisma.customerPaymentLedger.findMany({
      where: { customerId },
      orderBy: { id: "asc" },
    });
    expect(ledger.map((e) => e.entryType)).toEqual([
      LedgerEntryType.SALE_CHARGE,
      LedgerEntryType.PAYMENT,
    ]);
    expect(Number(ledger[1].amount)).toBe(-400);

    const txn = await prisma.cylinderTransaction.findFirstOrThrow({
      where: { productId: product.id, refType: RefType.INVOICE },
    });
    expect(txn.txnType).toBe(TxnType.SALE_OUT);
    expect(txn.filledDelta).toBe(-2);
  });

  it("derives the product from the batch, not from the client", async () => {
    const sold = await makeProduct(ProductType.DOMESTIC);
    const other = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(sold.id, { filledQty: 10 });
    const stock = await makeStock(sold.id, 10);

    await DomSaleService.createDomSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 1, salePrice: 100 }],
      },
      userId,
    );

    const item = await prisma.domSaleItem.findFirstOrThrow({});
    expect(item.productId).toBe(sold.id);
    expect(item.productId).not.toBe(other.id);
  });

  it("refuses to sell more than the batch holds", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 50 });
    const stock = await makeStock(product.id, 3);

    await expect(
      DomSaleService.createDomSale(
        {
          customerId,
          paymentType: PaymentType.CASH,
          paidAmount: 0,
          discount: undefined,
          notes: undefined,
          items: [{ stockId: stock.id, quantity: 5, salePrice: 100 }],
        },
        userId,
      ),
    ).rejects.toThrow(/Insufficient quantity/);

    expect(await prisma.domSale.count()).toBe(0);
  });

  it("refuses a paid amount above the total", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const stock = await makeStock(product.id, 10);

    await expect(
      DomSaleService.createDomSale(
        {
          customerId,
          paymentType: PaymentType.CASH,
          paidAmount: 5000,
          discount: undefined,
          notes: undefined,
          items: [{ stockId: stock.id, quantity: 1, salePrice: 100 }],
        },
        userId,
      ),
    ).rejects.toThrow(/cannot exceed total/i);
  });
});

describe("updateDomSale", () => {
  it("returns both caches to a state that still matches their ledgers", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 50 });
    const stock = await makeStock(product.id, 50);

    const sale = await DomSaleService.createDomSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 10, salePrice: 100 }],
      },
      userId,
    );

    await DomSaleService.updateDomSale(
      sale.id,
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 3, salePrice: 100 }],
      },
      userId,
    );

    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(47);
    expect((await godownOf(product.id)).filledQty).toBe(47);
    expect(await balanceOf(customerId)).toBe(300);

    const { filled } = await assertGodownMatchesLedger(product.id);
    expect(filled[0]).toBe(filled[1]);

    const [cached, summed] = await assertBalanceMatchesLedger(customerId);
    expect(cached).toBe(summed);
  });

  it("keeps the original id and trNo", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 10 });
    const stock = await makeStock(product.id, 10);

    const sale = await DomSaleService.createDomSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 1, salePrice: 100 }],
      },
      userId,
    );

    const before = await prisma.domSale.findUniqueOrThrow({
      where: { id: sale.id },
    });

    const updated = await DomSaleService.updateDomSale(
      sale.id,
      {
        customerId,
        paymentType: PaymentType.CHEQUE,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 2, salePrice: 100 }],
      },
      userId,
    );

    expect(updated.id).toBe(sale.id);
    expect(updated.trNo).toBe(before.trNo);
  });
});

describe("deleteDomSale", () => {
  it("puts the stock and the godown back and clears the balance", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 20 });
    const stock = await makeStock(product.id, 20);

    const sale = await DomSaleService.createDomSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 5, salePrice: 100 }],
      },
      userId,
    );

    await DomSaleService.deleteDomSale(sale.id, userId);

    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(20);
    expect((await godownOf(product.id)).filledQty).toBe(20);
    expect(await balanceOf(customerId)).toBe(0);

    const [cached, summed] = await assertBalanceMatchesLedger(customerId);
    expect(cached).toBe(summed);
  });
});

// The rule that separates the two sale modules: ARB is bulk, so it moves stock
// and money but never the cylinder ledger or the godown.
describe("ARB versus domestic", () => {
  it("writes no cylinder transaction and no godown movement for ARB", async () => {
    const product = await makeProduct(ProductType.ARB);
    const stock = await makeStock(product.id, 20);

    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 5, salePrice: 100 }],
      },
      userId,
    );

    expect(
      await prisma.cylinderTransaction.count({
        where: { productId: product.id },
      }),
    ).toBe(0);
    expect((await godownOf(product.id)).filledQty).toBe(0);

    // Stock and money still move
    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(15);
    expect(await balanceOf(customerId)).toBe(500);
  });
});
