import { beforeEach, describe, expect, it } from "vitest";
import {
  CommercialSaleType,
  PaymentType,
  ProductType,
  PurchaseType,
} from "@/generated/client";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  balanceOf,
  custodyOf,
  godownOf,
  makeCustomer,
  makeFieldStaff,
  makeProduct,
  makeStock,
  makeUser,
  makeVendor,
  seedGodown,
} from "@/test/factories";
import * as ReportService from "./report.service";
import * as DomSaleService from "@/module/dom-sale/dom-sale.service";
import * as ArbSaleService from "@/module/arb-sale/arb-sale.service";
import * as CommercialSaleService from "@/module/commercial-sale/commercial-sale.service";
import * as PurchaseService from "@/module/purchase/purchase.service";
import * as ExpenseService from "@/module/expense/expense.service";
import * as CustomerService from "@/module/customer/customer.service";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";
import * as StockAdjustmentService from "@/module/stock-adjustment/stock-adjustment.service";

let ownerId: number;
let staffId: number;
let customerId: number;
let otherCustomerId: number;

const owner = () => ({
  userId: ownerId,
  permissions: [PERMISSIONS.REPORT_READ_ALL],
});
const staff = () => ({
  userId: staffId,
  permissions: [PERMISSIONS.REPORT_READ_OWN],
});

// Every date here is relative to now. Sales are reported on `createdAt`, which
// is always "now", so a fixed calendar window (this used to be August 2026)
// silently expired once the date moved past it and every sale test found 0 rows.
const DAY = 24 * 60 * 60 * 1000;
const today = new Date();
const daysAgo = (n: number) => new Date(today.getTime() - n * DAY);

const range = {
  from: daysAgo(30),
  to: today,
  page: 1,
  limit: 10,
};

beforeEach(async () => {
  ownerId = (await makeUser("Owner")).id;
  staffId = (await makeUser("Staff")).id;
  customerId = (await makeCustomer({ name: "Customer A" })).id;
  otherCustomerId = (await makeCustomer({ name: "Customer B" })).id;
});

/**
 * A domestic round. `by` enters it; with `forStaff` it is entered by the
 * office on that field staff member's behalf, as the office does.
 */
