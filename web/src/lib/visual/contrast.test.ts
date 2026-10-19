/**
 * G8-07 (WCAG 2.2 AA, SC 1.4.3 / 1.4.11): the text and status colours of the design tokens meet the contrast
 * minimum on the light surfaces they are used on, and motion stops under prefers-reduced-motion. A token change
 * that breaks contrast fails here before it reaches a screen.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("design token contrast (WCAG 2.2 AA)", () => {
  it("the formula matches known values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  const surfaces = ["paper", "paper-2", "b-50"];
  const text = ["ink", "ink-2", "ink-3", "b-700", "crit", "warn", "ok", "accent-ink"];
  for (const s of surfaces)
    for (const t of text)
      it(`--${t} on --${s} ≥ 4.5:1 (normal text)`, () => {
        expect(contrast(token(t), token(s))).toBeGreaterThanOrEqual(4.5);
      });

  it("white text on the primary button ≥ 4.5:1", () => {
    expect(contrast("#ffffff", token("b-600"))).toBeGreaterThanOrEqual(4.5);
  });

  it("the focus ring and strong rules reach 3:1 against the page (non-text contrast)", () => {
    expect(contrast(token("focus"), token("paper"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("rule-strong"), token("paper"))).toBeGreaterThanOrEqual(3);
  });

  it("motion stops when the person asks for reduced motion", () => {
    expect((css.match(/prefers-reduced-motion:\s*reduce/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
