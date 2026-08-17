import { beforeEach, describe, expect, it } from "vitest";
import {
  CommercialSaleType,
  PaymentType,
  ProductType,
  PurchaseType,
} from "@/generated/client";
import { PERMISSIONS } from "@/lib/permissions";
import {
  makeCustomer,
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

const range = {
  from: new Date("2026-08-01"),
  to: new Date("2026-08-31"),
  page: 1,
  limit: 10,
};

beforeEach(async () => {
  ownerId = (await makeUser("Owner")).id;
  staffId = (await makeUser("Staff")).id;
  customerId = (await makeCustomer({ name: "Customer A" })).id;
  otherCustomerId = (await makeCustomer({ name: "Customer B" })).id;
});

async function domSale(
  createdBy: number,
  forCustomer: number,
  amount = 1000,
) {
  const product = await makeProduct(ProductType.DOMESTIC);
  await seedGodown(product.id, { filledQty: 20 });
  const stock = await makeStock(product.id, 20);

  return DomSaleService.createDomSale(
    {
      customerId: forCustomer,
      paymentType: PaymentType.CASH,
      paidAmount: 0,
      discount: undefined,
      notes: undefined,
      items: [{ stockId: stock.id, quantity: 1, salePrice: amount }],
    },
    createdBy,
  );
}

describe("sale report scoping", () => {
  // The old routes compared against a role name that never matched, so owners
  // were silently scoped down to their own paperwork.
  it("shows an owner every staff member's sales", async () => {
    await domSale(ownerId, customerId);
    await domSale(staffId, customerId);

    const report = await ReportService.getSaleReport("DOM", range, owner());

    expect(report.summary.invoiceCount).toBe(2);
    expect(report.pagination.total).toBe(2);
  });

  it("shows staff only their own sales", async () => {
    await domSale(ownerId, customerId);
    await domSale(staffId, customerId);

    const report = await ReportService.getSaleReport("DOM", range, staff());

    expect(report.summary.invoiceCount).toBe(1);
  });

  it("lets an owner narrow to one staff member", async () => {
    await domSale(ownerId, customerId);
    await domSale(staffId, customerId);

    const report = await ReportService.getSaleReport(
      "DOM",
      { ...range, staffId },
      owner(),
    );

    expect(report.summary.invoiceCount).toBe(1);
  });

  it("filters by customer", async () => {
    await domSale(ownerId, customerId);
    await domSale(ownerId, otherCustomerId);

    const report = await ReportService.getSaleReport(
      "DOM",
      { ...range, customerId },
      owner(),
    );

    expect(report.summary.invoiceCount).toBe(1);
  });

  it("excludes sales outside the date range", async () => {
    await domSale(ownerId, customerId);

    const report = await ReportService.getSaleReport(
      "DOM",
      { ...range, from: new Date("2020-01-01"), to: new Date("2020-01-31") },
      owner(),
    );

    expect(report.summary.invoiceCount).toBe(0);
  });

  // The page shows ten rows at a time; the totals must still cover everything.
  it("summarises the whole range, not just the current page", async () => {
    for (let i = 0; i < 3; i++) await domSale(ownerId, customerId, 500);

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
        { ...range, from: new Date("2026-08-31"), to: new Date("2026-08-01") },
        owner(),
      ),
    ).rejects.toThrow(/must not be after/);
  });
});

describe("sale-by-product report", () => {
  // Line items carry the product, not the invoice header, and all three sale
  // models have to roll up together.
  it("rolls up domestic, ARB and commercial lines per product", async () => {
    const domestic = await makeProduct(ProductType.DOMESTIC, {
      name: "Domestic 14.2",
    });
    const arb = await makeProduct(ProductType.ARB, { name: "Bulk ARB" });
    const commercial = await makeProduct(ProductType.COMMERCIAL, {
      name: "Commercial 19",
    });

    await seedGodown(domestic.id, { filledQty: 50 });
    await seedGodown(commercial.id, { filledQty: 50 });

    const domStock = await makeStock(domestic.id, 50);
    const arbStock = await makeStock(arb.id, 50);
    const comStock = await makeStock(commercial.id, 50);

    await DomSaleService.createDomSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: domStock.id, quantity: 2, salePrice: 100 }],
      },
      ownerId,
    );

    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: arbStock.id, quantity: 3, salePrice: 100 }],
      },
      ownerId,
    );

    await CommercialSaleService.createCommercialSale(
      {
        customerId,
        invoiceDate: new Date("2026-08-14"),
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [
          {
            stockId: comStock.id,
            saleType: CommercialSaleType.RENT,
            quantity: 4,
            salePrice: 100,
          },
        ],
      },
      ownerId,
    );

    const report = await ReportService.getSaleByProductReport(
      { from: range.from, to: range.to },
      owner(),
    );

    const byName = Object.fromEntries(
      report.data.map((row) => [row.productName, row]),
    );

    expect(byName["Domestic 14.2"].totalQuantity).toBe(2);
    expect(byName["Bulk ARB"].totalQuantity).toBe(3);
    expect(byName["Commercial 19"].totalQuantity).toBe(4);

    expect(report.summary.totalQuantity).toBe(9);
    expect(report.summary.totalAmount).toBe(900);
    // Rented cylinders are billed revenue, but they are expected back
    expect(report.summary.rentedQuantity).toBe(4);
  });

  it("sorts by revenue, biggest first", async () => {
    const small = await makeProduct(ProductType.ARB, { name: "Small" });
    const big = await makeProduct(ProductType.ARB, { name: "Big" });
    const smallStock = await makeStock(small.id, 50);
    const bigStock = await makeStock(big.id, 50);

    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: smallStock.id, quantity: 1, salePrice: 100 }],
      },
      ownerId,
    );
    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [{ stockId: bigStock.id, quantity: 1, salePrice: 900 }],
      },
      ownerId,
    );

    const report = await ReportService.getSaleByProductReport(
      { from: range.from, to: range.to },
      owner(),
    );

    expect(report.data.map((r) => r.productName)).toEqual(["Big", "Small"]);
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
          purchaseDate: new Date("2026-08-14"),
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
      { expense: "Owner fuel", date: new Date("2026-08-10"), amount: 300 },
      ownerId,
    );
    await ExpenseService.createExpense(
      { expense: "Staff fuel", date: new Date("2026-08-11"), amount: 200 },
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
