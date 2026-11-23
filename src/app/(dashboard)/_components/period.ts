import { format } from "date-fns";
import type { DashboardView } from "@/module/dashboard/dashboard.period";

export type { DashboardView };

/** What the dashboard asks the server for. No dates = that view's default. */
export type PeriodSelection = {
  view: DashboardView;
  from?: string;
  to?: string;
};

// Bucket keys are `yyyy-mm-dd`, `yyyy-mm` or `yyyy`. Read as local midnight so
// the label is the calendar date the key names, in any browser timezone.
function keyToDate(key: string): Date {
  if (key.length === 4) return new Date(Number(key), 0, 1);
  const [y, m, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Short axis label for one bucket. */
export function tickLabel(view: DashboardView, key: string): string {
  if (view === "year") return key;
  if (view === "month") return format(keyToDate(key), "MMM yy");
  return format(keyToDate(key), "d/M");
}

/** Full label for one bucket, as a tooltip heading. */
export function bucketLabel(view: DashboardView, key: string): string {
  if (view === "year") return key;
  if (view === "month") return format(keyToDate(key), "MMMM yyyy");
  return format(keyToDate(key), "d MMM yyyy");
}

/** "Daily", "Monthly" or "Yearly", for card descriptions. */
export function stepWord(view: DashboardView): string {
  return { day: "Daily", month: "Monthly", year: "Yearly" }[view];
}

/** The resolved range, the way a person would say it. */
export function rangeLabel(view: DashboardView, from: string, to: string) {
  if (view === "year") {
    const a = from.slice(0, 4);
    const b = to.slice(0, 4);
    return a === b ? a : `${a} – ${b}`;
  }
  if (view === "month") {
    const a = format(keyToDate(from.slice(0, 7)), "MMM yyyy");
    const b = format(keyToDate(to.slice(0, 7)), "MMM yyyy");
    return a === b ? a : `${a} – ${b}`;
  }
  const a = format(keyToDate(from), "d MMM yyyy");
  const b = format(keyToDate(to), "d MMM yyyy");
  return a === b ? a : `${a} – ${b}`;
}

/**
 * A bar opens the step below it: a year opens its twelve months, a month its
 * days. A day is as fine as the dashboard goes.
 */
export function drillInto(
  view: DashboardView,
  key: string,
): PeriodSelection | null {
  if (view === "year") return { view: "month", from: `${key}-01-01`, to: `${key}-12-31` };
  if (view === "month") {
    const [y, m] = key.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return { view: "day", from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
  }
  return null;
}
