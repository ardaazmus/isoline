import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { addDays, localDay, todayLocal } from "./dates";

describe("localDay", () => {
  it("returns the viewer's calendar day of a timestamp", () => {
    const d = new Date(2026, 9, 18, 1, 30); // 18 Oct 2026, 01:30 local
    expect(localDay(d.toISOString())).toBe("2026-10-18");
  });
  it("passes through a plain date and survives bad input", () => {
    expect(localDay("2026-10-18")).toMatch(/^2026-10-1[78]$/);
    expect(localDay("not a date")).toBe("not a date");
  });
});

describe("todayLocal and addDays", () => {
  it("formats the local calendar day", () => {
    expect(todayLocal(new Date(2026, 9, 19, 23, 59))).toBe("2026-10-19");
    expect(todayLocal(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });
  it("moves across month and year ends and leap days", () => {
    expect(addDays("2026-10-17", 90)).toBe("2027-01-15");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
  it("property: going forward then back returns the same day", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date(2000, 0, 1), max: new Date(2099, 11, 31), noInvalidDate: true }), fc.integer({ min: -2000, max: 2000 }), (d, n) => {
        const day = todayLocal(d);
        expect(addDays(addDays(day, n), -n)).toBe(day);
      }),
    );
  });
});
