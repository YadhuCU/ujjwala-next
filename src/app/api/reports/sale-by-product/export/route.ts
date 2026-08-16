import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExportFormatSchema,
  SaleByProductQuerySchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import { buildExportResponse } from "@/module/report/report.export";

export async function GET(req: NextRequest) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = SaleByProductQuerySchema.parse(params);
    const format = ExportFormatSchema.parse(params.format ?? "excel");

    const { data, summary } =
      await ReportService.getSaleByProductReport(query, { userId, permissions, isOwner });

    return buildExportResponse({
      format,
      title: "SALE BY PRODUCT REPORT",
      filenameBase: "sale_by_product_report",
      meta: [
        `Date Range: ${params.from} to ${params.to}`,
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        `Total Quantity: ${summary.totalQuantity}`,
        `Total Amount: ${summary.totalAmount.toFixed(2)}`,
      ],
      columns: [
        { header: "Product", value: (r) => r.productName },
        { header: "Quantity Sold", value: (r) => r.totalQuantity },
        { header: "Total Amount", value: (r) => r.totalAmount.toFixed(2) },
      ],
      rows: data,
    });
  }, [PERMISSIONS.REPORT_EXPORT]);
}
