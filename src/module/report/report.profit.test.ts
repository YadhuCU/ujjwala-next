import { describe, expect, it } from "vitest";
import {
  allocateInvoice,
  buildProfitRows,
  marginOf,
  summarizeProfit,
  type ProfitInvoice,
} from "./report.profit";

const line = (
  productId: number,
  quantity: number,
  rate: number,
  unitCost: number | null,
) => ({
  productId,
  productName: `Item ${productId}`,
  quantity,
  lineValue: quantity * rate,
  unitCost,
});

describe("allocateInvoice", () => {
  it("spreads the discounted total over lines by value, summing exactly", () => {
    // 1000 + 500 = 1500, less a ₹100 discount = 1400
    const shares = allocateInvoice({
      category: "COMMERCIAL",
      invoiceId: 1,
      totalAmount: 1400,
      lines: [line(1, 1, 1000, 800), line(2, 1, 500, 400)],
    });
    expect(shares).toEqual([933.33, 466.67]);
    expect(shares[0] + shares[1]).toBeCloseTo(1400, 2);
  });

  it("falls back to quantity when every line is priced at zero", () => {
    const shares = allocateInvoice({
      category: "ARB",
      invoiceId: 1,
      totalAmount: 0,
      lines: [line(1, 3, 0, 10), line(2, 1, 0, 10)],
    });
    expect(shares).toEqual([0, 0]);
  });

  it("gives a collection-only invoice nothing to spread", () => {
    expect(
      allocateInvoice({
        category: "COMMERCIAL",
        invoiceId: 1,
        totalAmount: 0,
        lines: [],
      }),
    ).toEqual([]);
  });
});

describe("buildProfitRows", () => {
  const invoices: ProfitInvoice[] = [
    {
      category: "COMMERCIAL",
      invoiceId: 1,
      totalAmount: 1900, // 2 × 1000, less 100
      lines: [line(10, 2, 1000, 800)],
    },
    {
      category: "COMMERCIAL",
      invoiceId: 2,
      totalAmount: 3000,
      lines: [line(10, 1, 1000, 800), line(11, 1, 2000, null)],
    },
    {
      category: "DOMESTIC",
      invoiceId: 3,
      totalAmount: 900,
      lines: [line(20, 1, 900, 700)],
    },
  ];

  it("lists every category, even one with no sales", () => {
    const rows = buildProfitRows(invoices, "category");
    expect(rows.map((r) => [r.categoryLabel, r.sales, r.cost, r.profit])).toEqual([
      ["Commercial", 4900, 2400, 2500],
      ["Domestic", 900, 700, 200],
      ["ARB", 0, 0, 0],
    ]);
    expect(rows[0].invoiceCount).toBe(2);
    expect(rows[2].margin).toBeNull();
  });

  it("puts each item under its category, and the items sum to the category", () => {
    const items = buildProfitRows(invoices, "item");
    expect(items.map((r) => [r.category, r.productId, r.qty, r.sales])).toEqual([
      ["COMMERCIAL", 10, 3, 2900],
      ["COMMERCIAL", 11, 1, 2000],
      ["DOMESTIC", 20, 1, 900],
    ]);

    const categories = buildProfitRows(invoices, "category");
    for (const category of categories) {
      const mine = items.filter((i) => i.category === category.category);
      const sum = (pick: (r: (typeof items)[number]) => number) =>
        Math.round(mine.reduce((t, r) => t + pick(r), 0) * 100) / 100;
      expect(sum((r) => r.sales)).toBe(category.sales);
      expect(sum((r) => r.cost)).toBe(category.cost);
      expect(sum((r) => r.qty)).toBe(category.qty);
    }
  });

  it("counts a line from a batch with no cost, and flags it", () => {
    const item = buildProfitRows(invoices, "item").find((r) => r.productId === 11)!;
    expect(item.cost).toBe(0);
    expect(item.uncostedQty).toBe(1);
  });

  it("narrows to the categories asked for", () => {
    const rows = buildProfitRows(invoices, "category", ["DOMESTIC"]);
    expect(rows.map((r) => r.category)).toEqual(["DOMESTIC"]);
  });

  it("summarises once per invoice and agrees with the rows", () => {
    const rows = buildProfitRows(invoices, "item");
    expect(summarizeProfit(invoices, rows)).toEqual({
      invoiceCount: 3,
      qty: 5,
      sales: 5800,
      cost: 3100,
      grossProfit: 2700,
      margin: 46.6,
      uncostedQty: 1,
    });
  });
});

describe("marginOf", () => {
  it("is a percentage to one decimal, and null with no sales", () => {
    expect(marginOf(250, 1000)).toBe(25);
    expect(marginOf(-50, 1000)).toBe(-5);
    expect(marginOf(0, 0)).toBeNull();
  });
});
