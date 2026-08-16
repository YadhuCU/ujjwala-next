import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { SaleByProductQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";

export async function GET(req: NextRequest) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const query = SaleByProductQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getSaleByProductReport(query, { userId, permissions, isOwner });

    return NextResponse.json(report);
  }, [PERMISSIONS.REPORT_READ]);
}
