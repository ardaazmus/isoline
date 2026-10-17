import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { contrast, deltaE, simulate, type Vision } from "./color";
import { ESRS_THEME, THEMES, UI_COLORS } from "@/data/themes";

const VISIONS: Vision[] = ["normal", "protan", "deutan", "tritan"];
const hex = fc.tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 })).map((c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join(""));

describe("colour maths", () => {
  it("matches published reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(deltaE("#2f4fe0", "#2f4fe0")).toBe(0);
    // Black vs white is the largest lightness step: ΔE00 = 100.
    expect(deltaE("#000000", "#ffffff")).toBeCloseTo(100, 0);
  });

  it("deltaE is symmetric, non-negative and zero only for equal colours", () => {
    fc.assert(
      fc.property(hex, hex, (a, b) => {
        const d = deltaE(a, b);
        expect(d).toBeGreaterThanOrEqual(0);
        expect(Math.abs(d - deltaE(b, a))).toBeLessThan(1e-9);
        if (a === b) expect(d).toBe(0);
      }),
    );
  });

  it("contrast is symmetric and within 1–21", () => {
    fc.assert(
      fc.property(hex, hex, (a, b) => {
        const c = contrast(a, b);
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(21.0001);
        expect(c).toBeCloseTo(contrast(b, a), 9);
      }),
    );
  });

  it("CVD simulation keeps greys grey and returns valid hex", () => {
    fc.assert(
      fc.property(hex, fc.constantFrom(...VISIONS), (h, v) => {
        expect(simulate(h, v)).toMatch(/^#[0-9a-f]{6}$/);
      }),
    );
    for (const v of VISIONS) expect(deltaE(simulate("#808080", v), "#808080")).toBeLessThan(2);
  });
});

describe("thematic data palette", () => {
  const pairs = THEMES.flatMap((a, i) => THEMES.slice(i + 1).map((b) => [a, b] as const));

  it("keeps every pair of theme colours apart under normal and simulated colour-blind vision", () => {
    for (const v of VISIONS) {
      for (const [a, b] of pairs) {
        const d = deltaE(simulate(a.ramp.strong, v), simulate(b.ramp.strong, v));
        expect(d, `${a.id}/${b.id} (${v}) ΔE ${d.toFixed(1)}`).toBeGreaterThanOrEqual(v === "normal" ? 13.5 : 10);
      }
    }
  });

  it("never looks like an interface (cobalt) colour", () => {
    for (const t of THEMES)
      for (const [name, ui] of Object.entries(UI_COLORS)) {
        const d = deltaE(t.ramp.strong, ui);
        expect(d, `${t.id} vs ${name} ΔE ${d.toFixed(1)}`).toBeGreaterThanOrEqual(15);
      }
  });

  it("strong marks hold 3:1 on white and ink text holds 4.5:1 on its wash", () => {
    for (const t of THEMES) {
      expect(contrast(t.ramp.strong, "#ffffff"), t.id).toBeGreaterThanOrEqual(3);
      expect(contrast(t.ramp.ink, t.ramp.wash), t.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.ramp.ink, "#ffffff"), t.id).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ramps run from dark to light", () => {
    for (const t of THEMES) {
      const lum = (h: string) => contrast(h, "#000000");
      expect(lum(t.ramp.strong), t.id).toBeLessThan(lum(t.ramp.mid));
      expect(lum(t.ramp.mid), t.id).toBeLessThan(lum(t.ramp.light));
      expect(lum(t.ramp.light), t.id).toBeLessThan(lum(t.ramp.wash));
    }
  });

  it("globals.css carries exactly the palette values", () => {
    const css = readFileSync(join(__dirname, "../app/globals.css"), "utf8");
    const suffix = { strong: "", mid: "-2", light: "-3", wash: "-wash", ink: "-ink" } as const;
    for (const t of THEMES)
      for (const [tone, value] of Object.entries(t.ramp)) {
        const m = css.match(new RegExp(`--th-${t.id}${suffix[tone as keyof typeof suffix]}:\\s*(#[0-9a-f]{6});`, "i"));
        expect(m?.[1]?.toLowerCase(), `--th-${t.id}${suffix[tone as keyof typeof suffix]}`).toBe(value);
      }
  });

  it("maps every ESRS topical standard to a theme", () => {
    expect(Object.keys(ESRS_THEME).sort()).toEqual(["E1", "E2", "E3", "E4", "E5", "G1", "S1", "S2", "S3", "S4"]);
  });
});
