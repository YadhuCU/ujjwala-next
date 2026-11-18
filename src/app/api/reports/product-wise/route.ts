import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { ProductWiseQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";

// Agency-wide stock, so it has a permission of its own rather than a scope
export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = ProductWiseQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getProductWiseReport(query);

    return NextResponse.json(report);
  }, [PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_PRODUCT_WISE]);
}
