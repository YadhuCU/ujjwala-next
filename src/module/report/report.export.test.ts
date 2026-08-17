import { describe, expect, it } from "vitest";
import {
  buildExportResponse,
  saleExportColumns,
  type SaleExportRow,
} from "./report.export";

function buildRow(overrides: Partial<SaleExportRow> = {}): SaleExportRow {
  return {
    trNo: "COM-20260814-00001",
    createdAt: new Date("2026-08-14"),
    totalAmount: 1000,
    paidAmount: 400,
    discount: 50,
    paymentType: "CASH",
    customer: { name: "Hotel Blue" },
    createdBy: { name: "Owner User" },
    items: [
      {
        quantity: 10,
        salePrice: 100,
        netTotal: 1000,
        saleType: "RENT",
        cylindersDispatched: 10,
        cylindersReturned: 4,
        product: { name: "19 kg Commercial" },
        stock: { batchNo: "BATCH-1" },
      },
    ],
    ...overrides,
  };
}

async function bodyOf(response: Response) {
  return response.text();
}

describe("saleExportColumns", () => {
  it("computes balance as total minus paid", () => {
    const columns = saleExportColumns();
    const balance = columns.find((c) => c.header === "Balance")!;

    expect(balance.value(buildRow())).toBe("600.00");
  });

  it("adds a custody column only when asked", () => {
    expect(saleExportColumns().map((c) => c.header)).not.toContain(
      "Cylinders With Customer",
    );

    const withCustody = saleExportColumns(true);
    const custody = withCustody.find(
      (c) => c.header === "Cylinders With Customer",
    )!;

    // 10 dispatched, 4 back
    expect(custody.value(buildRow())).toBe(6);
  });
});

describe("buildExportResponse", () => {
  it("renders excel as CSV with a header row", async () => {
    const response = buildExportResponse({
      format: "excel",
      title: "SALE REPORT",
      filenameBase: "sale_report",
      meta: ["Date Range: 2026-08-01 to 2026-08-14"],
      columns: [
        { header: "Tr No", value: (r: SaleExportRow) => r.trNo ?? "" },
        { header: "Customer", value: (r) => r.customer?.name ?? "" },
      ],
      rows: [buildRow()],
    });

    const body = await bodyOf(response);

    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain(".csv");
    expect(body.split("\n")[0]).toBe("Tr No,Customer");
    expect(body.split("\n")[1]).toBe("COM-20260814-00001,Hotel Blue");
  });

  // A customer called "Blue, Hotel" must not shift every later column.
  it("quotes cells containing commas, quotes or newlines", async () => {
    const response = buildExportResponse({
      format: "excel",
      title: "SALE REPORT",
      filenameBase: "sale_report",
      meta: [],
      columns: [{ header: "Customer", value: (r: SaleExportRow) => r.customer?.name ?? "" }],
      rows: [
        buildRow({ customer: { name: 'Blue, "Grand" Hotel' } }),
      ],
    });

    const body = await bodyOf(response);

    expect(body.split("\n")[1]).toBe('"Blue, ""Grand"" Hotel"');
  });

  it("renders pdf as tab separated text carrying the meta lines", async () => {
    const response = buildExportResponse({
      format: "pdf",
      title: "SALE REPORT",
      filenameBase: "sale_report",
      meta: ["Total Invoices: 1"],
      columns: [{ header: "Tr No", value: (r: SaleExportRow) => r.trNo ?? "" }],
      rows: [buildRow()],
    });

    const body = await bodyOf(response);

    expect(response.headers.get("Content-Disposition")).toContain(".txt");
    expect(body).toContain("SALE REPORT");
    expect(body).toContain("Total Invoices: 1");
  });
});
