import { describe, expect, it } from "vitest";
import { localDay } from "./dates";

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
