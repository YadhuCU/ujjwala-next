import type { ExportFormat } from "./report.payload.schema";

// =============================================================================
// EXPORT RENDERERS
// Shared by every /api/reports/*/export route so the file shape stays identical
// across reports. "excel" is a CSV Excel opens natively; "pdf" is a plain-text
// listing (no PDF renderer is bundled — this keeps the download working).
// =============================================================================

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

function csvCell(value: string | number): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];

  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  }

  return lines.join("\n");
}

function toText<T>(
  title: string,
  meta: string[],
  columns: ExportColumn<T>[],
  rows: T[],
): string {
  const lines = [title, ...meta, "", columns.map((c) => c.header).join("\t")];

  for (const row of rows) {
    lines.push(columns.map((c) => String(c.value(row))).join("\t"));
  }

  return lines.join("\n");
}

// ─── Sale exports ────────────────────────────────────────────────────────────
// dom / arb / commercial invoices all export the same columns; the commercial
// one adds cylinder custody.

type Money = { toString(): string } | number | null;

export type SaleExportRow = {
  trNo: string | null;
  createdAt: Date;
  totalAmount: Money;
  paidAmount: Money;
  discount: Money;
  paymentType: string;
  customer: { name: string | null } | null;
  createdBy: { name: string | null } | null;
  items: {
    quantity: number;
    salePrice: Money;
    netTotal: Money;
    saleType?: string;
    cylindersDispatched?: number;
    cylindersReturned?: number;
    product: { name: string | null } | null;
    stock: { batchNo: string | null } | null;
  }[];
};

const money = (value: Money) => Number(value ?? 0).toFixed(2);

export function saleExportColumns(
  withCustody = false,
): ExportColumn<SaleExportRow>[] {
  const columns: ExportColumn<SaleExportRow>[] = [
    { header: "Tr No", value: (r) => r.trNo ?? "" },
    {
      header: "Date",
      value: (r) => new Date(r.createdAt).toLocaleDateString("en-IN"),
    },
    { header: "Customer", value: (r) => r.customer?.name ?? "" },
    {
      header: "Products (Qty)",
      value: (r) =>
        r.items
          .map((i) => `${i.product?.name ?? ""} (${i.quantity})`)
          .join(", "),
    },
    {
      header: "Batches",
      value: (r) =>
        r.items
          .map((i) => i.stock?.batchNo)
          .filter(Boolean)
          .join(", "),
    },
    { header: "Discount", value: (r) => money(r.discount) },
    { header: "Total Amount", value: (r) => money(r.totalAmount) },
    { header: "Paid Amount", value: (r) => money(r.paidAmount) },
    {
      header: "Balance",
      value: (r) => (Number(r.totalAmount ?? 0) - Number(r.paidAmount ?? 0)).toFixed(2),
    },
    { header: "Payment Type", value: (r) => r.paymentType ?? "" },
    { header: "Recorded By", value: (r) => r.createdBy?.name ?? "" },
  ];

  if (withCustody) {
    columns.splice(5, 0, {
      header: "Cylinders With Customer",
      value: (r) =>
        r.items.reduce(
          (sum, i) =>
            sum + ((i.cylindersDispatched ?? 0) - (i.cylindersReturned ?? 0)),
          0,
        ),
    });
  }

  return columns;
}

export function buildExportResponse<T>({
  format,
  title,
  filenameBase,
  meta,
  columns,
  rows,
}: {
  format: ExportFormat;
  title: string;
  filenameBase: string;
  meta: string[];
  columns: ExportColumn<T>[];
  rows: T[];
}): Response {
  const isPdf = format === "pdf";
  const body = isPdf
    ? toText(title, meta, columns, rows)
    : toCsv(columns, rows);

  const date = new Date().toISOString().split("T")[0];
  const filename = `${filenameBase}_${date}.${isPdf ? "txt" : "csv"}`;

  return new Response(body, {
    headers: {
      "Content-Type": isPdf
        ? "text/plain; charset=utf-8"
        : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
