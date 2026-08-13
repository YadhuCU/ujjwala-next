import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import {
  ExpenseReportQuerySchema,
  ExportFormatSchema,
} from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import { buildExportResponse } from "@/module/report/report.export";

export async function GET(req: NextRequest) {
  return withAuth(async ({ id, roles }) => {
    const params = Object.fromEntries(req.nextUrl.searchParams);
    const query = ExpenseReportQuerySchema.parse(params);
    const format = ExportFormatSchema.parse(params.format ?? "excel");

    const rows = await ReportService.getExpenseReportRows(query, {
      userId: Number(id),
      roles: roles ?? [],
    });

    const totalAmount = rows.reduce(
      (sum, row) => sum + Number(row.amount ?? 0),
      0,
    );

    return buildExportResponse({
      format,
      title: "EXPENSE REPORT",
      filenameBase: "expense_report",
      meta: [
        `Date Range: ${params.from} to ${params.to}`,
        `Generated: ${new Date().toLocaleString("en-IN")}`,
        `Total Expenses: ${rows.length}`,
        `Total Amount: ${totalAmount.toFixed(2)}`,
      ],
      columns: [
        {
          header: "Date",
          value: (e) =>
            e.date ? new Date(e.date).toLocaleDateString("en-IN") : "",
        },
        { header: "Expense", value: (e) => e.expense ?? "" },
        { header: "Amount", value: (e) => Number(e.amount ?? 0).toFixed(2) },
        { header: "Recorded By", value: (e) => e.createdBy?.name ?? "" },
      ],
      rows,
    });
  }, [PERMISSIONS.REPORT_EXPORT]);
}
