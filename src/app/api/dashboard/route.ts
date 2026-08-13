import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import { DashboardQuerySchema } from "@/module/dashboard/dashboard.payload.schema";
import * as DashboardService from "@/module/dashboard/dashboard.service";

export async function GET(req: NextRequest) {
  return withAuth(async ({ id, roles }) => {
    const query = DashboardQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams),
    );

    const data = await DashboardService.getDashboard(query, {
      userId: Number(id),
      roles: roles ?? [],
    });

    return NextResponse.json(data);
  }, [PERMISSIONS.DASHBOARD_READ]);
}
