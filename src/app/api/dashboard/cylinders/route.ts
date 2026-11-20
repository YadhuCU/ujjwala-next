import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { PERMISSIONS } from "@/lib/permissions";
import * as DashboardService from "@/module/dashboard/dashboard.service";

// The dashboard's cylinder position card. Its own grant, so a role can see it
// without being given the whole godown page.
export async function GET() {
  return withAuth(
    async () => NextResponse.json(await DashboardService.getCylinderPosition()),
    [PERMISSIONS.DASHBOARD_READ, PERMISSIONS.DASHBOARD_CYLINDER_POSITION],
  );
}
