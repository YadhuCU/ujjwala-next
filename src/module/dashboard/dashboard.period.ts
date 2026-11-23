import { BadRequestError } from "@/lib/errors";
import { businessDayKey } from "@/lib/business-day";

/**
 * What the dashboard is looking at, and in what steps.
 *
 * - `day`   — any date range, one bucket per day.
 * - `month` — a range of whole months, one bucket per month.
 * - `year`  — a range of whole years, one bucket per year.
 *
 * Every figure on the dashboard covers the resolved range, and every chart has
 * one bar per bucket, so switching the view changes what the whole page means
 * rather than just the x-axis. All keys are India dates (`business-day.ts`).
 */
export const DASHBOARD_VIEWS = ["day", "month", "year"] as const;
export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back each view looks when no range is given. */
const DEFAULT_SPAN: Record<DashboardView, number> = {
  day: 30,
  month: 12,
  year: 5,
};

/** A range big enough to make the chart unreadable is refused, not drawn. */
const MAX_BUCKETS: Record<DashboardView, number> = {
  day: 400,
  month: 120,
  year: 50,
};

const CURRENT_LABEL: Record<DashboardView, string> = {
  day: "Today",
  month: "This month",
  year: "This year",
};

// ─── PURE HELPERS ────────────────────────────────────────────────────────────

/** The first instant of an India calendar date, given as `yyyy-mm-dd`. */
function istStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000+05:30`);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Last calendar day of a month, as `yyyy-mm-dd`. */
function lastDayOfMonth(year: number, month: number): string {
  // Day 0 of the next month is the last day of this one (UTC, so no drift)
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(day)}`;
}

function addMonths(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function addDaysToKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** The bucket a `yyyy-mm-dd` date falls in, for the given view. */
export function bucketKeyOf(view: DashboardView, dateKey: string): string {
  if (view === "year") return dateKey.slice(0, 4);
  if (view === "month") return dateKey.slice(0, 7);
  return dateKey;
}

// ─── RESOLVE ─────────────────────────────────────────────────────────────────

export type DashboardPeriod = {
  view: DashboardView;
  /** First and last India date covered, `yyyy-mm-dd`, inclusive. */
  from: string;
  to: string;
  startDate: Date;
  endDate: Date;
  /** Bucket keys in order: `yyyy-mm-dd`, `yyyy-mm` or `yyyy`. */
  buckets: string[];
  /** The bucket holding today, which the headline cards call out. */
  currentKey: string;
  currentLabel: string;
};

/**
 * Turns the view and the (optional) picked dates into whole buckets.
 *
 * A month view widens `from` to the 1st and `to` to the month's last day; a
 * year view to 1 Jan and 31 Dec. With nothing picked it looks back over the
 * last 30 days, 12 months or 5 years, ending in the current one.
 */
export function resolvePeriod(
  view: DashboardView,
  from?: string,
  to?: string,
  now: Date = new Date(),
): DashboardPeriod {
  const today = businessDayKey(now);

  let fromKey: string;
  let toKey: string;

  if (view === "day") {
    toKey = to ?? today;
    fromKey = from ?? addDaysToKey(toKey, -(DEFAULT_SPAN.day - 1));
  } else if (view === "month") {
    const end = (to ?? today).slice(0, 7);
    const [endYear, endMonth] = end.split("-").map(Number);
    const start = from
      ? from.slice(0, 7)
      : (() => {
          const m = addMonths(endYear, endMonth, -(DEFAULT_SPAN.month - 1));
          return `${m.year}-${pad(m.month)}`;
        })();
    fromKey = `${start}-01`;
    toKey = lastDayOfMonth(endYear, endMonth);
  } else {
    const endYear = Number((to ?? today).slice(0, 4));
    const startYear = from
      ? Number(from.slice(0, 4))
      : endYear - (DEFAULT_SPAN.year - 1);
    fromKey = `${startYear}-01-01`;
    toKey = `${endYear}-12-31`;
  }

  if (fromKey > toKey)
    throw new BadRequestError("The start of the period is after its end");

  const buckets: string[] = [];
  if (view === "day") {
    for (let key = fromKey; key <= toKey; key = addDaysToKey(key, 1)) {
      buckets.push(key);
      if (buckets.length > MAX_BUCKETS.day) break;
    }
  } else if (view === "month") {
    let [year, month] = fromKey.split("-").map(Number);
    const last = toKey.slice(0, 7);
    while (`${year}-${pad(month)}` <= last) {
      buckets.push(`${year}-${pad(month)}`);
      if (buckets.length > MAX_BUCKETS.month) break;
      ({ year, month } = addMonths(year, month, 1));
    }
  } else {
    for (let y = Number(fromKey.slice(0, 4)); y <= Number(toKey.slice(0, 4)); y++) {
      buckets.push(String(y));
      if (buckets.length > MAX_BUCKETS.year) break;
    }
  }

  if (buckets.length > MAX_BUCKETS[view])
    throw new BadRequestError(
      `That period is too long for the ${view} view — pick at most ${MAX_BUCKETS[view]} ${view}s`,
    );

  return {
    view,
    from: fromKey,
    to: toKey,
    startDate: istStart(fromKey),
    endDate: new Date(istStart(toKey).getTime() + DAY_MS - 1),
    buckets,
    currentKey: bucketKeyOf(view, today),
    currentLabel: CURRENT_LABEL[view],
  };
}
