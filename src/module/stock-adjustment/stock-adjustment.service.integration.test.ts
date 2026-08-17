import { beforeEach, describe, expect, it } from "vitest";
import { ProductType, RefType, TxnType } from "@/generated/client";
import { prisma } from "@/lib/prisma";
import {
  assertGodownMatchesLedger,
  godownOf,
  makeProduct,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as StockAdjustmentService from "./stock-adjustment.service";

let userId: number;
let productId: number;

beforeEach(async () => {
  userId = (await makeUser()).id;
  productId = (await makeProduct(ProductType.DOMESTIC)).id;
});

describe("createStockAdjustment", () => {
  // The two-record rule: an adjustment is never anonymous — the reason lives on
  // StockAdjustment and the ledger row points back at it.
  it("writes the adjustment, the ledger row and the cache together", async () => {
    await seedGodown(productId, { filledQty: 10, emptyQty: 5 });

    const adjustment = await StockAdjustmentService.createStockAdjustment(
      {
        productId,
        filledDelta: -2,
        emptyDelta: 2,
        reason: "Physical count found 2 fewer filled",
      },
      userId,
    );

    const godown = await godownOf(productId);
    expect(godown.filledQty).toBe(8);
    expect(godown.emptyQty).toBe(7);

    const txn = await prisma.cylinderTransaction.findFirstOrThrow({
      where: { productId, refId: adjustment.id },
    });
    expect(txn.txnType).toBe(TxnType.ADJUSTMENT);
    expect(txn.refType).toBe(RefType.MANUAL);
    expect(txn.refId).toBe(adjustment.id);
    expect(txn.filledDelta).toBe(-2);
    expect(txn.emptyDelta).toBe(2);

    expect(adjustment.reason).toBe("Physical count found 2 fewer filled");
    expect(adjustment.createdById).toBe(userId);
  });

  it("refuses to push filled stock below zero", async () => {
    await seedGodown(productId, { filledQty: 1 });

    await expect(
      StockAdjustmentService.createStockAdjustment(
        { productId, filledDelta: -5, emptyDelta: 0, reason: "typo" },
        userId,
      ),
    ).rejects.toThrow(/filled stock negative/);

    // Nothing new written — only the seed adjustment remains
    expect(await prisma.stockAdjustment.count()).toBe(1);
    expect(await prisma.cylinderTransaction.count()).toBe(1);
    expect((await godownOf(productId)).filledQty).toBe(1);
  });

  it("refuses to push empty stock below zero", async () => {
    await seedGodown(productId, { emptyQty: 1 });

    await expect(
      StockAdjustmentService.createStockAdjustment(
        { productId, filledDelta: 0, emptyDelta: -5, reason: "typo" },
        userId,
      ),
    ).rejects.toThrow(/empty stock negative/);
  });

  it("leaves the godown matching the ledger after a correcting adjustment", async () => {
    await seedGodown(productId, { filledQty: 10 });

    await StockAdjustmentService.createStockAdjustment(
      { productId, filledDelta: -3, emptyDelta: 0, reason: "count short" },
      userId,
    );
    // The sanctioned way to undo one: post the opposite
    await StockAdjustmentService.createStockAdjustment(
      { productId, filledDelta: 3, emptyDelta: 0, reason: "recount, was fine" },
      userId,
    );

    expect((await godownOf(productId)).filledQty).toBe(10);
    // The seed plus the two under test
    expect(await prisma.stockAdjustment.count()).toBe(3);

    // The pair cancels out, and the cache still equals the ledger
    const { filled } = await assertGodownMatchesLedger(productId);
    expect(filled[0]).toBe(filled[1]);
    expect(filled[0]).toBe(10);
  });

  it("keeps the ledger and cache in step for a fresh product", async () => {
    await StockAdjustmentService.createStockAdjustment(
      { productId, filledDelta: 12, emptyDelta: 4, reason: "opening stock" },
      userId,
    );

    const { filled, empty } = await assertGodownMatchesLedger(productId);
    expect(filled[0]).toBe(filled[1]);
    expect(empty[0]).toBe(empty[1]);
  });
});
