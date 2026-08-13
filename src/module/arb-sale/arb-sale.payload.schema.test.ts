import { describe, expect, it } from "vitest";
import { ArbSaleQuerySchema, CreateArbSaleSchema } from "./arb-sale.payload.schema";

const validSale = {
  customerId: 7,
  paymentType: "CASH",
  paidAmount: 100.005,
  discount: 10.129,
  notes: "",
  items: [{ stockId: 3, quantity: 2, salePrice: 549.999 }],
};

describe("CreateArbSaleSchema", () => {
  // Money reaches the DB as Decimal(10,2); rounding at the edge keeps the
  // server's recomputed totals identical to what the client displayed.
  it("rounds money to two decimals", () => {
    const parsed = CreateArbSaleSchema.parse(validSale);

    expect(parsed.paidAmount).toBe(100.01);
    expect(parsed.discount).toBe(10.13);
    expect(parsed.items[0].salePrice).toBe(550);
  });

  it("turns empty strings into undefined", () => {
    const parsed = CreateArbSaleSchema.parse(validSale);

    expect(parsed.notes).toBeUndefined();
  });

  it("rejects a sale with no line items", () => {
    const result = CreateArbSaleSchema.safeParse({ ...validSale, items: [] });

    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative quantity", () => {
    const result = CreateArbSaleSchema.safeParse({
      ...validSale,
      items: [{ stockId: 3, quantity: 0, salePrice: 100 }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a negative paid amount", () => {
    const result = CreateArbSaleSchema.safeParse({
      ...validSale,
      paidAmount: -1,
    });

    expect(result.success).toBe(false);
  });
});

describe("ArbSaleQuerySchema", () => {
  it("defaults pagination", () => {
    const parsed = ArbSaleQuerySchema.parse({});

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
  });

  it("coerces query strings to numbers and dates", () => {
    const parsed = ArbSaleQuerySchema.parse({
      customerId: "7",
      page: "2",
      limit: "50",
      from: "2026-08-01",
    });

    expect(parsed.customerId).toBe(7);
    expect(parsed.page).toBe(2);
    expect(parsed.from).toBeInstanceOf(Date);
  });

  it("caps limit so a client cannot ask for the whole table", () => {
    expect(ArbSaleQuerySchema.safeParse({ limit: "1000" }).success).toBe(false);
  });
});
