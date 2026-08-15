import { beforeEach, describe, expect, it } from "vitest";
import { PaymentType, ProductType } from "@/generated/client";
import { ROLES } from "@/lib/permissions";
import {
  makeCustomer,
  makeProduct,
  makeStock,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as DashboardService from "./dashboard.service";
import * as DomSaleService from "@/module/dom-sale/dom-sale.service";
import * as ExpenseService from "@/module/expense/expense.service";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";

let ownerId: number;
let staffId: number;
let customerId: number;

const owner = () => ({ userId: ownerId, roles: [ROLES.OWNER] });
const staff = () => ({ userId: staffId, roles: [ROLES.OFFICE_STAFF] });

// The dashboard defaults to the last 30 days, so tests use today's date
const today = new Date();
const range = {
  from: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
  to: today,
};

beforeEach(async () => {
  ownerId = (await makeUser("Owner")).id;
  staffId = (await makeUser("Staff")).id;
  customerId = (await makeCustomer()).id;
});

async function sell(createdBy: number, salePrice: number, quantity = 1) {
  const product = await makeProduct(ProductType.DOMESTIC);
  await seedGodown(product.id, { filledQty: 100 });
  const stock = await makeStock(product.id, 100);

  return DomSaleService.createDomSale(
    {
      customerId,
      paymentType: PaymentType.CASH,
      paidAmount: 0,
      discount: undefined,
      notes: undefined,
      items: [{ stockId: stock.id, quantity, salePrice }],
    },
    createdBy,
  );
}

describe("KPIs", () => {
  it("totals revenue, quantity and invoice counts", async () => {
    await sell(ownerId, 500, 2);
    await sell(ownerId, 300, 1);

    const data = await DashboardService.getDashboard(range, owner());

    expect(data.kpis.totalRevenue).toBe(1300);
    expect(data.kpis.totalQtySold).toBe(3);
    expect(data.kpis.domSaleCount).toBe(2);
    expect(data.kpis.arbSaleCount).toBe(0);
    expect(data.kpis.newComSaleCount).toBe(0);
  });

  it("subtracts cost of goods and expenses from profit", async () => {
    // makeStock sets productCost 800, so 1 sold at 1000 is 200 gross
    await sell(ownerId, 1000, 1);
    await ExpenseService.createExpense(
      { expense: "Fuel", date: today, amount: 50 },
      ownerId,
    );

    const data = await DashboardService.getDashboard(range, owner());

    expect(data.kpis.totalRevenue).toBe(1000);
    expect(data.kpis.totalExpenses).toBe(50);
    expect(data.kpis.totalProfit).toBe(150);
  });

  it("counts collections from the payment ledger", async () => {
    await sell(ownerId, 1000, 1);
    await CustomerTxnService.recordPayment(
      customerId,
      { amount: 400, paymentMethod: PaymentType.CASH, notes: undefined },
      ownerId,
    );

    const data = await DashboardService.getDashboard(range, owner());

    // Standalone payments count; the sale itself was unpaid
    expect(data.kpis.totalCollections).toBe(400);
  });

  it("counts customers", async () => {
    const data = await DashboardService.getDashboard(range, owner());
    expect(data.kpis.customerCount).toBe(1);
  });
});

describe("staff scoping", () => {
  it("shows staff only their own sales", async () => {
    await sell(ownerId, 1000, 1);
    await sell(staffId, 250, 1);

    const forOwner = await DashboardService.getDashboard(range, owner());
    const forStaff = await DashboardService.getDashboard(range, staff());

    expect(forOwner.kpis.totalRevenue).toBe(1250);
    expect(forStaff.kpis.totalRevenue).toBe(250);
    expect(forStaff.kpis.domSaleCount).toBe(1);
  });

  // Collections is the one money card staff still see, so it must not show
  // them the agency's whole intake.
  it("shows staff only the collections they recorded", async () => {
    await sell(ownerId, 1000, 1);
    await CustomerTxnService.recordPayment(
      customerId,
      { amount: 500, paymentMethod: PaymentType.CASH, notes: undefined },
      ownerId,
    );
    await CustomerTxnService.recordPayment(
      customerId,
      { amount: 200, paymentMethod: PaymentType.CASH, notes: undefined },
      staffId,
    );

    const forOwner = await DashboardService.getDashboard(range, owner());
    const forStaff = await DashboardService.getDashboard(range, staff());

    expect(forOwner.kpis.totalCollections).toBe(700);
    expect(forStaff.kpis.totalCollections).toBe(200);
  });

  it("reports the role back to the client", async () => {
    const forOwner = await DashboardService.getDashboard(range, owner());
    const forStaff = await DashboardService.getDashboard(range, staff());

    expect(forOwner.role).toBe(ROLES.OWNER);
    expect(forStaff.role).toBe(ROLES.OFFICE_STAFF);
  });
});

describe("breakdowns", () => {
  it("splits revenue per product and gives each a colour", async () => {
    await sell(ownerId, 900, 1);
    await sell(ownerId, 100, 1);

    const data = await DashboardService.getDashboard(range, owner());

    expect(data.productBreakdown).toHaveLength(2);
    // Sorted by revenue, biggest first
    expect(data.productBreakdown[0].revenue).toBe(900);
    expect(data.productBreakdown[0].fill).toBeTruthy();
    expect(
      data.productBreakdown.reduce((sum, p) => sum + p.revenue, 0),
    ).toBe(1000);
  });

  it("lists recent transactions newest first", async () => {
    await sell(ownerId, 100, 1);
    await sell(ownerId, 200, 1);

    const data = await DashboardService.getDashboard(range, owner());

    expect(data.recentTxns).toHaveLength(2);
    expect(data.recentTxns[0].amount).toBe(200);
    expect(data.recentTxns[0].type).toBe("Domestic");
  });

  it("flags batches at or below the low-stock threshold", async () => {
    const product = await makeProduct(ProductType.DOMESTIC);
    await makeStock(product.id, 3);
    await makeStock(product.id, 500);

    const data = await DashboardService.getDashboard(range, owner());

    expect(data.lowStock).toHaveLength(1);
    expect(data.lowStock[0].quantity).toBe(3);
  });

  it("gives the trend one bucket per day in the range", async () => {
    const data = await DashboardService.getDashboard(range, owner());

    // Seven days back plus today
    expect(data.dailyTrend).toHaveLength(8);
    expect(data.dailyTrend.every((d) => typeof d.date === "string")).toBe(true);
  });
});

describe("commercial alerts", () => {
  it("lists customers carrying a balance, biggest first", async () => {
    const other = await makeCustomer({ name: "Big Debtor" });

    await sell(ownerId, 100, 1);
    await CustomerTxnService.recordPayment(
      other.id,
      { amount: 0.01, paymentMethod: PaymentType.CASH, notes: undefined },
      ownerId,
    );
    // Put a real debt on the second customer
    await DomSaleService.createDomSale(
      {
        customerId: other.id,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [
          {
            stockId: (await makeStock((await makeProduct(ProductType.ARB)).id, 10))
              .id,
            quantity: 1,
            salePrice: 5000,
          },
        ],
      },
      ownerId,
    );

    const data = await DashboardService.getDashboard(range, owner());
    const names = data.commercialAnalytics.highBalanceCustomers.map(
      (c) => c.name,
    );

    expect(names[0]).toBe("Big Debtor");
    expect(
      data.commercialAnalytics.highBalanceCustomers[0].pendingAmount,
    ).toBeGreaterThan(100);
  });
});
