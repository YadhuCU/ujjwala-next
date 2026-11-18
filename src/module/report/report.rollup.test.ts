import { describe, expect, it } from "vitest";
import {
  buildCustomerWiseRows,
  receiptTypeLabel,
  summarizeCustomerWiseRows,
  toCustomerWiseLines,
  type CylinderEvent,
  type MoneyEvent,
} from "./report.rollup";

const from = new Date("2026-11-01T00:00:00+05:30");
const to = new Date("2026-11-18T23:59:59+05:30");
const before = new Date("2026-10-15T10:00:00+05:30");
const during = new Date("2026-11-10T10:00:00+05:30");
const after = new Date("2026-11-25T10:00:00+05:30");

const BEACH = 1;
const HILITE = 2;
const KG19 = 10;
const KG47 = 20;

const customers = [
  { id: BEACH, name: "Beach Hotel", phone: "9000000001" },
  { id: HILITE, name: "Hilite Mall" },
];
const productNames = new Map([
  [KG19, "19 kg"],
  [KG47, "47.5 kg"],
]);

const build = (money: MoneyEvent[], cylinders: CylinderEvent[]) =>
  buildCustomerWiseRows({ customers, productNames, money, cylinders, from, to });

describe("buildCustomerWiseRows", () => {
  // The client's own sample row for Beach Hotel
  it("reproduces the sample: 12 + 10 − 12 = 10 empties, 34320 + 28600 − 28600", () => {
    const [row] = build(
      [
        { customerId: BEACH, at: before, kind: "sale", amount: 34320 },
        { customerId: BEACH, at: during, kind: "sale", amount: 28600 },
        { customerId: BEACH, at: during, kind: "receipt", amount: 28600, method: "CASH" },
      ],
      [
        { customerId: BEACH, productId: KG19, at: before, kind: "rent", quantity: 12 },
        { customerId: BEACH, productId: KG19, at: during, kind: "rent", quantity: 10 },
        { customerId: BEACH, productId: KG19, at: during, kind: "back", quantity: 12 },
      ],
    );

    expect(row).toMatchObject({
      customerName: "Beach Hotel",
      openingEmpty: 12,
      rentedQty: 10,
      emptyBack: 12,
      balanceEmpty: 10,
      openingBalance: 34320,
      salesAmount: 28600,
      receipts: 28600,
      receiptTypes: ["CASH"],
      outstanding: 34320,
    });
  });

  it("gives each cylinder size its own sub row and totals them on the customer", () => {
    const [row] = build(
      [],
      [
        { customerId: BEACH, productId: KG19, at: during, kind: "rent", quantity: 4 },
        { customerId: BEACH, productId: KG47, at: during, kind: "rent", quantity: 2 },
        { customerId: BEACH, productId: KG47, at: during, kind: "back", quantity: 1 },
      ],
    );

    expect(row.products.map((p) => [p.productName, p.balanceEmpty])).toEqual([
      ["19 kg", 4],
      ["47.5 kg", 1],
    ]);
    expect(row.balanceEmpty).toBe(5);
    expect(row.rentedQty).toBe(6);
  });

  it("counts an outright sale but never holds it", () => {
    const [row] = build(
      [],
      [
        { customerId: BEACH, productId: KG19, at: before, kind: "sold", quantity: 9 },
        { customerId: BEACH, productId: KG19, at: during, kind: "sold", quantity: 3 },
        { customerId: BEACH, productId: KG19, at: during, kind: "rent", quantity: 2 },
      ],
    );

    expect(row.soldQty).toBe(3);
    expect(row.openingEmpty).toBe(0);
    expect(row.balanceEmpty).toBe(2);
  });

  it("treats an onboarding balance as opening, even when the customer joined mid-range", () => {
    const [row] = build(
      [{ customerId: BEACH, at: during, kind: "opening", amount: 5000 }],
      [{ customerId: BEACH, productId: KG19, at: during, kind: "opening", quantity: 7 }],
    );

    expect(row.openingBalance).toBe(5000);
    expect(row.openingEmpty).toBe(7);
    expect(row.balanceEmpty).toBe(7);
    expect(row.outstanding).toBe(5000);
  });

  it("ignores everything after the range", () => {
    const rows = build(
      [{ customerId: BEACH, at: after, kind: "sale", amount: 999 }],
      [{ customerId: BEACH, productId: KG19, at: after, kind: "rent", quantity: 5 }],
    );

    expect(rows).toEqual([]);
  });

  it("nets a reversed receipt and does not list it as a way money came in", () => {
    const [row] = build(
      [
        { customerId: BEACH, at: during, kind: "sale", amount: 1000 },
        { customerId: BEACH, at: during, kind: "receipt", amount: 400, method: "CHEQUE" },
        { customerId: BEACH, at: during, kind: "receipt", amount: -400 },
      ],
      [],
    );

    expect(row.receipts).toBe(0);
    expect(row.outstanding).toBe(1000);
    expect(row.receiptTypes).toEqual(["CHEQUE"]);
  });

  it("says when a receipt's method was never recorded", () => {
    const [row] = build(
      [
        { customerId: BEACH, at: during, kind: "receipt", amount: 100, method: "CASH" },
        { customerId: BEACH, at: during, kind: "receipt", amount: 50, method: null },
      ],
      [],
    );

    expect(receiptTypeLabel(row.receiptTypes)).toBe("Cash, Not recorded");
  });

  it("leaves out customers with nothing to show and sorts the rest by name", () => {
    const rows = build(
      [
        { customerId: HILITE, at: during, kind: "sale", amount: 10 },
        { customerId: BEACH, at: during, kind: "sale", amount: 10 },
      ],
      [],
    );
    expect(rows.map((r) => r.customerName)).toEqual(["Beach Hotel", "Hilite Mall"]);

    expect(build([], [])).toEqual([]);
  });
});

describe("toCustomerWiseLines", () => {
  it("adds sub lines only for a customer with more than one size", () => {
    const rows = build(
      [],
      [
        { customerId: BEACH, productId: KG19, at: during, kind: "rent", quantity: 1 },
        { customerId: BEACH, productId: KG47, at: during, kind: "rent", quantity: 1 },
        { customerId: HILITE, productId: KG19, at: during, kind: "rent", quantity: 1 },
      ],
    );

    expect(toCustomerWiseLines(rows).map((l) => l.kind)).toEqual([
      "customer",
      "product",
      "product",
      "customer",
    ]);
  });
});

describe("summarizeCustomerWiseRows", () => {
  it("totals the money columns", () => {
    const rows = build(
      [
        { customerId: BEACH, at: during, kind: "sale", amount: 100.1 },
        { customerId: HILITE, at: during, kind: "sale", amount: 200.2 },
        { customerId: HILITE, at: during, kind: "receipt", amount: 50, method: "CASH" },
      ],
      [],
    );

    expect(summarizeCustomerWiseRows(rows)).toMatchObject({
      customerCount: 2,
      salesAmount: 300.3,
      receipts: 50,
      outstanding: 250.3,
    });
  });
});

describe("receiptTypeLabel", () => {
  it("shows a dash when nothing came in", () => {
    expect(receiptTypeLabel([])).toBe("—");
  });
});
