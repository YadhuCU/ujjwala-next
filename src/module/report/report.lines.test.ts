import { describe, expect, it } from "vitest";
import { toSaleLines } from "./report.lines";

const invoice = (id: number, items: string[]) => ({
  id,
  total: 100 * id,
  items: items.map((name) => ({ name })),
});

describe("toSaleLines", () => {
  it("gives one row per item, in order", () => {
    const lines = toSaleLines([invoice(1, ["a", "b"]), invoice(2, ["c"])]);

    expect(lines.map((l) => `${l.sale.id}:${l.item?.name}`)).toEqual([
      "1:a",
      "1:b",
      "2:c",
    ]);
  });

  // Otherwise a column of invoice totals would count invoice 1 twice.
  it("marks only the first line of each invoice as carrying its money", () => {
    const lines = toSaleLines([invoice(1, ["a", "b", "c"]), invoice(2, ["d"])]);

    expect(lines.map((l) => l.first)).toEqual([true, false, false, true]);

    const summed = lines.filter((l) => l.first).reduce((s, l) => s + l.sale.total, 0);
    expect(summed).toBe(300);
  });

  // A commercial visit where staff only collected cylinders has no items.
  it("keeps an invoice with no items as a single row", () => {
    const lines = toSaleLines([invoice(7, [])]);

    expect(lines).toHaveLength(1);
    expect(lines[0].item).toBeUndefined();
    expect(lines[0].first).toBe(true);
  });

  it("returns nothing for no invoices", () => {
    expect(toSaleLines([])).toEqual([]);
  });
});
