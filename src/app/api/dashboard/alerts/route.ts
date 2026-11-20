import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { DashboardAlertsQuerySchema } from "@/module/dashboard/dashboard.payload.schema";
import * as DashboardService from "@/module/dashboard/dashboard.service";

// The commercial alert lists, with the viewer's own "older than N days".
export async function GET(req: NextRequest) {
  return withAuth(
    async () => {
      const query = DashboardAlertsQuerySchema.parse(
        Object.fromEntries(req.nextUrl.searchParams),
      );
      return NextResponse.json(await DashboardService.getCommercialAlerts(query));
    },
    [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.DASHBOARD_COMMERCIAL_ALERTS],
  );
}
