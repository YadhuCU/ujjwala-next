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
import { PERMISSIONS } from "@/lib/permissions";
import {
  assertBalanceMatchesLedger,
  assertGodownMatchesLedger,
  balanceOf,
  custodyOf,
  godownOf,
  makeCustomer,
  makeFieldStaff,
  makeProduct,
  makeStock,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as DomSaleService from "./dom-sale.service";
import * as ArbSaleService from "@/module/arb-sale/arb-sale.service";
import type { CreateDomSaleInput } from "./dom-sale.payload.schema";

// =============================================================================
// A domestic sale is a field staff member's round: door to door, an empty
// swapped for a full (RENT) or a cylinder sold outright (SALE), paid in full
// at each house. There is no customer, so no money ledger and no custody.
// =============================================================================

let officeId: number;
let staffId: number;
let otherStaffId: number;

/** Records rounds for any field staff — the office. */
const office = () => ({
  userId: officeId,
  permissions: [
    PERMISSIONS.DOMESTIC_SALE_CREATE,
    PERMISSIONS.DOMESTIC_SALE_READ,
    PERMISSIONS.DOMESTIC_SALE_READ_ALL,
    PERMISSIONS.DOMESTIC_SALE_UPDATE,
    PERMISSIONS.DOMESTIC_SALE_DELETE,
  ],
});

/** A field staff member: their sales are their own. */
const fieldStaff = (userId = staffId, extra: string[] = []) => ({
  userId,
  permissions: [
    PERMISSIONS.DOMESTIC_SALE_CREATE,
    PERMISSIONS.DOMESTIC_SALE_READ,
    PERMISSIONS.DOMESTIC_SALE_READ_OWN,
    ...extra,
  ] as (typeof PERMISSIONS)[keyof typeof PERMISSIONS][],
});

beforeEach(async () => {
  officeId = (await makeUser("Office")).id;
  staffId = (await makeFieldStaff("Ravi")).id;
  otherStaffId = (await makeFieldStaff("Anu")).id;
});

async function domesticStock(quantity = 50) {
  const product = await makeProduct(ProductType.DOMESTIC);
  await seedGodown(product.id, { filledQty: quantity });
  const stock = await makeStock(product.id, quantity);
  return { product, stock };
}

const line = (
  stockId: number,
  quantity: number,
  overrides: Partial<CreateDomSaleInput["items"][number]> = {},
) => ({
  stockId,
  quantity,
  salePrice: 900,
  saleType: CommercialSaleType.SALE,
  emptiesCollected: 0,
  ...overrides,
});

const refill = (stockId: number, quantity: number, empties = quantity) =>
  line(stockId, quantity, {
    saleType: CommercialSaleType.RENT,
    emptiesCollected: empties,
  });

const round = (
  items: CreateDomSaleInput["items"],
  overrides: Partial<CreateDomSaleInput> = {},
): CreateDomSaleInput => ({
  paymentType: PaymentType.CASH,
  discount: undefined,
  notes: undefined,
  fieldStaffId: undefined,
  items,
  ...overrides,
});

// =============================================================================
// WHOSE ROUND IT IS
// =============================================================================

describe("field staff", () => {
  it("lets the office record a round for a field staff member", async () => {
    const { stock } = await domesticStock();

    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 2)], { fieldStaffId: staffId }),
      office(),
    );

    expect(sale.fieldStaffId).toBe(staffId);
    // Who typed it in is still recorded, separately
    expect(sale.createdById).toBe(officeId);
    expect(sale.customerId).toBeNull();
  });

  it("records a field staff member's own sale as theirs", async () => {
    const { stock } = await domesticStock();

    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 1)]),
      fieldStaff(),
    );

    expect(sale.fieldStaffId).toBe(staffId);
    expect(sale.createdById).toBe(staffId);
  });

  it("refuses a field staff member booking a round under a colleague", async () => {
    const { stock } = await domesticStock();

    await expect(
      DomSaleService.createDomSale(
        round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
        fieldStaff(),
      ),
    ).rejects.toThrow(/only record domestic sales you made yourself/i);

    expect(await prisma.domSale.count()).toBe(0);
  });

  it("makes the office say whose round it is", async () => {
    const { stock } = await domesticStock();

    await expect(
      DomSaleService.createDomSale(round([line(stock.id, 1)]), office()),
    ).rejects.toThrow(/select the field staff/i);
  });

  it("refuses someone who cannot make domestic sales", async () => {
    const { stock } = await domesticStock();
    const accountant = await makeUser("Accountant");

    await expect(
      DomSaleService.createDomSale(
        round([line(stock.id, 1)], { fieldStaffId: accountant.id }),
        office(),
      ),
    ).rejects.toThrow(/cannot make domestic sales/i);
  });

  it("refuses a deactivated field staff member", async () => {
    const { stock } = await domesticStock();
    await prisma.user.update({
      where: { id: otherStaffId },
      data: { isActive: false },
    });

    await expect(
      DomSaleService.createDomSale(
        round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
        office(),
      ),
    ).rejects.toThrow(/cannot make domestic sales/i);
  });

  it("offers exactly the people the server would accept", async () => {
    const accountant = await makeUser("Accountant");
    await prisma.user.update({
      where: { id: otherStaffId },
      data: { isActive: false },
    });

    const ids = (await DomSaleService.getFieldStaff()).map((u) => u.id);

    expect(ids).toContain(staffId);
    expect(ids).not.toContain(otherStaffId);
    expect(ids).not.toContain(accountant.id);
    expect(ids).not.toContain(officeId);
  });
});

