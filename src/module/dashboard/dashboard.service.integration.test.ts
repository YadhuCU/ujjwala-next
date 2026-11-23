import { beforeEach, describe, expect, it } from "vitest";
import {
  CommercialSaleType,
  PaymentType,
  ProductType,
} from "@/generated/client";
import { PERMISSIONS } from "@/lib/permissions";
import { businessDayKey } from "@/lib/business-day";
import { prisma } from "@/lib/prisma";
import {
  makeCustomer,
  makeFieldStaff,
  makeProduct,
  makeStock,
  makeUser,
  seedGodown,
} from "@/test/factories";
import * as DashboardService from "./dashboard.service";
import * as DomSaleService from "@/module/dom-sale/dom-sale.service";
import * as ArbSaleService from "@/module/arb-sale/arb-sale.service";
import * as ExpenseService from "@/module/expense/expense.service";
import * as CustomerTxnService from "@/module/customer-txn/customer-txn.service";

let ownerId: number;
let staffId: number;
let customerId: number;

// Every card, as a role set up to see the whole dashboard would hold
const ALL_CARDS = [
  PERMISSIONS.DASHBOARD_CYLINDER_POSITION,
  PERMISSIONS.DASHBOARD_KPIS,
  PERMISSIONS.DASHBOARD_REVENUE_TREND,
  PERMISSIONS.DASHBOARD_SALES_BY_TYPE,
  PERMISSIONS.DASHBOARD_PRODUCT_BREAKDOWN,
  PERMISSIONS.DASHBOARD_LOW_STOCK,
  PERMISSIONS.DASHBOARD_COMMERCIAL_ALERTS,
];

const owner = () => ({
  userId: ownerId,
  permissions: [
    PERMISSIONS.DASHBOARD_READ_ALL,
    PERMISSIONS.DASHBOARD_FINANCIALS,
    ...ALL_CARDS,
  ],
});
const staff = () => ({
  userId: staffId,
  permissions: [PERMISSIONS.DASHBOARD_READ_OWN, ...ALL_CARDS],
});