async function domSale(by: number, amount = 1000, forStaff?: number) {
  const product = await makeProduct(ProductType.DOMESTIC);
  await seedGodown(product.id, { filledQty: 20 });
  const stock = await makeStock(product.id, 20);

  return DomSaleService.createDomSale(
    {
      fieldStaffId: forStaff,
      paymentType: PaymentType.CASH,
      discount: undefined,
      notes: undefined,
      items: [{ stockId: stock.id, quantity: 1, salePrice: amount, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
    },
    {
      userId: by,
      permissions: [
        PERMISSIONS.DOMESTIC_SALE_CREATE,
        ...(forStaff ? [PERMISSIONS.DOMESTIC_SALE_READ_ALL] : []),
      ],
    },
  );
}

async function arbSale(createdBy: number, forCustomer: number) {
  const product = await makeProduct(ProductType.ARB);
  const stock = await makeStock(product.id, 20);

  return ArbSaleService.createArbSale(
    {
      customerId: forCustomer,
      paymentType: PaymentType.CASH,
      paidAmount: 0,
      discount: undefined,
      notes: undefined,
      items: [{ stockId: stock.id, quantity: 1, salePrice: 100 }],
    },
    createdBy,
  );
}

describe("sale report scoping", () => {
  // The old routes compared against a role name that never matched, so owners
  // were silently scoped down to their own paperwork.
  it("shows an owner every staff member's sales", async () => {
    await domSale(ownerId);
    await domSale(staffId);

    const report = await ReportService.getSaleReport("DOM", range, owner());

    expect(report.summary.invoiceCount).toBe(2);
    expect(report.pagination.total).toBe(2);
  });

  it("shows staff only their own sales", async () => {
    await domSale(ownerId);
    await domSale(staffId);

    const report = await ReportService.getSaleReport("DOM", range, staff());

    expect(report.summary.invoiceCount).toBe(1);
  });

  it("lets an owner narrow to one staff member", async () => {
    await domSale(ownerId);
    await domSale(staffId);

    const report = await ReportService.getSaleReport(
      "DOM",
      { ...range, staffId },
      owner(),
    );

    expect(report.summary.invoiceCount).toBe(1);
  });

  it("filters by customer", async () => {
    await arbSale(ownerId, customerId);
    await arbSale(ownerId, otherCustomerId);

    const report = await ReportService.getSaleReport(
      "ARB",
      { ...range, customerId },
      owner(),
    );

    expect(report.summary.invoiceCount).toBe(1);
  });

  // The office enters most rounds; the sale is still the field staff's
  it("reports a domestic round under its field staff, not whoever entered it", async () => {
    const office = (await makeUser("Office")).id;
    const fieldStaff = (await makeFieldStaff("Ravi")).id;
    await domSale(office, 700, fieldStaff);

    const forStaff = await ReportService.getSaleReport("DOM", range, {
      userId: fieldStaff,
      permissions: [PERMISSIONS.REPORT_READ_OWN],
    });
    const forOffice = await ReportService.getSaleReport("DOM", range, {
      userId: office,
      permissions: [PERMISSIONS.REPORT_READ_OWN],
    });
    const narrowed = await ReportService.getSaleReport(
      "DOM",
      { ...range, staffId: fieldStaff },
      owner(),
    );

    expect(forStaff.summary.invoiceCount).toBe(1);
    expect(forOffice.summary.invoiceCount).toBe(0);
    expect(narrowed.summary.invoiceCount).toBe(1);
  });

  it("excludes sales outside the date range", async () => {
    await domSale(ownerId);

    const report = await ReportService.getSaleReport(
      "DOM",
      { ...range, from: new Date("2020-01-01"), to: new Date("2020-01-31") },
      owner(),
    );

    expect(report.summary.invoiceCount).toBe(0);
  });

  // The page shows ten rows at a time; the totals must still cover everything.
  it("summarises the whole range, not just the current page", async () => {
    for (let i = 0; i < 3; i++) await domSale(ownerId, 500);

    const report = await ReportService.getSaleReport(
      "DOM",
      { ...range, limit: 1 },
      owner(),
    );

    expect(report.data).toHaveLength(1);
    expect(report.summary.invoiceCount).toBe(3);
    expect(report.summary.totalNetTotal).toBe(1500);
  });

  it("rejects a range that runs backwards", async () => {
    await expect(
      ReportService.getSaleReport(
        "DOM",
        { ...range, from: range.to, to: range.from },
        owner(),
      ),
    ).rejects.toThrow(/must not be after/);
  });
});

// =============================================================================
// PRODUCT WISE
// Opening + Purchase − Sales ± Adjustments = Closing, and for a cylinder the
// closing figure is what the godown holds. History before the range is made by
// backdating rows, since services always stamp "now".
// =============================================================================

const LONG_AGO = () => daysAgo(60);

/** Move every cylinder movement so far to before the range. */
async function backdateCylinderLedger() {
  await prisma.cylinderTransaction.updateMany({ data: { createdAt: LONG_AGO() } });
  await prisma.stockAdjustment.updateMany({ data: { createdAt: LONG_AGO() } });
}

const buyFull = (productId: number, quantity: number, vendorId: number) =>
  PurchaseService.createPurchase(
    {
      invoiceNo: undefined,
      vendorId,
      purchaseDate: daysAgo(3),
      notes: undefined,
      items: [
        {
          productId,
          batchNo: undefined,
          quantity,
          unitCost: 100,
          totalCost: quantity * 100,
          purchaseType: PurchaseType.FULL,
        },
      ],
    },
    ownerId,
  );

const sellArb = (stockId: number, quantity: number, salePrice = 100) =>
  ArbSaleService.createArbSale(
    {
      customerId,
      paymentType: PaymentType.CASH,
      paidAmount: 0,
      discount: undefined,
      notes: undefined,
      items: [{ stockId, quantity, salePrice }],
    },
    ownerId,
  );

const reconciles = (row: {
  openingStock: number;
  purchaseQty: number;
  salesQty: number;
  adjustments: number;
  closingStock: number;
}) =>
  row.openingStock + row.purchaseQty - row.salesQty + row.adjustments ===
  row.closingStock;

describe("product wise report", () => {
  it("reads a cylinder product from the godown ledger", async () => {
    const product = await makeProduct(ProductType.DOMESTIC, { name: "14.2 kg" });
    const vendor = await makeVendor();
    await seedGodown(product.id, { filledQty: 50 });
    await backdateCylinderLedger();

    await buyFull(product.id, 20, vendor.id);
    const stock = await makeStock(product.id, 100);
    await DomSaleService.createDomSale(
      {
        fieldStaffId: undefined,
        paymentType: PaymentType.CASH,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 5, salePrice: 900, saleType: CommercialSaleType.RENT, emptiesCollected: 5 }],
      },
      { userId: ownerId, permissions: [PERMISSIONS.DOMESTIC_SALE_CREATE] },
    );
    await StockAdjustmentService.createStockAdjustment(
      { productId: product.id, filledDelta: -2, emptyDelta: 0, reason: "Count" },
      ownerId,
    );

    const report = await ReportService.getProductWiseReport(range);
    const row = report.data.find((r) => r.productId === product.id)!;

    expect(row).toMatchObject({
      openingStock: 50,
      purchaseQty: 20,
      salesQty: 5,
      adjustments: -2,
      closingStock: 63,
      totalAmount: 4500,
    });
    // The report's closing is the godown, not a separate count
    expect(row.closingStock).toBe((await godownOf(product.id)).filledQty);
  });

  it("walks ARB stock back from today's batches", async () => {
    const product = await makeProduct(ProductType.ARB, { name: "Bulk ARB" });
    const vendor = await makeVendor();

    // Bought before the range
    const earlier = await buyFull(product.id, 30, vendor.id);
    await prisma.purchase.update({
      where: { id: earlier.id },
      data: { createdAt: LONG_AGO() },
    });

    // In the range: bought 20, sold 4, and a batch added by hand
    const purchase = await buyFull(product.id, 20, vendor.id);
    const batch = await prisma.stock.findFirstOrThrow({
      where: { purchaseId: purchase.id },
    });
    await sellArb(batch.id, 4, 250);
    await makeStock(product.id, 10);

    const report = await ReportService.getProductWiseReport(range);
    const row = report.data.find((r) => r.productId === product.id)!;

    expect(row).toMatchObject({
      openingStock: 30,
      purchaseQty: 20,
      salesQty: 4,
      adjustments: 10,
      closingStock: 56,
      totalAmount: 1000,
    });
    const onHand = await prisma.stock.aggregate({
      where: { productId: product.id, isDeleted: false },
      _sum: { quantity: true },
    });
    expect(row.closingStock).toBe(onHand._sum.quantity);
  });

  it("nets out a sale entered and deleted inside the range", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(product.id, { filledQty: 10 });
    await backdateCylinderLedger();
    const stock = await makeStock(product.id, 10);

    const sale = await DomSaleService.createDomSale(
      {
        fieldStaffId: undefined,
        paymentType: PaymentType.CASH,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 3, salePrice: 100, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
      },
      { userId: ownerId, permissions: [PERMISSIONS.DOMESTIC_SALE_CREATE] },
    );
    await DomSaleService.deleteDomSale(sale.id, {
      userId: ownerId,
      permissions: [PERMISSIONS.DOMESTIC_SALE_READ_ALL],
    });

    const report = await ReportService.getProductWiseReport(range);
    const row = report.data.find((r) => r.productId === product.id)!;

    expect(row.salesQty).toBe(0);
    expect(row.totalAmount).toBe(0);
    expect(row.closingStock).toBe(10);
  });

  it("adds up on every row, and the summary sums the rows", async () => {
    const domestic = await makeProduct(ProductType.DOMESTIC);
    const arb = await makeProduct(ProductType.ARB);
    const vendor = await makeVendor();
    await seedGodown(domestic.id, { filledQty: 8 });
    await buyFull(domestic.id, 4, vendor.id);
    await buyFull(arb.id, 6, vendor.id);

    const report = await ReportService.getProductWiseReport(range);

    expect(report.data.every(reconciles)).toBe(true);
    expect(report.summary.purchaseQty).toBe(10);
  });

  it("starts the range at India midnight", async () => {
    await expect(
      ReportService.getProductWiseReport({ from: range.to, to: range.from }),
    ).rejects.toThrow(/must not be after/);
  });
});

