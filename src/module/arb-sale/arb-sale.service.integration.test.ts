import { beforeEach, describe, expect, it } from "vitest";
import { LedgerEntryType, PaymentType, ProductType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertBalanceMatchesLedger,
  balanceOf,
  godownOf,
  makeCustomer,
  makeProduct,
  makeStock,
  makeUser,
} from "@/test/factories";
import * as ArbSaleService from "./arb-sale.service";

let userId: number;
let customerId: number;
let productId: number;
let stockId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
  customerId = (await makeCustomer()).id;

  const product = await makeProduct(ProductType.ARB);
  productId = product.id;
  stockId = (await makeStock(productId, 100)).id;
});

function saleInput(quantity = 5, paidAmount = 0, discount?: number) {
  return {
    customerId,
    paymentType: PaymentType.CASH,
    paidAmount,
    discount,
    notes: undefined,
    items: [{ stockId, quantity, salePrice: 200 }],
  };
}

describe("createArbSale", () => {
  it("numbers the invoice ARB-yyyymmdd-nnnnn", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(), userId);

    const stored = await prisma.arbSale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect(stored.trNo).toMatch(/^ARB-\d{8}-\d{5}$/);
  });

  it("takes the discount off the total", async () => {
    await ArbSaleService.createArbSale(saleInput(5, 0, 100), userId);

    // 5 × 200 = 1000, less 100 discount
    expect(await balanceOf(customerId)).toBe(900);
  });

  it("refuses a paid amount above the total", async () => {
    await expect(
      ArbSaleService.createArbSale(saleInput(1, 5000), userId),
    ).rejects.toThrow(/cannot exceed total/i);
  });
});

// ARB is bulk LPG: stock and money move, the cylinder ledger never does. The
// update and delete paths have to hold that line too, not just create.
describe("updateArbSale", () => {
  it("reposts stock and money without ever touching the godown", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(5), userId);

    await ArbSaleService.updateArbSale(sale.id, saleInput(2), userId);

    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stockId } }))
        .quantity,
    ).toBe(98);
    expect(await balanceOf(customerId)).toBe(400);

    expect(
      await prisma.cylinderTransaction.count({ where: { productId } }),
    ).toBe(0);
    expect((await godownOf(productId)).filledQty).toBe(0);

    const [cached, summed] = await assertBalanceMatchesLedger(customerId);
    expect(cached).toBe(summed);
  });

  it("appends an ADJUSTMENT rather than editing the original charge", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(5), userId);

    await ArbSaleService.updateArbSale(sale.id, saleInput(2), userId);

    const entries = await prisma.customerPaymentLedger.findMany({
      where: { customerId },
      orderBy: { id: "asc" },
    });

    expect(entries.map((e) => e.entryType)).toEqual([
      LedgerEntryType.SALE_CHARGE,
      LedgerEntryType.ADJUSTMENT,
      LedgerEntryType.SALE_CHARGE,
    ]);
    // The reversal cancels the original exactly
    expect(Number(entries[1].amount)).toBe(-1000);
  });

  it("keeps the original id and trNo", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(5), userId);
    const before = await prisma.arbSale.findUniqueOrThrow({
      where: { id: sale.id },
    });

    const updated = await ArbSaleService.updateArbSale(
      sale.id,
      saleInput(2),
      userId,
    );

    expect(updated.id).toBe(sale.id);
    expect(updated.trNo).toBe(before.trNo);
  });
});

describe("deleteArbSale", () => {
  it("puts the batch back and clears the balance", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(5), userId);

    await ArbSaleService.deleteArbSale(sale.id, userId);

    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stockId } }))
        .quantity,
    ).toBe(100);
    expect(await balanceOf(customerId)).toBe(0);

    const deleted = await prisma.arbSale.findUniqueOrThrow({
      where: { id: sale.id },
    });
    expect(deleted.isDeleted).toBe(true);

    const [cached, summed] = await assertBalanceMatchesLedger(customerId);
    expect(cached).toBe(summed);
  });

  it("hides the sale from the list but keeps its items for audit", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(5), userId);

    await ArbSaleService.deleteArbSale(sale.id, userId);

    const { meta } = await ArbSaleService.getArbSales({ page: 1, limit: 20 });
    expect(meta.total).toBe(0);

    expect(
      await prisma.arbSaleItem.count({ where: { arbSaleId: sale.id } }),
    ).toBe(1);
  });

  it("refuses to act on a sale that is already deleted", async () => {
    const sale = await ArbSaleService.createArbSale(saleInput(5), userId);
    await ArbSaleService.deleteArbSale(sale.id, userId);

    await expect(
      ArbSaleService.deleteArbSale(sale.id, userId),
    ).rejects.toThrow(/not found/);
  });
});
