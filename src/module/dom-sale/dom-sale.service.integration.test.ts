import { beforeEach, describe, expect, it } from "vitest";
import {
  CommercialSaleType,
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
  custodyOf,
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
        items: [{ stockId: stock.id, quantity: 2, salePrice: 500, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
        items: [{ stockId: stock.id, quantity: 1, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
          items: [{ stockId: stock.id, quantity: 5, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
          items: [{ stockId: stock.id, quantity: 1, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
        items: [{ stockId: stock.id, quantity: 10, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
        items: [{ stockId: stock.id, quantity: 3, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
        items: [{ stockId: stock.id, quantity: 1, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
        items: [{ stockId: stock.id, quantity: 2, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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
        items: [{ stockId: stock.id, quantity: 5, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
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

// =============================================================================
// REFILLS (RENT) AND THE CUSTOMER'S DOMESTIC HOLDING
//
// Full tracking, as for commercial: every domestic cylinder out adds to what
// the customer holds — an outright SALE included, so a customer who bought one
// can later hand its empty back — and empties collected on a refill come off.
// =============================================================================

describe("domestic refills and custody", () => {
  let productId: number;
  let stockId: number;

  beforeEach(async () => {
    productId = (await makeProduct(ProductType.DOMESTIC)).id;
    await seedGodown(productId, { filledQty: 100 });
    stockId = (await makeStock(productId, 100)).id;
  });

  const line = (
    saleType: CommercialSaleType,
    quantity: number,
    emptiesCollected = 0,
  ) => ({ stockId, quantity, salePrice: 900, saleType, emptiesCollected });

  const sale = (items: ReturnType<typeof line>[]) => ({
    customerId,
    paymentType: PaymentType.CASH,
    paidAmount: 0,
    discount: undefined,
    notes: undefined,
    items,
  });

  /** An opening holding, as onboarding records it — no invoice behind it. */
  async function holds(qty: number) {
    await prisma.customerCylinderLedger.upsert({
      where: { productId_customerId: { productId, customerId } },
      update: { pendingCylinder: qty },
      create: { customerId, productId, pendingCylinder: qty },
    });
  }

  it("counts an outright SALE as held", async () => {
    await DomSaleService.createDomSale(sale([line(CommercialSaleType.SALE, 2)]), userId);

    expect(await custodyOf(customerId, productId)).toBe(2);
    await assertGodownMatchesLedger(productId);
  });

  it("swaps fulls for empties on a refill, leaving the holding unchanged", async () => {
    await holds(3);
    const emptiesBefore = (await godownOf(productId)).emptyQty;

    const created = await DomSaleService.createDomSale(
      sale([line(CommercialSaleType.RENT, 3, 3)]),
      userId,
    );

    expect(await custodyOf(customerId, productId)).toBe(3);
    expect((await godownOf(productId)).filledQty).toBe(97);
    expect((await godownOf(productId)).emptyQty).toBe(emptiesBefore + 3);

    const kinds = await prisma.cylinderTransaction.findMany({
      where: { refType: RefType.INVOICE, refId: created.id },
      select: { txnType: true, filledDelta: true, emptyDelta: true },
      orderBy: { id: "asc" },
    });
    expect(kinds).toEqual([
      { txnType: TxnType.RENT_DELIVERY, filledDelta: -3, emptyDelta: 0 },
      { txnType: TxnType.CYLINDER_RETURN, filledDelta: 0, emptyDelta: 3 },
    ]);
    await assertGodownMatchesLedger(productId);
  });

  it("adds the difference when fewer empties come back than fulls go out", async () => {
    await holds(3);

    await DomSaleService.createDomSale(sale([line(CommercialSaleType.RENT, 3, 1)]), userId);

    expect(await custodyOf(customerId, productId)).toBe(5);
  });

  // The case chosen explicitly: buy one, refill it a month later.
  it("lets a customer who bought a cylinder hand its empty back later", async () => {
    await DomSaleService.createDomSale(sale([line(CommercialSaleType.SALE, 1)]), userId);

    await DomSaleService.createDomSale(sale([line(CommercialSaleType.RENT, 1, 1)]), userId);

    expect(await custodyOf(customerId, productId)).toBe(1);
    await assertGodownMatchesLedger(productId);
  });

  it("refuses to collect more empties than the customer holds", async () => {
    await holds(2);

    await expect(
      DomSaleService.createDomSale(sale([line(CommercialSaleType.RENT, 3, 3)]), userId),
    ).rejects.toThrow(/the customer holds 2/i);

    // nothing moved
    expect(await custodyOf(customerId, productId)).toBe(2);
    expect((await godownOf(productId)).filledQty).toBe(100);
  });

  // Cylinders delivered full on this visit cannot be the empties handed back on it.
  it("does not let this invoice's own delivery cover the empties", async () => {
    await expect(
      DomSaleService.createDomSale(sale([line(CommercialSaleType.RENT, 2, 2)]), userId),
    ).rejects.toThrow(/the customer holds 0/i);
  });

  it("checks empties across every line of the same product together", async () => {
    await holds(3);

    await expect(
      DomSaleService.createDomSale(
        sale([line(CommercialSaleType.RENT, 2, 2), line(CommercialSaleType.RENT, 2, 2)]),
        userId,
      ),
    ).rejects.toThrow(/Cannot collect 4/i);
  });

  it("reverses and reposts a refill on update", async () => {
    await holds(4);
    const created = await DomSaleService.createDomSale(
      sale([line(CommercialSaleType.RENT, 4, 4)]),
      userId,
    );

    await DomSaleService.updateDomSale(created.id, sale([line(CommercialSaleType.RENT, 2, 1)]), userId);

    // 4 held, corrected to 2 out and 1 back
    expect(await custodyOf(customerId, productId)).toBe(5);
    await assertGodownMatchesLedger(productId);
  });

  it("gives everything back on delete, empties included", async () => {
    await holds(4);
    const emptiesBefore = (await godownOf(productId)).emptyQty;
    const created = await DomSaleService.createDomSale(
      sale([line(CommercialSaleType.RENT, 4, 3)]),
      userId,
    );

    await DomSaleService.deleteDomSale(created.id, userId);

    expect(await custodyOf(customerId, productId)).toBe(4);
    expect((await godownOf(productId)).filledQty).toBe(100);
    expect((await godownOf(productId)).emptyQty).toBe(emptiesBefore);
    await assertGodownMatchesLedger(productId);
  });

  // Sales written before domestic custody was tracked added nothing to the
  // holding, so reversing one must take nothing away.
  it("leaves the holding alone when reversing a sale from before custody", async () => {
    await holds(2);
    const created = await DomSaleService.createDomSale(
      sale([line(CommercialSaleType.SALE, 3)]),
      userId,
    );
    // what a pre-migration row looks like
    await prisma.domSaleItem.updateMany({
      where: { domSaleId: created.id },
      data: { cylindersDispatched: 0, emptiesCollected: 0 },
    });
    await holds(2);

    await DomSaleService.deleteDomSale(created.id, userId);

    expect(await custodyOf(customerId, productId)).toBe(2);
  });

  it("refuses to delete a sale whose cylinders have since come back", async () => {
    const bought = await DomSaleService.createDomSale(
      sale([line(CommercialSaleType.SALE, 2)]),
      userId,
    );
    // both come back on a later refill that delivers only one
    await DomSaleService.createDomSale(sale([line(CommercialSaleType.RENT, 1, 2)]), userId);
    expect(await custodyOf(customerId, productId)).toBe(1);

    await expect(DomSaleService.deleteDomSale(bought.id, userId)).rejects.toThrow(
      /handed back on a later invoice/i,
    );
    expect(await custodyOf(customerId, productId)).toBe(1);
  });
});
