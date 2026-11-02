import { describe, expect, it } from "vitest";
import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { CreateDomSaleSchema } from "./dom-sale.payload.schema";

const base = {
  paymentType: PaymentType.CASH,
};

describe("CreateDomSaleSchema", () => {
  // Every domestic line was an outright sale before refills existed, so a
  // caller that sends neither field must mean exactly what it used to.
  it("defaults a line to an outright sale with no empties", () => {
    const parsed = CreateDomSaleSchema.parse({
      ...base,
      items: [{ stockId: 1, quantity: 2, salePrice: 900 }],
    });

    expect(parsed.items[0].saleType).toBe(CommercialSaleType.SALE);
    expect(parsed.items[0].emptiesCollected).toBe(0);
  });

  it("accepts empties on a refill", () => {
    const parsed = CreateDomSaleSchema.parse({
      ...base,
      items: [
        {
          stockId: 1,
          quantity: 2,
          salePrice: 900,
          saleType: CommercialSaleType.RENT,
          emptiesCollected: 2,
        },
      ],
    });

    expect(parsed.items[0].emptiesCollected).toBe(2);
  });

  it("refuses empties on an outright sale", () => {
    const result = CreateDomSaleSchema.safeParse({
      ...base,
      items: [
        {
          stockId: 1,
          quantity: 2,
          salePrice: 900,
          saleType: CommercialSaleType.SALE,
          emptiesCollected: 1,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/only collected on a refill/i);
  });

  it("refuses a negative number of empties", () => {
    const result = CreateDomSaleSchema.safeParse({
      ...base,
      items: [
        {
          stockId: 1,
          quantity: 2,
          salePrice: 900,
          saleType: CommercialSaleType.RENT,
          emptiesCollected: -1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("refuses more empties than cylinders handed out", () => {
    const result = CreateDomSaleSchema.safeParse({
      ...base,
      items: [
        {
          stockId: 1,
          quantity: 2,
          salePrice: 900,
          saleType: CommercialSaleType.RENT,
          emptiesCollected: 3,
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/more empties than/i);
  });

  // A domestic sale has no customer to owe a balance, so neither field is part
  // of the contract any more; a stale client sending them must not be trusted.
  it("drops a customer and a paid amount sent by an old client", () => {
    const parsed = CreateDomSaleSchema.parse({
      ...base,
      customerId: 7,
      paidAmount: 1,
      items: [{ stockId: 1, quantity: 1, salePrice: 900 }],
    });

    expect(parsed).not.toHaveProperty("customerId");
    expect(parsed).not.toHaveProperty("paidAmount");
  });
});
