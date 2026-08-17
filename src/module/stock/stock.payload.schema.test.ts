import { describe, expect, it } from "vitest";
import { CreateStockSchema, StockQuerySchema } from "./stock.payload.schema";

const validBatch = {
  batchNo: "BATCH-1",
  productId: 3,
  invoiceNo: "",
  quantity: 20,
  productCost: 812.345,
  reason: "Opening stock from the old system",
};

describe("CreateStockSchema", () => {
  it("rounds cost and drops empty optionals", () => {
    const parsed = CreateStockSchema.parse(validBatch);

    expect(parsed.productCost).toBe(812.35);
    expect(parsed.invoiceNo).toBeUndefined();
  });

  // A manual batch moves the godown, so it is posted as a stock adjustment and
  // an adjustment without a reason is not allowed to exist.
  it("requires a reason", () => {
    const result = CreateStockSchema.safeParse({ ...validBatch, reason: "" });

    expect(result.success).toBe(false);
  });

  it("allows a zero quantity batch but not a negative one", () => {
    expect(
      CreateStockSchema.safeParse({ ...validBatch, quantity: 0 }).success,
    ).toBe(true);
    expect(
      CreateStockSchema.safeParse({ ...validBatch, quantity: -1 }).success,
    ).toBe(false);
  });
});

describe("StockQuerySchema", () => {
  // Sale forms want stock on hand; only the stock page asks for drained batches.
  it("hides empty batches unless explicitly asked", () => {
    expect(StockQuerySchema.parse({}).includeEmpty).toBe(false);
    expect(StockQuerySchema.parse({ includeEmpty: "true" }).includeEmpty).toBe(
      true,
    );
    expect(StockQuerySchema.parse({ includeEmpty: "false" }).includeEmpty).toBe(
      false,
    );
  });

  it("passes a product type filter through", () => {
    expect(StockQuerySchema.parse({ type: "ARB" }).type).toBe("ARB");
    expect(StockQuerySchema.parse({ type: "" }).type).toBeUndefined();
  });
});
