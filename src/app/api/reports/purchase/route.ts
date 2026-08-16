import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { PurchaseReportQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";
import { serializePurchaseReportRow } from "@/module/report/report.serializer";

export async function GET(req: NextRequest) {
  return withAuth(async ({ userId, permissions, isOwner }) => {
    const query = PurchaseReportQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getPurchaseReport(query, { userId, permissions, isOwner });

    return NextResponse.json({
      ...report,
      data: report.data.map(serializePurchaseReportRow),
    });
  }, [PERMISSIONS.REPORT_READ]);
}
