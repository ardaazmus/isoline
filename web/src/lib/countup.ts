/**
 * Count-up support for already formatted figures ("%23,9", "1,9 Mn", "€8.998.049"): find the first
 * number in the text, read it with the locale's separators, and re-render any intermediate value in
 * the same shape (same decimals, grouping, prefix and suffix).
 */
export type NumberShape = { prefix: string; suffix: string; value: number; decimals: number; grouping: boolean };

const separators = new Map<string, { group: string; decimal: string }>();

export function localeSeparators(intl: string) {
  let s = separators.get(intl);
  if (!s) {
    const parts = new Intl.NumberFormat(intl).formatToParts(12345.6);
    s = { group: parts.find((p) => p.type === "group")?.value ?? ",", decimal: parts.find((p) => p.type === "decimal")?.value ?? "." };
    separators.set(intl, s);
  }
  return s;
}

const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Reads the first number in `text`; null when there is none (e.g. "Uygun", "—"). */
export function parseShape(text: string, intl: string): NumberShape | null {
  const { group, decimal } = localeSeparators(intl);
  const g = escape(group);
  const d = escape(decimal);
  const re = new RegExp(`\\d{1,3}(?:${g}\\d{3})+(?:${d}\\d+)?|\\d+(?:${d}\\d+)?`);
  const m = re.exec(text);
  if (!m) return null;
  const token = m[0];
  const grouping = token.includes(group);
  const [int, frac = ""] = token.split(decimal);
  const value = Number(int.split(group).join("") + (frac ? "." + frac : ""));
  if (!Number.isFinite(value)) return null;
  return { prefix: text.slice(0, m.index), suffix: text.slice(m.index + token.length), value, decimals: frac.length, grouping };
}

/** Renders `n` in the shape of the parsed figure. */
export function formatShape(shape: NumberShape, n: number, intl: string) {
  const body = new Intl.NumberFormat(intl, { minimumFractionDigits: shape.decimals, maximumFractionDigits: shape.decimals, useGrouping: shape.grouping }).format(n);
  return shape.prefix + body + shape.suffix;
}

/** Ease-out cubic, 0 → 1. */
export const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
