import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { CustomerWiseQuerySchema } from "@/module/report/report.payload.schema";
import * as ReportService from "@/module/report/report.service";

// Agency-wide balances, so it has a permission of its own rather than a scope
export async function GET(req: NextRequest) {
  return withAuth(async () => {
    const query = CustomerWiseQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const report = await ReportService.getCustomerWiseReport(query);

    return NextResponse.json(report);
  }, [PERMISSIONS.REPORT_READ, PERMISSIONS.REPORT_CUSTOMER_WISE]);
}
