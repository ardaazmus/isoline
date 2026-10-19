import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { dateTimeFormat, numberFormat } from "./intl";

describe("shared Intl formatters", () => {
  it("builds one formatter per locale and option set", () => {
    expect(numberFormat("tr-TR", { maximumFractionDigits: 2 })).toBe(numberFormat("tr-TR", { maximumFractionDigits: 2 }));
    expect(numberFormat("tr-TR", { maximumFractionDigits: 2 })).not.toBe(numberFormat("tr-TR", { maximumFractionDigits: 0 }));
    expect(numberFormat("tr-TR")).not.toBe(numberFormat("en-GB"));
    expect(dateTimeFormat("tr-TR", { year: "numeric" })).toBe(dateTimeFormat("tr-TR", { year: "numeric" }));
  });

  it("formats exactly as a freshly built formatter", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("tr", "en", "tr-TR", "en-GB"),
        fc.double({ min: -1e9, max: 1e9, noNaN: true }),
        fc.integer({ min: 0, max: 4 }),
        fc.boolean(),
        (locale, v, digits, percent) => {
          const opts: Intl.NumberFormatOptions = percent ? { style: "percent", maximumFractionDigits: digits } : { maximumFractionDigits: digits };
          expect(numberFormat(locale, opts).format(v)).toBe(new Intl.NumberFormat(locale, opts).format(v));
        },
      ),
    );
    fc.assert(
      fc.property(fc.constantFrom("tr-TR", "en-GB"), fc.date({ min: new Date("2000-01-01"), max: new Date("2100-01-01"), noInvalidDate: true }), (locale, d) => {
        const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };
        expect(dateTimeFormat(locale, opts).format(d)).toBe(new Intl.DateTimeFormat(locale, opts).format(d));
      }),
    );
  });

  it("stops caching past its cap instead of growing without bound", () => {
    // 21 × 21 distinct option sets: more than the cap of 256
    for (let i = 1; i <= 21; i++)
      for (let d = 0; d <= 20; d++) expect(numberFormat("tr-TR", { minimumIntegerDigits: i, maximumFractionDigits: d }).format(1.5)).toBe(new Intl.NumberFormat("tr-TR", { minimumIntegerDigits: i, maximumFractionDigits: d }).format(1.5));
    // a further option set still formats correctly, but is built anew on each call rather than kept
    const opts = { maximumSignificantDigits: 3 };
    expect(numberFormat("en-GB", opts).format(1234)).toBe("1,230");
    expect(numberFormat("en-GB", opts)).not.toBe(numberFormat("en-GB", opts));
  });
});
