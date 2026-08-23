import { describe, expect, it } from "vitest";
import {
  formatStockAddedOn,
  sortStockOldestFirst,
  stockOptionLabel,
} from "./stock.display";

const batch = (
  createdAt: string,
  quantity = 10,
  name: string | null = "14.2 kg Domestic",
) => ({
  createdAt,
  quantity,
  product: name === null ? null : { name },
});

describe("sortStockOldestFirst", () => {
  // FIFO: the batch that has been sitting longest is offered first.
  it("puts the oldest batch first", () => {
    const sorted = sortStockOldestFirst([
      batch("2026-08-12T00:00:00Z"),
      batch("2026-06-01T00:00:00Z"),
      batch("2026-07-04T00:00:00Z"),
    ]);

    expect(sorted.map((s) => s.createdAt)).toEqual([
      "2026-06-01T00:00:00Z",
      "2026-07-04T00:00:00Z",
      "2026-08-12T00:00:00Z",
    ]);
  });

  it("breaks ties on the larger quantity", () => {
    const sorted = sortStockOldestFirst([
      batch("2026-06-01T00:00:00Z", 5),
      batch("2026-06-01T00:00:00Z", 40),
    ]);

    expect(sorted.map((s) => s.quantity)).toEqual([40, 5]);
  });

  it("does not mutate the array it was given", () => {
    const input = [batch("2026-08-12T00:00:00Z"), batch("2026-06-01T00:00:00Z")];
    const snapshot = input.map((s) => s.createdAt);

    sortStockOldestFirst(input);

    expect(input.map((s) => s.createdAt)).toEqual(snapshot);
  });

  // Over HTTP a Date arrives as a string, whatever the type says.
  it("handles Date objects as well as strings", () => {
    const sorted = sortStockOldestFirst([
      { createdAt: new Date("2026-08-12"), quantity: 1, product: null },
      { createdAt: "2026-06-01T00:00:00Z", quantity: 1, product: null },
    ]);

    expect(sorted[0].createdAt).toBe("2026-06-01T00:00:00Z");
  });
});

describe("stockOptionLabel", () => {
  it("names the product, when it arrived, and what is left", () => {
    const label = stockOptionLabel(batch("2026-08-12T00:00:00Z", 40));

    expect(label).toContain("14.2 kg Domestic");
    expect(label).toContain("2026");
    expect(label).toContain("40 left");
  });

  // The whole point of the change: batch codes meant nothing to the staff.
  it("does not mention a batch number", () => {
    const label = stockOptionLabel({
      ...batch("2026-08-12T00:00:00Z"),
      // a batch number on the object must not leak into the label
      batchNo: "BATCH-20260812-P4-PR2-1",
    } as Parameters<typeof stockOptionLabel>[0]);

    expect(label).not.toContain("BATCH");
    expect(label.toLowerCase()).not.toContain("batch");
  });

  it("survives a batch whose product was removed", () => {
    expect(stockOptionLabel(batch("2026-08-12T00:00:00Z", 3, null))).toContain(
      "Unknown product",
    );
  });
});

describe("formatStockAddedOn", () => {
  it("renders a readable day, month and year", () => {
    const formatted = formatStockAddedOn("2026-08-12T00:00:00Z");

    expect(formatted).toMatch(/12/);
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/Aug/i);
  });
});