// =============================================================================
// CUSTOMER WISE
// Opening + Rented − Taken back = Balance per cylinder size, and
// Opening + Sales − Receipts = Outstanding — checked against the customer's
// own caches, which the rest of the app keeps.
// =============================================================================

describe("customer wise report", () => {
  async function setUpHotel() {
    const kg19 = await makeProduct(ProductType.COMMERCIAL, { name: "19 kg" });
    const kg47 = await makeProduct(ProductType.COMMERCIAL, { name: "47.5 kg" });
    await seedGodown(kg19.id, { filledQty: 100 });
    await seedGodown(kg47.id, { filledQty: 100 });
    const stock19 = await makeStock(kg19.id, 100);
    const stock47 = await makeStock(kg47.id, 100);

    // Onboarded owing 1000 and holding three 19 kg cylinders
    const hotel = await CustomerService.createCustomer(
      {
        name: "Beach Hotel",
        initialPendingAmount: 1000,
        initialCylinderBalances: [{ productId: kg19.id, qty: 3 }],
      } as never,
      ownerId,
    );

    // Before the range: 5 rented at 1000, unpaid
    const earlier = await CommercialSaleService.createCommercialSale(
      {
        customerId: hotel.id,
        invoiceDate: LONG_AGO(),
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock19.id, saleType: CommercialSaleType.RENT, quantity: 5, salePrice: 1000 }],
        returns: [],
      },
      ownerId,
    );
    await prisma.commercialSale.update({
      where: { id: earlier.id },
      data: { createdAt: LONG_AGO() },
    });
    await prisma.customerPaymentLedger.updateMany({
      where: { entryType: { not: "OPENING" } },
      data: { createdAt: LONG_AGO() },
    });

    // In the range: 4 rented and 1 sold outright, 2 empties collected on the
    // invoice, 2000 paid by cheque; one 47.5 kg rented
    await CommercialSaleService.createCommercialSale(
      {
        customerId: hotel.id,
        invoiceDate: daysAgo(2),
        paymentType: PaymentType.CHEQUE,
        paidAmount: 2000,
        discount: undefined,
        notes: undefined,
        items: [
          { stockId: stock19.id, saleType: CommercialSaleType.RENT, quantity: 4, salePrice: 1000 },
          { stockId: stock19.id, saleType: CommercialSaleType.SALE, quantity: 1, salePrice: 1000 },
          { stockId: stock47.id, saleType: CommercialSaleType.RENT, quantity: 1, salePrice: 3000 },
        ],
        returns: [{ productId: kg19.id, quantity: 2 }],
      },
      ownerId,
    );

    // A return recorded against the earlier invoice's line
    const earlierLine = await prisma.commercialSaleItem.findFirstOrThrow({
      where: { commercialSaleId: earlier.id },
    });
    await CommercialSaleService.returnCylinders(
      earlier.id,
      { items: [{ itemId: earlierLine.id, returnQty: 1 }] },
      ownerId,
    );

    // And 500 in cash at the counter
    await CustomerTxnService.recordPayment(
      hotel.id,
      { amount: 500, paymentMethod: PaymentType.CASH, notes: undefined },
      ownerId,
    );

    return { hotel, kg19, kg47 };
  }

  it("rebuilds each cylinder size and agrees with what the customer holds today", async () => {
    const { hotel, kg19, kg47 } = await setUpHotel();

    const report = await ReportService.getCustomerWiseReport(range);
    const row = report.data.find((r) => r.customerId === hotel.id)!;
    const size = (id: number) => row.products.find((p) => p.productId === id)!;

    expect(size(kg19.id)).toMatchObject({
      openingEmpty: 8, // 3 at onboarding + 5 rented before the range
      rentedQty: 4,
      soldQty: 1,
      emptyBack: 3, // 2 on the invoice + 1 against the old line
      balanceEmpty: 9,
    });
    expect(size(kg47.id)).toMatchObject({ openingEmpty: 0, rentedQty: 1, balanceEmpty: 1 });
    expect(row.balanceEmpty).toBe(10);

    expect(size(kg19.id).balanceEmpty).toBe(await custodyOf(hotel.id, kg19.id));
    expect(size(kg47.id).balanceEmpty).toBe(await custodyOf(hotel.id, kg47.id));
  });

  it("reports money from the ledger and agrees with the customer's balance", async () => {
    const { hotel } = await setUpHotel();

    const report = await ReportService.getCustomerWiseReport(range);
    const row = report.data.find((r) => r.customerId === hotel.id)!;

    expect(row).toMatchObject({
      openingBalance: 6000, // 1000 at onboarding + 5000 unpaid before the range
      salesAmount: 8000, // 4 + 1 at 1000, and 3000
      receipts: 2500,
      outstanding: 11500,
    });
    expect(row.receiptTypes).toEqual(["CASH", "CHEQUE"]);
    expect(row.outstanding).toBe(await balanceOf(hotel.id));
  });

  it("records how every payment was received", async () => {
    const { hotel } = await setUpHotel();

    const payments = await prisma.customerPaymentLedger.findMany({
      where: { customerId: hotel.id, entryType: "PAYMENT" },
      orderBy: { id: "asc" },
    });

    expect(payments.map((p) => p.paymentMethod)).toEqual([
      PaymentType.CHEQUE,
      PaymentType.CASH,
    ]);
  });

  it("filters to one customer and pages the rest", async () => {
    const { hotel } = await setUpHotel();
    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: (await makeStock((await makeProduct(ProductType.ARB)).id, 5)).id, quantity: 1, salePrice: 100 }],
      },
      ownerId,
    );

    const one = await ReportService.getCustomerWiseReport({
      ...range,
      customerId: hotel.id,
    });
    expect(one.data.map((r) => r.customerId)).toEqual([hotel.id]);

    const firstPage = await ReportService.getCustomerWiseReport({ ...range, limit: 1 });
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.pagination.total).toBe(2);
    expect(firstPage.summary.customerCount).toBe(2);
  });
});

