import type { ExportFormat } from "./report.payload.schema";
import type { SaleLine } from "./report.lines";

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

/**
 * One row per item sold — see report.lines.ts. Money that belongs to the
 * invoice (discount, total, paid, balance) is written on its first line only,
 * so the columns still sum to the real figures.
 */
export function saleExportColumns({
  withType = false,
  withCustody = false,
}: {
  /** Dom and commercial lines are RENT or SALE; ARB lines have no type. */
  withType?: boolean;
  withCustody?: boolean;
} = {}): ExportColumn<SaleLine<SaleExportRow>>[] {
  const invoiceMoney = (line: SaleLine<SaleExportRow>, value: string) =>
    line.first ? value : "";

  const columns: ExportColumn<SaleLine<SaleExportRow>>[] = [
    { header: "Tr No", value: (l) => l.sale.trNo ?? "" },
    {
      header: "Date",
      value: (l) => new Date(l.sale.createdAt).toLocaleDateString("en-IN"),
    },
    { header: "Customer", value: (l) => l.sale.customer?.name ?? "" },
    { header: "Item", value: (l) => l.item?.product?.name ?? "" },
    { header: "Batch", value: (l) => l.item?.stock?.batchNo ?? "" },
    ...(withType
      ? [{ header: "Type", value: (l: SaleLine<SaleExportRow>) => l.item?.saleType ?? "" }]
      : []),
    { header: "Quantity", value: (l) => l.item?.quantity ?? "" },
    ...(withCustody
      ? [
          {
            header: "Cylinders With Customer",
            value: (l: SaleLine<SaleExportRow>) =>
              l.item
                ? (l.item.cylindersDispatched ?? 0) - (l.item.cylindersReturned ?? 0)
                : "",
          },
        ]
      : []),
    { header: "Discount", value: (l) => invoiceMoney(l, money(l.sale.discount)) },
    { header: "Total Amount", value: (l) => invoiceMoney(l, money(l.sale.totalAmount)) },
    { header: "Paid Amount", value: (l) => invoiceMoney(l, money(l.sale.paidAmount)) },
    {
      header: "Balance",
      value: (l) =>
        invoiceMoney(
          l,
          (Number(l.sale.totalAmount ?? 0) - Number(l.sale.paidAmount ?? 0)).toFixed(2),
        ),
    },
    { header: "Payment Type", value: (l) => l.sale.paymentType ?? "" },
    { header: "Recorded By", value: (l) => l.sale.createdBy?.name ?? "" },
  ];

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
