import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExportFormatSchema,
  ProfitReportQuerySchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import {
  buildExportResponse,
  profitExportColumns,
} from "@/module/report/report.export";
import { PROFIT_CATEGORY_LABEL } from "@/module/report/report.profit";

export async function GET(req: NextRequest) {
  return withAuth(
    async () => {
      const params = Object.fromEntries(req.nextUrl.searchParams);
      const query = ProfitReportQuerySchema.parse(params);
      const format = ExportFormatSchema.parse(params.format ?? "excel");

      const { data, summary } = await ReportService.getProfitReport(query);

      return buildExportResponse({
        format,
        title:
          query.view === "item"
            ? "PROFIT REPORT — ITEM WISE"
            : "PROFIT REPORT — CATEGORY WISE",
        filenameBase:
          query.view === "item" ? "profit_report_item_wise" : "profit_report_category_wise",
        meta: [
          `Date Range: ${params.from} to ${params.to}`,
          `Category: ${query.category ? PROFIT_CATEGORY_LABEL[query.category] : "All"}`,
          `Generated: ${new Date().toLocaleString("en-IN")}`,
          `Total Sales: ${summary.sales.toFixed(2)}`,
          `Total Cost: ${summary.cost.toFixed(2)}`,
          `Gross Profit: ${summary.grossProfit.toFixed(2)}`,
          ...(summary.expenses === null || summary.netProfit === null
            ? []
            : [
                `Expenses: ${summary.expenses.toFixed(2)}`,
                `Net Profit: ${summary.netProfit.toFixed(2)}`,
              ]),
        ],
        columns: profitExportColumns(),
        rows: data,
      });
    },
    [PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_PROFIT, PERMISSIONS.REPORT_EXPORT],
  );
}
