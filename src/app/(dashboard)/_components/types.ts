import type { DashboardResponse } from "@/module/dashboard/dashboard.service";

/**
 * The dashboard payload is JSON-safe already (dates are stringified in the
 * service), so the service's return type is the client's contract directly.
 */
export type DashboardData = DashboardResponse;