// =============================================================================
// CREATE
// =============================================================================

describe("createDomSale", () => {
  it("is paid in full and puts nothing on the money ledger", async () => {
    const { product, stock } = await domesticStock();

    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 2, { salePrice: 500 })], { discount: 100 }),
      fieldStaff(),
    );

    expect(Number(sale.totalAmount)).toBe(900);
    expect(Number(sale.paidAmount)).toBe(900);
    expect(await prisma.customerPaymentLedger.count()).toBe(0);

    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(48);
    expect((await godownOf(product.id)).filledQty).toBe(48);

    const txn = await prisma.cylinderTransaction.findFirstOrThrow({
      where: { productId: product.id, refType: RefType.INVOICE },
    });
    expect(txn.txnType).toBe(TxnType.SALE_OUT);
    expect(txn.filledDelta).toBe(-2);
    await assertGodownMatchesLedger(product.id);
  });

  it("derives the product from the batch, not from the client", async () => {
    const { product, stock } = await domesticStock(10);
    const other = await makeProduct(ProductType.DOMESTIC);

    await DomSaleService.createDomSale(round([line(stock.id, 1)]), fieldStaff());

    const item = await prisma.domSaleItem.findFirstOrThrow({});
    expect(item.productId).toBe(product.id);
    expect(item.productId).not.toBe(other.id);
  });

  it("refuses to sell more than the batch holds", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 50 });
    const stock = await makeStock(product.id, 3);

    await expect(
      DomSaleService.createDomSale(round([line(stock.id, 5)]), fieldStaff()),
    ).rejects.toThrow(/Insufficient quantity/);

    expect(await prisma.domSale.count()).toBe(0);
  });

  it("refuses a discount larger than the sale", async () => {
    const { stock } = await domesticStock();

    await expect(
      DomSaleService.createDomSale(
        round([line(stock.id, 1, { salePrice: 100 })], { discount: 500 }),
        fieldStaff(),
      ),
    ).rejects.toThrow(/discount cannot be more/i);
  });
});

// =============================================================================
// REFILLS
// =============================================================================

describe("refills", () => {
  it("swaps fulls for empties in the godown", async () => {
    const { product, stock } = await domesticStock(50);

    await DomSaleService.createDomSale(
      round([refill(stock.id, 4)]),
      fieldStaff(),
    );

    const godown = await godownOf(product.id);
    expect(godown.filledQty).toBe(46);
    expect(godown.emptyQty).toBe(4);

    const types = (
      await prisma.cylinderTransaction.findMany({
        where: { productId: product.id, refType: RefType.INVOICE },
      })
    ).map((t) => t.txnType);
    expect(types.sort()).toEqual(
      [TxnType.CYLINDER_RETURN, TxnType.RENT_DELIVERY].sort(),
    );
    await assertGodownMatchesLedger(product.id);
  });

  it("accepts fewer empties when a house had none to give", async () => {
    const { product, stock } = await domesticStock(50);

    await DomSaleService.createDomSale(
      round([refill(stock.id, 4, 3)]),
      fieldStaff(),
    );

    expect((await godownOf(product.id)).emptyQty).toBe(3);
    await assertGodownMatchesLedger(product.id);
  });

  it("tracks no customer custody at all", async () => {
    const { stock } = await domesticStock(50);

    await DomSaleService.createDomSale(
      round([refill(stock.id, 4), line(stock.id, 2)]),
      fieldStaff(),
    );

    expect(await prisma.customerCylinderLedger.count()).toBe(0);
  });
});

// =============================================================================
// UPDATE
// =============================================================================

