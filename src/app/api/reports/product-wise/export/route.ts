import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExportFormatSchema,
  ProductWiseQuerySchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import {
  buildExportResponse,
  productWiseExportColumns,
} from "@/module/report/report.export";

export async function GET(req: NextRequest) {
  return withAuth(
    async () => {
      const params = Object.fromEntries(req.nextUrl.searchParams);
      const query = ProductWiseQuerySchema.parse(params);
      const format = ExportFormatSchema.parse(params.format ?? "excel");

      const { data, summary } = await ReportService.getProductWiseReport(query);

      return buildExportResponse({
        format,
        title: "PRODUCT WISE REPORT",
        filenameBase: "product_wise_report",
        meta: [
          `Date Range: ${params.from} to ${params.to}`,
          `Generated: ${new Date().toLocaleString("en-IN")}`,
          `Total Sales Qty: ${summary.salesQty}`,
          `Total Amount: ${summary.totalAmount.toFixed(2)}`,
        ],
        columns: productWiseExportColumns(),
        rows: data,
      });
    },
    [
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.REPORT_PRODUCT_WISE,
      PERMISSIONS.REPORT_EXPORT,
    ],
  );
}
