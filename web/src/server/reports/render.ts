/**
 * One formatting rule for every output of a release (plan 09 §10.6, plan 10 §7): the DOCX text, the CSV and XLSX
 * tables, the SVG chart labels and the screen use the same function, so a number cannot differ between them.
 * Locale follows the report language (tr: 1.234,5 · en: 1,234.5).
 */

import { numberFormat } from "../../lib/intl";
export type FactValue = { metricKey: string; value: string | null; text: string | null; unit: string; suppressed?: boolean };

const LOCALE: Record<string, string> = { tr: "tr-TR", en: "en-GB" };

export function decimals(unit: string, v: number): number {
  if (unit === "TRY") return 2;
  if (unit === "ratio") return 1;
  const a = Math.abs(v);
  return a >= 1000 ? 0 : a >= 1 ? 2 : 4;
}

/** "3660,123" → "3.660" (tr) / "3,660" (en); a ratio as a percentage; a suppressed value is never printed. */
export function formatValue(lang: string, f: Pick<FactValue, "value" | "text" | "unit" | "suppressed">): string {
  if (f.suppressed) return lang === "tr" ? "gizli (küçük grup)" : "suppressed (small group)";
  if (f.value === null) return f.text ?? "—";
  const v = Number(f.value);
  if (f.unit === "ratio") return numberFormat(LOCALE[lang] ?? lang, { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 0 }).format(v);
  const d = decimals(f.unit, v);
  return numberFormat(LOCALE[lang] ?? lang, { maximumFractionDigits: d, minimumFractionDigits: f.unit === "TRY" ? 2 : 0 }).format(v);
}

export const unitLabel = (unit: string) => (unit === "ratio" ? "" : unit.replace("CO2", "CO₂"));
export const withUnit = (lang: string, f: FactValue) => {
  const u = unitLabel(f.unit);
  return u && !f.suppressed && f.value !== null ? `${formatValue(lang, f)} ${u}` : formatValue(lang, f);
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Horizontal bar chart as standalone SVG with a title, a description and the formatted value on every bar. */
export function barChartSvg(lang: string, title: string, rows: { label: string; fact: FactValue }[]): string {
  const W = 720;
  const rowH = 44;
  const left = 230;
  const top = 56;
  const H = top + rows.length * rowH + 24;
  const max = Math.max(1, ...rows.map((r) => Math.abs(Number(r.fact.value ?? 0))));
  const bars = rows
    .map((r, i) => {
      const v = Math.abs(Number(r.fact.value ?? 0));
      const w = Math.max(2, ((W - left - 140) * v) / max);
      const y = top + i * rowH;
      return `<g><text x="${left - 12}" y="${y + 22}" text-anchor="end" font-size="14" fill="#13233A">${esc(r.label)}</text><rect x="${left}" y="${y + 6}" width="${w.toFixed(1)}" height="24" rx="4" fill="#2F4FE0"/><text x="${(left + w + 8).toFixed(1)}" y="${y + 23}" font-size="14" fill="#13233A">${esc(withUnit(lang, r.fact))}</text></g>`;
    })
    .join("");
  const desc = rows.map((r) => `${r.label}: ${withUnit(lang, r.fact)}`).join("; ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d"><title id="t">${esc(title)}</title><desc id="d">${esc(desc)}</desc><rect width="${W}" height="${H}" fill="#FFFFFF"/><text x="24" y="32" font-size="17" font-weight="600" fill="#13233A">${esc(title)}</text>${bars}</svg>`;
}

/** CSV with a BOM; ";" for Turkish (Excel's list separator there), "," otherwise; cells guarded against formulas. */
export function csv(lang: string, header: string[], rows: string[][]): string {
  const sep = lang === "tr" ? ";" : ",";
  const cell = (s: string) => {
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[";,\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(sep)).join("\r\n") + "\r\n";
}