describe("purchase report", () => {
  it("totals purchase cost and filters by vendor", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    const vendorA = await makeVendor();
    const vendorB = await makeVendor();

    const buy = (vendorId: number, totalCost: number) =>
      PurchaseService.createPurchase(
        {
          invoiceNo: undefined,
          vendorId,
          purchaseDate: daysAgo(3),
          notes: undefined,
          items: [
            {
              productId: product.id,
              batchNo: undefined,
              quantity: 1,
              unitCost: totalCost,
              totalCost,
              purchaseType: PurchaseType.FULL,
            },
          ],
        },
        ownerId,
      );

    await buy(vendorA.id, 1000);
    await buy(vendorB.id, 250);

    const all = await ReportService.getPurchaseReport(range, owner());
    expect(all.summary.invoiceCount).toBe(2);
    expect(all.summary.totalAmount).toBe(1250);

    const onlyA = await ReportService.getPurchaseReport(
      { ...range, vendorId: vendorA.id },
      owner(),
    );
    expect(onlyA.summary.totalAmount).toBe(1000);
  });
});

describe("expense report", () => {
  it("scopes to the actor the same way the expense list does", async () => {
    await ExpenseService.createExpense(
      { expense: "Owner fuel", date: daysAgo(5), amount: 300 },
      ownerId,
    );
    await ExpenseService.createExpense(
      { expense: "Staff fuel", date: daysAgo(4), amount: 200 },
      staffId,
    );

    const forOwner = await ReportService.getExpenseReport(range, owner());
    expect(forOwner.summary.expenseCount).toBe(2);
    expect(forOwner.summary.totalAmount).toBe(500);

    const forStaff = await ReportService.getExpenseReport(range, staff());
    expect(forStaff.summary.expenseCount).toBe(1);
    expect(forStaff.summary.totalAmount).toBe(200);
  });
});

