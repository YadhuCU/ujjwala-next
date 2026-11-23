import { z } from "zod";
import { DASHBOARD_VIEWS, type DashboardView } from "./dashboard.period";

// India calendar dates, as the client's date-fns `format(d, "yyyy-MM-dd")` sends
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be yyyy-mm-dd");

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

export const DashboardQuerySchema = z.object({
  // Month is what the dashboard opens on
  view: z.enum(DASHBOARD_VIEWS).default("month"),
  from: z.preprocess(emptyToUndefined, dateKey.optional()),
  to: z.preprocess(emptyToUndefined, dateKey.optional()),
});

// How long is "too long" for each commercial alert. The viewer picks; 30 days
// is where both started.
const days = z.coerce.number().int().min(0).max(3650).default(30);

export const DashboardAlertsQuerySchema = z.object({
  cylinderDays: days,
  paymentDays: days,
});

// What the service accepts: the parsed payload, or anything narrower (tests,
// and the defaults when a field is left out).
export type DashboardQuery = { view?: DashboardView; from?: string; to?: string };
export type DashboardAlertsQuery = { cylinderDays?: number; paymentDays?: number };
