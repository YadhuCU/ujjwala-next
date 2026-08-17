import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExportFormatSchema,
  SaleReportQuerySchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import {
  buildExportResponse,
  saleExportColumns,
  type SaleExportRow,
} from "@/module/report/report.export";

export async function GET(req: NextRequest) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    // Exports cover the full filtered range — page/limit are ignored on purpose
    const query = SaleReportQuerySchema.parse(params);
    const format = ExportFormatSchema.parse(params.format ?? "excel");

    const rows: SaleExportRow[] = await ReportService.getSaleReportRows(
      "COMMERCIAL",
      query,
      { userId, permissions, isOwner },
    );

    return buildExportResponse({
      format,
      title: "COMMERCIAL SALE REPORT",
      filenameBase: "commercial_sale_report",
      meta: [
        `Date Range: ${params.from} to ${params.to}`,
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        `Total Invoices: ${rows.length}`,
      ],
      columns: saleExportColumns(true),
      rows,
    });
  }, [PERMISSIONS.REPORT_EXPORT]);
}
