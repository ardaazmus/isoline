import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { csvSafe, csvUnsafe, toCsv } from "./export";

describe("CSV export", () => {
  it("neutralises text that a spreadsheet would run as a formula", () => {
    const csv = toCsv(["note"], [["=HYPERLINK(\"http://x\")"], ["+1+1"], ["@SUM(A1)"], ["-2+3"], ["\tx"]]);
    const cells = csv.replace(/^\uFEFF/, "").split("\r\n").slice(1);
    expect(cells).toEqual(['"\'=HYPERLINK(""http://x"")"', "'+1+1", "'@SUM(A1)", "'-2+3", "'\tx"]);
  });
  it("keeps numbers as numbers, negative ones and decimal strings included", () => {
    const csv = toCsv(["a", "b", "c"], [[-5, "-12,5", "1e-3"]]);
    expect(csv.split("\r\n")[1]).toBe('-5;"-12,5";1e-3');
  });
  it("property: csvUnsafe undoes csvSafe for any text", () => {
    const text = fc.oneof(fc.string(), fc.tuple(fc.constantFrom("", "'", "''", "'''"), fc.constantFrom("=", "+", "-", "@", "\t", "\r"), fc.string()).map((p) => p.join("")));
    fc.assert(
      fc.property(text, (s) => {
        // text this app wrote comes back unchanged, including text that already began with "'="
        expect(csvUnsafe(csvSafe(s))).toBe(s);
      }),
    );
  });
  it("escapes an existing apostrophe prefix once more", () => {
    expect(csvSafe("'=1+1")).toBe("''=1+1");
    expect(csvUnsafe("''=1+1")).toBe("'=1+1");
    expect(csvSafe("'note")).toBe("'note");
  });
});
