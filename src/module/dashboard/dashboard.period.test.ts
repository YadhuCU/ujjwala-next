import { describe, expect, it } from "vitest";
import { bucketKeyOf, resolvePeriod } from "./dashboard.period";

// 20 Nov 2026, 01:00 in India — still the 19th in UTC
const now = new Date("2026-11-19T19:30:00.000Z");

describe("resolvePeriod — defaults", () => {
  it("day: the last 30 India days, ending today", () => {
    const p = resolvePeriod("day", undefined, undefined, now);
    expect(p.to).toBe("2026-11-20");
    expect(p.from).toBe("2026-10-22");
    expect(p.buckets).toHaveLength(30);
    expect(p.currentKey).toBe("2026-11-20");
  });

  it("month: the last 12 whole months, ending this one", () => {
    const p = resolvePeriod("month", undefined, undefined, now);
    expect(p.from).toBe("2025-12-01");
    expect(p.to).toBe("2026-11-30");
    expect(p.buckets[0]).toBe("2025-12");
    expect(p.buckets.at(-1)).toBe("2026-11");
    expect(p.buckets).toHaveLength(12);
    expect(p.currentKey).toBe("2026-11");
    expect(p.currentLabel).toBe("This month");
  });

  it("year: the last 5 whole years, ending this one", () => {
    const p = resolvePeriod("year", undefined, undefined, now);
    expect(p.buckets).toEqual(["2022", "2023", "2024", "2025", "2026"]);
    expect(p.from).toBe("2022-01-01");
    expect(p.to).toBe("2026-12-31");
  });
});

describe("resolvePeriod — picked ranges", () => {
  it("widens a month range to whole months, leap February included", () => {
    const p = resolvePeriod("month", "2028-02-17", "2028-02-03", now);
    expect(p.from).toBe("2028-02-01");
    expect(p.to).toBe("2028-02-29");
    expect(p.buckets).toEqual(["2028-02"]);
  });

  it("crosses a year boundary in months", () => {
    const p = resolvePeriod("month", "2025-11-01", "2026-02-01", now);
    expect(p.buckets).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("starts and ends on India midnight, whatever the server's zone", () => {
    const p = resolvePeriod("day", "2026-09-29", "2026-09-29", now);
    expect(p.startDate.toISOString()).toBe("2026-09-28T18:30:00.000Z");
    expect(p.endDate.toISOString()).toBe("2026-09-29T18:29:59.999Z");
  });

  it("refuses a start after the end", () => {
    expect(() => resolvePeriod("day", "2026-10-02", "2026-10-01", now)).toThrow(
      /after its end/,
    );
  });

  it("refuses a range too long to chart", () => {
    expect(() => resolvePeriod("day", "2020-01-01", "2026-01-01", now)).toThrow(
      /too long/,
    );
  });
});

describe("bucketKeyOf", () => {
  it("cuts a date down to the view's bucket", () => {
    expect(bucketKeyOf("day", "2026-11-20")).toBe("2026-11-20");
    expect(bucketKeyOf("month", "2026-11-20")).toBe("2026-11");
    expect(bucketKeyOf("year", "2026-11-20")).toBe("2026");
  });
});
