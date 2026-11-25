import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ProfitReportQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";

// Agency-wide and shows what stock cost, so it has a permission of its own
export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = ProfitReportQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getProfitReport(query);

    return NextResponse.json(report);
  }, [PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_PROFIT]);
}
