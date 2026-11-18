import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  CustomerWiseQuerySchema,
  ExportFormatSchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import {
  buildExportResponse,
  customerWiseExportColumns,
} from "@/module/report/report.export";
import {
  summarizeCustomerWiseRows,
  toCustomerWiseLines,
} from "@/module/report/report.rollup";

export async function GET(req: NextRequest) {
  return withAuth(
    async () => {
      const params = Object.fromEntries(req.nextUrl.searchParams);
      // Exports cover the full filtered range — page/limit are ignored on purpose
      const query = CustomerWiseQuerySchema.parse(params);
      const format = ExportFormatSchema.parse(params.format ?? "excel");

      const rows = await ReportService.getCustomerWiseReportRows(query);
      const summary = summarizeCustomerWiseRows(rows);

      return buildExportResponse({
        format,
        title: "CUSTOMER WISE REPORT",
        filenameBase: "customer_wise_report",
        meta: [
          `Date Range: ${params.from} to ${params.to}`,
          `Generated: ${new Date().toLocaleString("en-IN")}`,
          `Customers: ${summary.customerCount}`,
          `Total Outstanding: ${summary.outstanding.toFixed(2)}`,
        ],
        columns: customerWiseExportColumns(),
        // A customer line, then a line per cylinder size, matching the screen
        rows: toCustomerWiseLines(rows),
      });
    },
    [
      PERMISSIONS.REPORT_READ,
      PERMISSIONS.REPORT_CUSTOMER_WISE,
      PERMISSIONS.REPORT_EXPORT,
    ],
  );
}
