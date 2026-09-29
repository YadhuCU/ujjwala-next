/**
 * Day boundaries in the agency's own time, not the server's.
 *
 * "Today", "this date range" and "which day did this sale happen on" were
 * worked out with `setHours(0, 0, 0, 0)` and `toISOString()`, which use the
 * server's timezone and UTC respectively. On a laptop in India that happens to
 * be right. On Vercel the server runs in UTC, five and a half hours behind, so
 * a sale at 02:00 in Kochi landed on the previous day and "today" began at
 * 05:30.
 *
 * India Standard Time is UTC+05:30 all year — no daylight saving — so a fixed
 * offset is exact, and needs no timezone database.
 */

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `yyyy-mm-dd` of the business day this instant falls in. */
export function businessDayKey(instant: Date): string {
  return new Date(instant.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The first instant of the business day containing `instant`. */
export function startOfBusinessDay(instant: Date): Date {
  const key = businessDayKey(instant);
  return new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_OFFSET_MS);
}

/** The last instant of the business day containing `instant`. */
export function endOfBusinessDay(instant: Date): Date {
  return new Date(startOfBusinessDay(instant).getTime() + DAY_MS - 1);
}

/** Whole business days later (or earlier, if negative). */
export function addBusinessDays(instant: Date, days: number): Date {
  return new Date(instant.getTime() + days * DAY_MS);
}
