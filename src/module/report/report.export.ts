import type { ExportFormat } from "./report.payload.schema";
import type { SaleLine } from "./report.lines";
import { receiptTypeLabel, type CustomerWiseLine } from "./report.rollup";
import { businessDayKey } from "@/lib/business-day";
import type { ProfitRow } from "./report.profit";

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
  fieldStaff?: { name: string | null } | null;
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
  withFieldStaff = false,
}: {
  /** Dom and commercial lines are RENT or SALE; ARB lines have no type. */
  withType?: boolean;
  withCustody?: boolean;
  /** Domestic: who made the round, in place of a customer. */
  withFieldStaff?: boolean;
} = {}): ExportColumn<SaleLine<SaleExportRow>>[] {
  const invoiceMoney = (line: SaleLine<SaleExportRow>, value: string) =>
    line.first ? value : "";

  const columns: ExportColumn<SaleLine<SaleExportRow>>[] = [
    { header: "Tr No", value: (l) => l.sale.trNo ?? "" },
    {
      header: "Date",
      value: (l) => new Date(l.sale.createdAt).toLocaleDateString("en-IN"),
    },
    withFieldStaff
      ? { header: "Field Staff", value: (l) => l.sale.fieldStaff?.name ?? "" }
      : { header: "Customer", value: (l) => l.sale.customer?.name ?? "" },
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

// ─── Product wise ────────────────────────────────────────────────────────────

export type ProductWiseExportRow = {
  productName: string;
  openingStock: number;
  purchaseQty: number;
  salesQty: number;
  totalAmount: number;
  adjustments: number;
  closingStock: number;
};

export function productWiseExportColumns(): ExportColumn<ProductWiseExportRow>[] {
  return [
    { header: "Product", value: (r) => r.productName },
    { header: "Opening Stock", value: (r) => r.openingStock },
    { header: "Purchase Qty", value: (r) => r.purchaseQty },
    { header: "Sales Qty", value: (r) => r.salesQty },
    { header: "Total Amount", value: (r) => r.totalAmount.toFixed(2) },
    { header: "Adjustments", value: (r) => r.adjustments },
    { header: "Closing Stock", value: (r) => r.closingStock },
  ];
}

// ─── Profit ──────────────────────────────────────────────────────────────────

/** Category rows leave Item blank; item rows name it. Same columns either way. */
export function profitExportColumns(): ExportColumn<ProfitRow>[] {
  return [
    { header: "Category", value: (r) => r.categoryLabel },
    { header: "Item", value: (r) => r.productName ?? "" },
    { header: "Invoices", value: (r) => r.invoiceCount },
    { header: "Qty Sold", value: (r) => r.qty },
    { header: "Sales", value: (r) => r.sales.toFixed(2) },
    { header: "Cost", value: (r) => r.cost.toFixed(2) },
    { header: "Gross Profit", value: (r) => r.profit.toFixed(2) },
    { header: "Margin %", value: (r) => (r.margin === null ? "" : r.margin.toFixed(1)) },
    { header: "Qty Without Cost", value: (r) => r.uncostedQty },
  ];
}

// ─── Customer wise ───────────────────────────────────────────────────────────

/**
 * One line per customer, then an indented line per cylinder size when there is
 * more than one. Money belongs to the customer, so it is written on the
 * customer line only and the columns still sum.
 */
export function customerWiseExportColumns(): ExportColumn<CustomerWiseLine>[] {
  const cylinders = (l: CustomerWiseLine) =>
    l.kind === "product" ? l.product : l.row;
  const money = (l: CustomerWiseLine, value: number | string) =>
    l.kind === "customer" ? value : "";

  return [
    {
      header: "Customer",
      value: (l) =>
        l.kind === "product"
          ? `   ${l.product.productName}`
          : l.row.products.length === 1
            ? `${l.row.customerName} (${l.row.products[0].productName})`
            : l.row.customerName,
    },
    { header: "Opening Empty Cylinders", value: (l) => cylinders(l).openingEmpty },
    { header: "Rented Qty", value: (l) => cylinders(l).rentedQty },
    { header: "Sold Outright", value: (l) => cylinders(l).soldQty },
    { header: "Empty Taken Back", value: (l) => cylinders(l).emptyBack },
    { header: "Balance Empty Cylinders", value: (l) => cylinders(l).balanceEmpty },
    { header: "Opening Balance", value: (l) => money(l, l.row.openingBalance.toFixed(2)) },
    { header: "Total Sales Amount", value: (l) => money(l, l.row.salesAmount.toFixed(2)) },
    { header: "Receipt", value: (l) => money(l, l.row.receipts.toFixed(2)) },
    { header: "Receipt Type", value: (l) => money(l, receiptTypeLabel(l.row.receiptTypes)) },
    { header: "Outstanding Balance", value: (l) => money(l, l.row.outstanding.toFixed(2)) },
  ];
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

  // India date, like every other day in the app
  const date = businessDayKey(new Date());
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