describe("updateDomSale", () => {
  it("reposts the round and leaves the godown matching its ledger", async () => {
    const { product, stock } = await domesticStock(50);

    const sale = await DomSaleService.createDomSale(
      round([refill(stock.id, 4)], { fieldStaffId: staffId }),
      office(),
    );

    const updated = await DomSaleService.updateDomSale(
      sale.id,
      round([refill(stock.id, 2), line(stock.id, 1, { salePrice: 1000 })], {
        fieldStaffId: staffId,
      }),
      office(),
    );

    expect(updated.id).toBe(sale.id);
    expect(updated.trNo).toBe(sale.trNo);
    expect(Number(updated.paidAmount)).toBe(Number(updated.totalAmount));
    expect(Number(updated.totalAmount)).toBe(2800);

    const godown = await godownOf(product.id);
    expect(godown.filledQty).toBe(47);
    expect(godown.emptyQty).toBe(2);
    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(47);
    await assertGodownMatchesLedger(product.id);
  });

  it("lets the office move a round to another field staff member", async () => {
    const { stock } = await domesticStock();
    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: staffId }),
      office(),
    );

    const updated = await DomSaleService.updateDomSale(
      sale.id,
      round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
      office(),
    );

    expect(updated.fieldStaffId).toBe(otherStaffId);
  });

  it("keeps the field staff when an edit does not name one", async () => {
    const { stock } = await domesticStock();
    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: staffId }),
      office(),
    );

    const updated = await DomSaleService.updateDomSale(
      sale.id,
      round([line(stock.id, 2)]),
      office(),
    );

    expect(updated.fieldStaffId).toBe(staffId);
  });

  it("does not let a field staff member edit a colleague's round", async () => {
    const { stock } = await domesticStock();
    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
      office(),
    );

    await expect(
      DomSaleService.updateDomSale(
        sale.id,
        round([line(stock.id, 2)]),
        fieldStaff(staffId, [PERMISSIONS.DOMESTIC_SALE_UPDATE]),
      ),
    ).rejects.toThrow(/only manage your own/i);
  });
});

// =============================================================================
// DELETE
// =============================================================================

describe("deleteDomSale", () => {
  it("puts the stock and the godown back, empties included", async () => {
    const { product, stock } = await domesticStock(50);
    const sale = await DomSaleService.createDomSale(
      round([refill(stock.id, 4), line(stock.id, 1)]),
      fieldStaff(),
    );

    await DomSaleService.deleteDomSale(sale.id, office());

    const godown = await godownOf(product.id);
    expect(godown.filledQty).toBe(50);
    expect(godown.emptyQty).toBe(0);
    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(50);
    expect(
      (await prisma.domSale.findUniqueOrThrow({ where: { id: sale.id } }))
        .isDeleted,
    ).toBe(true);
    await assertGodownMatchesLedger(product.id);
  });
});

// =============================================================================
// WHO SEES WHAT
// =============================================================================

describe("scope", () => {
  it("shows a field staff member only their rounds — including ones the office entered", async () => {
    const { stock } = await domesticStock();
    await DomSaleService.createDomSale(round([line(stock.id, 1)]), fieldStaff());
    await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: staffId }),
      office(),
    );
    await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
      office(),
    );

    const query = { page: 1, limit: 20 };
    const mine = await DomSaleService.getDomSales(query, fieldStaff());
    const all = await DomSaleService.getDomSales(query, office());

    expect(mine.meta.total).toBe(2);
    expect(mine.data.every((s) => s.fieldStaffId === staffId)).toBe(true);
    expect(all.meta.total).toBe(3);
  });

  it("ignores a staff filter sent by a field staff member", async () => {
    const { stock } = await domesticStock();
    await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
      office(),
    );

    const result = await DomSaleService.getDomSales(
      { page: 1, limit: 20, fieldStaffId: otherStaffId },
      fieldStaff(),
    );

    expect(result.meta.total).toBe(0);
  });

  it("lets the office narrow the list to one field staff member", async () => {
    const { stock } = await domesticStock();
    await DomSaleService.createDomSale(round([line(stock.id, 1)]), fieldStaff());
    await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
      office(),
    );

    const result = await DomSaleService.getDomSales(
      { page: 1, limit: 20, fieldStaffId: otherStaffId },
      office(),
    );

    expect(result.meta.total).toBe(1);
    expect(result.data[0].fieldStaffId).toBe(otherStaffId);
  });

  it("does not open a colleague's round", async () => {
    const { stock } = await domesticStock();
    const sale = await DomSaleService.createDomSale(
      round([line(stock.id, 1)], { fieldStaffId: otherStaffId }),
      office(),
    );

    await expect(
      DomSaleService.getDomSaleById(sale.id, fieldStaff()),
    ).rejects.toThrow(/only manage your own/i);
  });
});

// =============================================================================
// SALES FROM BEFORE DOMESTIC MOVED TO FIELD STAFF
// They were charged to a customer and moved that customer's holding. Written
// here the way the old code wrote them, so the reversal is tested against the
// real shape rather than one this file invented.
// =============================================================================

