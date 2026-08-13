import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { SaleReportQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";

export async function GET(req: NextRequest) {
  return withAuth(async ({ id, roles }) => {
    const query = SaleReportQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getSaleReport("ARB", query, {
      userId: Number(id),
      roles: roles ?? [],
    });

    return NextResponse.json(report);
  }, [PERMISSIONS.REPORT_READ]);
}
