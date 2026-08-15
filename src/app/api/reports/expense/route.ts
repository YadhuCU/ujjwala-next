import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ExpenseReportQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import { serializeExpenseReportRow } from "@/module/report/report.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async ({ id, roles }) => {
    const query = ExpenseReportQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getExpenseReport(query, {
      userId: Number(id),
      roles: roles ?? [],
    });

    return NextResponse.json({
      ...report,
      data: report.data.map(serializeExpenseReportRow),
    });
  }, [PERMISSIONS.REPORT_READ]);
}
