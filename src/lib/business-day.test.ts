import { afterEach, describe, expect, it } from "vitest";
import {
  addBusinessDays,
  businessDayKey,
  endOfBusinessDay,
  startOfBusinessDay,
} from "./business-day";

// The whole point is that none of this depends on the server's timezone.
const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

describe("businessDayKey", () => {
  // 02:00 in Kochi is still the previous day in UTC — the bug being fixed.
  it("puts an early-morning sale in India on the Indian day", () => {
    const twoAmIst = new Date("2026-09-28T20:30:00.000Z"); // 29 Sep 02:00 IST
    expect(businessDayKey(twoAmIst)).toBe("2026-09-29");
  });

  it("puts a late-evening sale on the same Indian day", () => {
    const elevenPmIst = new Date("2026-09-29T17:30:00.000Z"); // 29 Sep 23:00 IST
    expect(businessDayKey(elevenPmIst)).toBe("2026-09-29");
  });

  it("gives the same answer whatever the server timezone is", () => {
    const instant = new Date("2026-09-28T20:30:00.000Z");

    for (const tz of ["UTC", "Asia/Kolkata", "America/New_York", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      expect(businessDayKey(instant), tz).toBe("2026-09-29");
    }
  });
});

describe("start and end of the business day", () => {
  it("runs from 00:00 to 23:59:59.999 India time", () => {
    const noonIst = new Date("2026-09-29T06:30:00.000Z");

    expect(startOfBusinessDay(noonIst).toISOString()).toBe("2026-09-28T18:30:00.000Z");
    expect(endOfBusinessDay(noonIst).toISOString()).toBe("2026-09-29T18:29:59.999Z");
  });

  // What arrives from a date picker or `z.coerce.date()` on "2026-09-29".
  it("treats a bare date as that calendar day in India", () => {
    const bareDate = new Date("2026-09-29");

    expect(businessDayKey(bareDate)).toBe("2026-09-29");
    expect(startOfBusinessDay(bareDate).toISOString()).toBe("2026-09-28T18:30:00.000Z");
  });

  it("covers exactly one day with no gap or overlap", () => {
    const day = new Date("2026-09-29T06:30:00.000Z");
    const next = addBusinessDays(day, 1);

    expect(startOfBusinessDay(next).getTime()).toBe(endOfBusinessDay(day).getTime() + 1);
  });
});
