import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { easeOut, formatShape, parseShape } from "./countup";
import { makeFormatters } from "@/i18n/core";

const LOCALES = [
  { code: "tr", intl: "tr-TR" },
  { code: "en", intl: "en-GB" },
];

describe("count-up figure shapes", () => {
  it("reads real formatter output and renders the same text back at the final value", () => {
    for (const { code, intl } of LOCALES) {
      const fmt = makeFormatters(code);
      fc.assert(
        fc.property(fc.double({ min: 0, max: 1e9, noNaN: true }), fc.integer({ min: 0, max: 3 }), (v, d) => {
          for (const text of [fmt.number(v, d), fmt.percent(v / 1e9, d), fmt.currency(v), fmt.compact(v)]) {
            const shape = parseShape(text, intl);
            expect(shape, text).not.toBeNull();
            expect(formatShape(shape!, shape!.value, intl)).toBe(text);
          }
        }),
      );
    }
  });

  it("keeps decimals and affixes while counting", () => {
    const s = parseShape("%23,9", "tr-TR")!;
    expect(s).toMatchObject({ prefix: "%", suffix: "", value: 23.9, decimals: 1 });
    expect(formatShape(s, 4.25, "tr-TR")).toBe("%4,3");
    const e = parseShape("€8,998,049", "en-GB")!;
    expect(e.value).toBe(8998049);
    expect(formatShape(e, 1200, "en-GB")).toBe("€1,200");
  });

  it("returns null for text without a number", () => {
    expect(parseShape("Uygun", "tr-TR")).toBeNull();
    expect(parseShape("—", "en-GB")).toBeNull();
  });

  it("eases monotonically from 0 to 1", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (a, b) => {
        if (a <= b) expect(easeOut(a)).toBeLessThanOrEqual(easeOut(b));
      }),
    );
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
  });
});
