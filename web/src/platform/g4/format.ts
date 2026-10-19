/** Display helpers for metric facts (server and client): metric labels, numbers, digests. */
type T = (key: string, vars?: Record<string, string | number>) => string;

/** "ghg.scope2.location" → its label; dynamic keys (scope 3 category, CN code) take the number as a variable. */
export function metricLabel(t: T, key: string): string {
  const cat = /^ghg\.scope3\.cat(\d+)$/.exec(key);
  if (cat) return t("pf.calc.m.scope3_cat", { n: cat[1] });
  const cb = /^cbam\.(see|embedded)\.(\d+)$/.exec(key);
  if (cb) return t(`pf.calc.m.cbam_${cb[1]}`, { cn: cb[2] });
  return t(`pf.calc.m.${key.replace(/\./g, "_")}`);
}

/** A fact value in the reader's locale: ratios as percent, large values without needless decimals. */
export function factValue(lang: string, value: string | number | null, unit: string): string {
  if (value === null) return "—";
  const v = Number(value);
  if (unit === "ratio") return new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 }).format(v);
  const digits = Math.abs(v) >= 1000 ? 0 : Math.abs(v) >= 1 ? 2 : 4;
  return new Intl.NumberFormat(lang, { maximumFractionDigits: digits }).format(v);
}

export const shortDigest = (d: string | null | undefined) => (d ? `${d.slice(0, 10)}…` : "—");

export const FACT_TONE: Record<string, "neutral" | "ok" | "warn" | "crit" | "info"> = { validating: "crit", ready_for_review: "warn", approved: "ok", locked: "info", superseded: "neutral", rejected: "neutral" };