describe("profit report", () => {
  const profitRange = { from: daysAgo(30), to: today };

  /** A commercial invoice of two items with a ₹100 discount; costs 800 and 500. */
  async function commercialInvoice() {
    const cyl19 = await makeProduct(ProductType.COMMERCIAL, { name: "19 kg" });
    const cyl47 = await makeProduct(ProductType.COMMERCIAL, { name: "47.5 kg" });
    await seedGodown(cyl19.id, { filledQty: 10 });
    await seedGodown(cyl47.id, { filledQty: 10 });
    const stock19 = await makeStock(cyl19.id, 10); // costs 800 a unit
    const stock47 = await makeStock(cyl47.id, 10);
    await prisma.stock.update({
      where: { id: stock47.id },
      data: { productCost: 500 },
    });

    await CommercialSaleService.createCommercialSale(
      {
        customerId,
        invoiceDate: today,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: 100,
        notes: undefined,
        items: [
          { stockId: stock19.id, saleType: CommercialSaleType.SALE, quantity: 2, salePrice: 1000 },
          { stockId: stock47.id, saleType: CommercialSaleType.RENT, quantity: 1, salePrice: 1000 },
        ],
        returns: [],
      },
      ownerId,
    );
    return { cyl19, cyl47 };
  }

  it("totals each category, and lists all three even with no sales", async () => {
    await commercialInvoice(); // 3000 − 100 = 2900, cost 2100
    await domSale(ownerId, 1000); // cost 800
    await arbSale(ownerId, customerId); // 100, cost 800: a loss

    const report = await ReportService.getProfitReport({
      ...profitRange,
      view: "category",
    });

    expect(
      report.data.map((r) => [r.categoryLabel, r.invoiceCount, r.qty, r.sales, r.cost, r.profit]),
    ).toEqual([
      ["Commercial", 1, 3, 2900, 2100, 800],
      ["Domestic", 1, 1, 1000, 800, 200],
      ["ARB", 1, 1, 100, 800, -700],
    ]);
    expect(report.summary).toMatchObject({
      invoiceCount: 3,
      sales: 4000,
      cost: 3700,
      grossProfit: 300,
      margin: 7.5,
    });
  });

  it("shares an invoice's discount over its items, so items sum to the invoice", async () => {
    const { cyl19, cyl47 } = await commercialInvoice();

    const report = await ReportService.getProfitReport({
      ...profitRange,
      view: "item",
    });

    // 2900 split 2000 : 1000
    expect(report.data.map((r) => [r.productId, r.qty, r.sales, r.cost, r.profit])).toEqual([
      [cyl19.id, 2, 1933.33, 1600, 333.33],
      [cyl47.id, 1, 966.67, 500, 466.67],
    ]);
    const sale = await prisma.commercialSale.findFirstOrThrow();
    expect(report.summary.sales).toBe(Number(sale.totalAmount));
  });

  it("takes expenses off for net profit, only across every category", async () => {
    await domSale(ownerId, 1000);
    await ExpenseService.createExpense(
      { expense: "Fuel", date: daysAgo(2), amount: 150 },
      staffId,
    );

    const all = await ReportService.getProfitReport({ ...profitRange, view: "category" });
    expect(all.summary.expenses).toBe(150);
    expect(all.summary.netProfit).toBe(50); // 200 gross − 150

    const domestic = await ReportService.getProfitReport({
      ...profitRange,
      view: "item",
      category: "DOMESTIC",
    });
    expect(domestic.data.every((r) => r.category === "DOMESTIC")).toBe(true);
    expect(domestic.summary.expenses).toBeNull();
    expect(domestic.summary.netProfit).toBeNull();
  });

  it("flags a sale from a batch with no cost instead of hiding it", async () => {
    const product = await makeProduct(ProductType.ARB);
    const stock = await makeStock(product.id, 5);
    await prisma.stock.update({ where: { id: stock.id }, data: { productCost: null } });
    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: stock.id, quantity: 2, salePrice: 50 }],
      },
      ownerId,
    );

    const report = await ReportService.getProfitReport({ ...profitRange, view: "item" });
    expect(report.data[0]).toMatchObject({ cost: 0, profit: 100, uncostedQty: 2 });
    expect(report.summary.uncostedQty).toBe(2);
  });

  it("leaves out deleted sales and sales outside the range", async () => {
    const deleted = await arbSale(ownerId, customerId);
    await ArbSaleService.deleteArbSale(deleted.id, ownerId);
    const old = await arbSale(ownerId, customerId);
    await prisma.arbSale.update({ where: { id: old.id }, data: { createdAt: daysAgo(60) } });

    const report = await ReportService.getProfitReport({ ...profitRange, view: "category" });
    expect(report.summary.invoiceCount).toBe(0);
    expect(report.summary.sales).toBe(0);
  });
});
