import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExportFormatSchema,
  PurchaseReportQuerySchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import { buildExportResponse } from "@/module/report/report.export";

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
      columns: [
        { header: "Invoice No", value: (p) => p.invoiceNo ?? "" },
        {
          header: "Date",
          value: (p) => new Date(p.purchaseDate).toLocaleDateString("en-IN"),
        },
        { header: "Vendor", value: (p) => p.vendor?.name ?? "" },
        {
          header: "Products (Qty)",
          value: (p) =>
            p.items
              .map((i) => `${i.product?.name ?? ""} (${i.quantity})`)
              .join(", "),
        },
        {
          header: "Type",
          value: (p) => [...new Set(p.items.map((i) => i.purchaseType))].join(", "),
        },
        {
          header: "Batches",
          value: (p) => p.items.map((i) => i.batchNo).filter(Boolean).join(", "),
        },
        {
          header: "Total Cost",
          value: (p) => Number(p.totalCost ?? 0).toFixed(2),
        },
      ],
      rows,
    });
  }, [PERMISSIONS.REPORT_EXPORT]);
}
