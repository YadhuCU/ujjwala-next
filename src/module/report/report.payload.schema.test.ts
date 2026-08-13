import { describe, expect, it } from "vitest";
import {
  ExportFormatSchema,
  SaleReportQuerySchema,
} from "./report.payload.schema";

describe("SaleReportQuerySchema", () => {
  // The filter dropdowns send the literal string "all" for "no filter"; passing
  // that through as an id would silently return nothing.
  it("treats 'all' as no filter", () => {
    const parsed = SaleReportQuerySchema.parse({
      from: "2026-08-01",
      to: "2026-08-14",
      customerId: "all",
      staffId: "all",
    });

    expect(parsed.customerId).toBeUndefined();
    expect(parsed.staffId).toBeUndefined();
  });

  it("coerces real ids and dates", () => {
    const parsed = SaleReportQuerySchema.parse({
      from: "2026-08-01",
      to: "2026-08-14",
      customerId: "7",
      page: "3",
    });

    expect(parsed.customerId).toBe(7);
    expect(parsed.page).toBe(3);
    expect(parsed.from).toBeInstanceOf(Date);
  });

  it("requires a date range", () => {
    expect(SaleReportQuerySchema.safeParse({}).success).toBe(false);
  });

  it("defaults to the first page of ten rows", () => {
    const parsed = SaleReportQuerySchema.parse({
      from: "2026-08-01",
      to: "2026-08-14",
    });

    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
  });
});

describe("ExportFormatSchema", () => {
  it("defaults to excel and rejects anything else", () => {
    expect(ExportFormatSchema.parse(undefined)).toBe("excel");
    expect(ExportFormatSchema.parse("pdf")).toBe("pdf");
    expect(ExportFormatSchema.safeParse("docx").success).toBe(false);
  });
});
