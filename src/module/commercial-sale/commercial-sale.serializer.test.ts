import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/client";
import { CommercialSaleType } from "@/generated/enums";
import {
  serializeCommercialSale,
  type CommercialSaleWithRelations,
} from "./commercial-sale.serializer";

const decimal = (value: number) => new Prisma.Decimal(value);

function buildSale(
  items: Partial<CommercialSaleWithRelations["items"][number]>[],
) {
  return {
    id: 1,
    trNo: "COM-20260814-00001",
    customerId: 7,
    totalAmount: decimal(1250.5),
    paidAmount: decimal(250.25),
    discount: null,
    paymentType: "CASH",
    invoiceDate: new Date("2026-08-14"),
    notes: null,
    isDeleted: false,
    createdById: 1,
    updatedById: 1,
    createdAt: new Date("2026-08-14"),
    updatedAt: new Date("2026-08-14"),
    customer: { id: 7, name: "Hotel Blue" },
    returns: [],
    items: items.map((item, index) => ({
      id: index + 1,
      commercialSaleId: 1,
      productId: 3,
      stockId: 9,
      saleType: CommercialSaleType.RENT,
      quantity: 10,
      salePrice: decimal(100),
      netTotal: decimal(1000),
      cylindersDispatched: 10,
      cylindersReturned: 0,
      createdAt: new Date("2026-08-14"),
      updatedAt: new Date("2026-08-14"),
      product: { id: 3, name: "19 kg Commercial" },
      stock: { id: 9, batchNo: "BATCH-1" },
      ...item,
    })),
  } as unknown as CommercialSaleWithRelations;
}

describe("serializeCommercialSale", () => {
  it("converts Decimal money to numbers", () => {
    const result = serializeCommercialSale(buildSale([{}]));

    expect(result.totalAmount).toBe(1250.5);
    expect(result.paidAmount).toBe(250.25);
    expect(result.items[0].salePrice).toBe(100);
  });

  // cylindersOutstanding is what the return dialog and the delete guard both
  // read, so partial returns have to land exactly.
  it("reports cylinders still with the customer after a partial return", () => {
    const result = serializeCommercialSale(
      buildSale([{ cylindersDispatched: 10, cylindersReturned: 4 }]),
    );

    expect(result.items[0].cylindersOutstanding).toBe(6);
  });

  it("reports zero outstanding once everything is returned", () => {
    const result = serializeCommercialSale(
      buildSale([{ cylindersDispatched: 10, cylindersReturned: 10 }]),
    );

    expect(result.items[0].cylindersOutstanding).toBe(0);
  });

  it("reports zero outstanding for an outright sale line", () => {
    const result = serializeCommercialSale(
      buildSale([
        {
          saleType: CommercialSaleType.SALE,
          cylindersDispatched: 0,
          cylindersReturned: 0,
        },
      ]),
    );

    expect(result.items[0].cylindersOutstanding).toBe(0);
  });

  it("nulls out to undefined so optional fields disappear from JSON", () => {
    const result = serializeCommercialSale(buildSale([{}]));

    expect(result.notes).toBeUndefined();
    expect(result.discount).toBeUndefined();
  });
});
