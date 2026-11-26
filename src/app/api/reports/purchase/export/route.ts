import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExportFormatSchema,
  PurchaseReportQuerySchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import { buildExportResponse } from "@/module/report/report.export";
import { toSaleLines } from "@/module/report/report.lines";

export async function GET(req: NextRequest) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = PurchaseReportQuerySchema.parse(params);
    const format = ExportFormatSchema.parse(params.format ?? "excel");

    const rows = await ReportService.getPurchaseReportRows(query, { userId, permissions, isOwner });
    const totalAmount = rows.reduce(
      (sum, row) => sum + Number(row.totalCost ?? 0),
      0,
    );

    return buildExportResponse({
      format,
      title: "PURCHASE REPORT",
      filenameBase: "purchase_report",
      meta: [
        `Date Range: ${params.from} to ${params.to}`,
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        `Total Invoices: ${rows.length}`,
        `Total Amount: ${totalAmount.toFixed(2)}`,
      ],
      // One row per item, like the screen; the invoice total on its first
      // line only, so the column sums to the real figure
      columns: [
        { header: "Invoice No", value: (l) => l.sale.invoiceNo ?? "" },
        {
          header: "Date",
          value: (l) => new Date(l.sale.purchaseDate).toLocaleDateString("en-IN"),
        },
        { header: "Vendor", value: (l) => l.sale.vendor?.name ?? "" },
        { header: "Item", value: (l) => l.item?.product?.name ?? "" },
        { header: "Qty", value: (l) => l.item?.quantity ?? "" },
        { header: "Type", value: (l) => l.item?.purchaseType ?? "" },
        { header: "Batch", value: (l) => l.item?.batchNo ?? "" },
        {
          header: "Unit Cost",
          value: (l) =>
            l.item?.unitCost == null ? "" : Number(l.item.unitCost).toFixed(2),
        },
        {
          header: "Line Total",
          value: (l) =>
            l.item?.totalCost == null ? "" : Number(l.item.totalCost).toFixed(2),
        },
        {
          header: "Invoice Total",
          value: (l) => (l.first ? Number(l.sale.totalCost ?? 0).toFixed(2) : ""),
        },
      ],
      rows: toSaleLines(rows),
    });
  }, [PERMISSIONS.REPORT_EXPORT]);
}