async function legacyCustomerSale(quantity: number, empties: number) {
  const customer = await makeCustomer();
  const { product, stock } = await domesticStock(50);
  const total = quantity * 900;
  const paid = 300;

  const sale = await prisma.domSale.create({
    data: {
      trNo: `DOM-LEGACY-${stock.id}`,
      customerId: customer.id,
      fieldStaffId: staffId,
      createdById: staffId,
      totalAmount: total,
      paidAmount: paid,
      items: {
        create: {
          stockId: stock.id,
          productId: product.id,
          quantity,
          salePrice: 900,
          netTotal: total,
          saleType: CommercialSaleType.RENT,
          cylindersDispatched: quantity,
          emptiesCollected: empties,
        },
      },
    },
  });

  await prisma.stock.update({
    where: { id: stock.id },
    data: { quantity: { decrement: quantity } },
  });
  await prisma.cylinderTransaction.createMany({
    data: [
      {
        productId: product.id,
        txnType: TxnType.RENT_DELIVERY,
        filledDelta: -quantity,
        emptyDelta: 0,
        refType: RefType.INVOICE,
        refId: sale.id,
      },
      {
        productId: product.id,
        txnType: TxnType.CYLINDER_RETURN,
        filledDelta: 0,
        emptyDelta: empties,
        refType: RefType.INVOICE,
        refId: sale.id,
      },
    ],
  });
  await prisma.godownInventory.update({
    where: { productId: product.id },
    data: {
      filledQty: { decrement: quantity },
      emptyQty: { increment: empties },
    },
  });
  await prisma.customerPaymentLedger.createMany({
    data: [
      {
        customerId: customer.id,
        entryType: LedgerEntryType.SALE_CHARGE,
        amount: total,
        refType: RefType.INVOICE,
        refId: sale.id,
      },
      {
        customerId: customer.id,
        entryType: LedgerEntryType.PAYMENT,
        amount: -paid,
        refType: RefType.INVOICE,
        refId: sale.id,
      },
    ],
  });
  await prisma.customerBalance.update({
    where: { customerId: customer.id },
    data: { pendingAmount: { increment: total - paid } },
  });
  await prisma.customerCylinderLedger.create({
    data: {
      customerId: customer.id,
      productId: product.id,
      pendingCylinder: quantity - empties,
    },
  });

  return { sale, customer, product, stock };
}

describe("sales charged to a customer, from before", () => {
  it("refuses to edit one, since reposting would wipe what the customer owes", async () => {
    const { sale, customer, stock } = await legacyCustomerSale(3, 2);

    await expect(
      DomSaleService.updateDomSale(
        sale.id,
        round([line(stock.id, 1)], { fieldStaffId: staffId }),
        office(),
      ),
    ).rejects.toThrow(/delete it and enter it again/i);

    expect(await balanceOf(customer.id)).toBe(2400);
  });

  it("takes its charge and its cylinders back off the customer when deleted", async () => {
    const { sale, customer, product, stock } = await legacyCustomerSale(3, 2);

    await DomSaleService.deleteDomSale(sale.id, office());

    expect(await balanceOf(customer.id)).toBe(0);
    await assertBalanceMatchesLedger(customer.id);
    expect(await custodyOf(customer.id, product.id)).toBe(0);

    const godown = await godownOf(product.id);
    expect(godown.filledQty).toBe(50);
    expect(godown.emptyQty).toBe(0);
    expect(
      (await prisma.stock.findUniqueOrThrow({ where: { id: stock.id } }))
        .quantity,
    ).toBe(50);
    await assertGodownMatchesLedger(product.id);
  });

  it("refuses to delete one whose cylinders the customer has since handed back", async () => {
    const { sale, customer, product } = await legacyCustomerSale(3, 0);
    // The three came back some other way since
    await prisma.customerCylinderLedger.update({
      where: {
        productId_customerId: { productId: product.id, customerId: customer.id },
      },
      data: { pendingCylinder: 1 },
    });

    await expect(
      DomSaleService.deleteDomSale(sale.id, office()),
    ).rejects.toThrow(/handed back on a later invoice/i);
  });
});

// =============================================================================
// ARB
// =============================================================================

describe("ARB versus domestic", () => {
  it("writes no cylinder transaction and no godown movement for ARB", async () => {
    const customer = await makeCustomer();
    const product = await makeProduct(ProductType.ARB);
    const stock = await makeStock(product.id, 20);

    await ArbSaleService.createArbSale(
      {
        customerId: customer.id,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 5, salePrice: 100 }],
      },
      officeId,
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
    expect(await balanceOf(customer.id)).toBe(500);
  });
});
