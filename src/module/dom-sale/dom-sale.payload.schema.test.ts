import { describe, expect, it } from "vitest";
import { CommercialSaleType, PaymentType } from "@/generated/enums";
import { CreateDomSaleSchema } from "./dom-sale.payload.schema";

const base = {
  customerId: 1,
  paymentType: PaymentType.CASH,
  paidAmount: 0,
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
});