// Rows are stamped "now", so the range is relative to today, never pinned
const today = new Date();
const range = {
  view: "day" as const,
  from: businessDayKey(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
  to: businessDayKey(today),
};

beforeEach(async () => {
  ownerId = (await makeUser("Owner")).id;
  staffId = (await makeUser("Staff")).id;
  customerId = (await makeCustomer()).id;
});

/**
 * A domestic round — paid in full at the door. With `forStaff` the office
 * enters it on that field staff member's behalf.
 */
async function sell(
  createdBy: number,
  salePrice: number,
  quantity = 1,
  forStaff?: number,
) {
  const product = await makeProduct(ProductType.DOMESTIC);
  await seedGodown(product.id, { filledQty: 100 });
  const stock = await makeStock(product.id, 100);

  return DomSaleService.createDomSale(
    {
      fieldStaffId: forStaff,
      paymentType: PaymentType.CASH,
      discount: undefined,
      notes: undefined,
      items: [{ stockId: stock.id, quantity, salePrice, saleType: CommercialSaleType.SALE, emptiesCollected: 0 }],
    },
    {
      userId: createdBy,
      permissions: [
        PERMISSIONS.DOMESTIC_SALE_CREATE,
        ...(forStaff ? [PERMISSIONS.DOMESTIC_SALE_READ_ALL] : []),
      ],
    },
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

  it("counts collections from the payment ledger and from domestic rounds", async () => {
    await sell(ownerId, 1000, 1);
    await CustomerTxnService.recordPayment(
      customerId,
      { amount: 400, paymentMethod: PaymentType.CASH, notes: undefined },
      ownerId,
    );

    const data = await DashboardService.getDashboard(range, owner());

    // A domestic round is paid in full at the door but never touches the
    // money ledger, so its 1000 is added to the standalone payment
    expect(data.kpis.totalCollections).toBe(1400);
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

    // The owner's 1000 domestic round is cash they collected too
    expect(forOwner.kpis.totalCollections).toBe(1700);
    expect(forStaff.kpis.totalCollections).toBe(200);
  });

  // The client used to receive a role name and compare it to "OWNER", which
  // meant a new role could never be shown agency-wide figures.
  it("reports scope and financial visibility, not a role name", async () => {
    const forOwner = await DashboardService.getDashboard(range, owner());
    const forStaff = await DashboardService.getDashboard(range, staff());

    expect(forOwner.scope).toBe("all");
    expect(forOwner.canSeeFinancials).toBe(true);

    expect(forStaff.scope).toBe("own");
    expect(forStaff.canSeeFinancials).toBe(false);
  });

  // The office enters most rounds; the figures are the field staff's
  it("counts a domestic round under its field staff, not whoever entered it", async () => {
    const fieldStaffId = (await makeFieldStaff("Ravi")).id;
    await sell(ownerId, 600, 1, fieldStaffId);

    const forFieldStaff = await DashboardService.getDashboard(range, {
      userId: fieldStaffId,
      permissions: [PERMISSIONS.DASHBOARD_READ_OWN, ...ALL_CARDS],
    });
    const forOffice = await DashboardService.getDashboard(range, staff());

    expect(forFieldStaff.kpis.totalRevenue).toBe(600);
    expect(forFieldStaff.kpis.domSaleCount).toBe(1);
    expect(forOffice.kpis.domSaleCount).toBe(0);
  });

  it("shows money totals to any role granted them, agency-wide or not", async () => {
    const result = await DashboardService.getDashboard(range, {
      userId: staffId,
      permissions: [
        PERMISSIONS.DASHBOARD_READ_OWN,
        PERMISSIONS.DASHBOARD_FINANCIALS,
        ...ALL_CARDS,
      ],
    });

    expect(result.scope).toBe("own");
    expect(result.canSeeFinancials).toBe(true);
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
    expect(data.trend).toHaveLength(8);
    expect(data.trend.every((d) => typeof d.date === "string")).toBe(true);
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
    await ArbSaleService.createArbSale(
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

    const alerts = await DashboardService.getCommercialAlerts();
    const names = alerts.highBalanceCustomers.map((c) => c.name);

    expect(names[0]).toBe("Big Debtor");
    expect(alerts.highBalanceCustomers[0].pendingAmount).toBeGreaterThan(100);
  });
});

// =============================================================================
// DAY BOUNDARIES
// The server runs in UTC on Vercel, five and a half hours behind India. Day
// boundaries used to follow the server's clock, so a sale at 02:00 in Kochi
// counted as the previous day.
// =============================================================================

describe("day boundaries follow India time, not the server's", () => {
  const originalTz = process.env.TZ;

  it("puts a 02:00 IST sale on the Indian day when the server is on UTC", async () => {
    process.env.TZ = "UTC";
    try {
      const sale = await sell(ownerId, 450, 1);
      // 29 Sep 02:00 in India — still 28 Sep in UTC
      await prisma.domSale.update({
        where: { id: sale.id },
        data: { createdAt: new Date("2026-09-28T20:30:00.000Z") },
      });

      const the29th = await DashboardService.getDashboard(
        { view: "day", from: "2026-09-29", to: "2026-09-29" },
        owner(),
      );
      const the28th = await DashboardService.getDashboard(
        { view: "day", from: "2026-09-28", to: "2026-09-28" },
        owner(),
      );

      expect(the29th.kpis.totalRevenue).toBe(450);
      expect(the28th.kpis.totalRevenue).toBe(0);

      const bucket = the29th.trend.find((d) => d.date === "2026-09-29");
      expect(bucket?.revenue).toBe(450);
    } finally {
      process.env.TZ = originalTz;
    }
  });

  it("includes the whole of the last day in the range", async () => {
    process.env.TZ = "UTC";
    try {
      const sale = await sell(ownerId, 200, 1);
      // 29 Sep 23:30 in India
      await prisma.domSale.update({
        where: { id: sale.id },
        data: { createdAt: new Date("2026-09-29T18:00:00.000Z") },
      });

      const data = await DashboardService.getDashboard(
        { view: "day", from: "2026-09-29", to: "2026-09-29" },
        owner(),
      );

      expect(data.kpis.totalRevenue).toBe(200);
    } finally {
      process.env.TZ = originalTz;
    }
  });
});

// =============================================================================
// PERIODS
// The view decides both the range and the size of every chart bucket.
// =============================================================================

describe("periods", () => {
  it("opens on the month view: twelve whole months ending this one", async () => {
    const data = await DashboardService.getDashboard({}, owner());

    expect(data.period.view).toBe("month");
    expect(data.trend).toHaveLength(12);
    expect(data.trend.at(-1)?.date).toBe(businessDayKey(today).slice(0, 7));
    expect(data.period.currentLabel).toBe("This month");
  });

  it("puts a sale in its month and calls this month's revenue out", async () => {
    await sell(ownerId, 700, 1);

    const data = await DashboardService.getDashboard({ view: "month" }, owner());
    const thisMonth = businessDayKey(today).slice(0, 7);

    expect(data.trend.find((b) => b.date === thisMonth)?.revenue).toBe(700);
    expect(data.kpis.currentRevenue).toBe(700);
  });

  it("sums whole years in the year view", async () => {
    await sell(ownerId, 300, 1);
    const sale = await sell(ownerId, 200, 1);
    // Mid-June two years back
    const year = Number(businessDayKey(today).slice(0, 4)) - 2;
    await prisma.domSale.update({
      where: { id: sale.id },
      data: { createdAt: new Date(`${year}-06-15T06:00:00.000Z`) },
    });

    const data = await DashboardService.getDashboard({ view: "year" }, owner());

    expect(data.trend).toHaveLength(5);
    expect(data.trend.find((b) => b.date === String(year))?.revenue).toBe(200);
    expect(data.kpis.totalRevenue).toBe(500);
    expect(data.kpis.currentRevenue).toBe(300);
  });
});

// =============================================================================
// CARD PERMISSIONS
// Each card is its own grant, and the server holds back the data of a card the
// actor cannot see — hiding it in the browser alone would not be a boundary.
// =============================================================================

describe("card permissions", () => {
  it("serves only the cards granted", async () => {
    await sell(ownerId, 900, 1);
    const product = await makeProduct(ProductType.DOMESTIC);
    await makeStock(product.id, 2);

    const data = await DashboardService.getDashboard(range, {
      userId: ownerId,
      permissions: [
        PERMISSIONS.DASHBOARD_READ_ALL,
        PERMISSIONS.DASHBOARD_FINANCIALS,
        PERMISSIONS.DASHBOARD_CYLINDER_POSITION,
      ],
    });

    expect(data.cards.cylinderPosition).toBe(true);
    expect(data.cards.kpis).toBe(false);
    expect(data.cards.lowStock).toBe(false);
    expect(data.lowStock).toEqual([]);
    expect(data.trend).toEqual([]);
    expect(data.productBreakdown).toEqual([]);
  });

  it("needs the money grant as well for revenue by product", async () => {
    const data = await DashboardService.getDashboard(range, {
      userId: staffId,
      permissions: [
        PERMISSIONS.DASHBOARD_READ_OWN,
        PERMISSIONS.DASHBOARD_PRODUCT_BREAKDOWN,
      ],
    });

    expect(data.cards.productBreakdown).toBe(false);
  });

  it("shows a system role every card", async () => {
    const data = await DashboardService.getDashboard(range, {
      userId: ownerId,
      permissions: [],
      isOwner: true,
    });

    expect(Object.values(data.cards).every(Boolean)).toBe(true);
  });
});

describe("cylinder position", () => {
  it("counts commercial cylinders only", async () => {
    const commercial = await makeProduct(ProductType.COMMERCIAL);
    const domestic = await makeProduct(ProductType.DOMESTIC);
    await seedGodown(commercial.id, { filledQty: 12, emptyQty: 3 });
    await seedGodown(domestic.id, { filledQty: 40 });

    const position = await DashboardService.getCylinderPosition();

    expect(position.rows.map((r) => r.productId)).toEqual([commercial.id]);
    expect(position.totals.filledQty).toBe(12);
    expect(position.totals.emptyQty).toBe(3);
  });
});

describe("alert thresholds", () => {
  it("lists a balance only once its last payment is older than the chosen days", async () => {
    await ArbSaleService.createArbSale(
      {
        customerId,
        paymentType: PaymentType.CASH,
        paidAmount: 0,
        discount: undefined,
        notes: undefined,
        items: [
          {
            stockId: (await makeStock((await makeProduct(ProductType.ARB)).id, 10)).id,
            quantity: 1,
            salePrice: 1000,
          },
        ],
      },
      ownerId,
    );
    await CustomerTxnService.recordPayment(
      customerId,
      { amount: 100, paymentMethod: PaymentType.CASH, notes: undefined },
      ownerId,
    );
    // The last payment was ten days ago
    await prisma.customerPaymentLedger.updateMany({
      where: { customerId, entryType: "PAYMENT" },
      data: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
    });

    const at30 = await DashboardService.getCommercialAlerts({ paymentDays: 30 });
    const at7 = await DashboardService.getCommercialAlerts({ paymentDays: 7 });

    expect(at30.pendingPaymentLong).toHaveLength(0);
    expect(at7.pendingPaymentLong.map((r) => r.id)).toEqual([customerId]);
    expect(at7.paymentDays).toBe(7);
  });
});
