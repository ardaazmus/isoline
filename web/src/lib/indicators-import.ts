/**
 * Bulk import of environment, safety and workforce indicators from a long-format sheet: one row per
 * indicator, site and period. Rows are aggregated the way each indicator behaves:
 *   flow        summed over every row (energy, water, waste, hours worked, injuries, leavers, training)
 *   stock_end   per site the latest period, then summed over sites (year-end headcount, women, managers)
 *   stock_start per site the earliest period, then summed over sites (start-of-year headcount)
 *   single      one company-wide value (average pay, revenue, water-stress share)
 * Units are converted to the unit the app stores (GJ, m³, t, m TRY…).
 */
import type { EnvInput, SafetyInput, WorkforceInput } from "./calc/indicators";
import { parseNumber } from "./inventory-csv";

export type IndicatorGroup = "env" | "safety" | "workforce";
type Kind = "flow" | "stock_end" | "stock_start" | "single";
type Field = { env: keyof EnvInput; safety: keyof SafetyInput; workforce: keyof WorkforceInput };

export type IndicatorDef = {
  key: string;
  group: IndicatorGroup;
  field: Field[IndicatorGroup];
  kind: Kind;
  /** Unit stored in the app; the first entry of `units` is it, with factor 1. */
  units: Record<string, number>;
};

const GJ = { gj: 1, mj: 0.001, tj: 1000, kwh: 0.0036, mwh: 3.6, gwh: 3600, toe: 41.868, tep: 41.868 };
const M3 = { m3: 1, ml: 1000, megalitre: 1000, l: 0.001, litre: 0.001 };
const T = { t: 1, ton: 1, tonne: 1, kg: 0.001 };
const COUNT = { "": 1, count: 1, adet: 1, kişi: 1, people: 1, person: 1 };
const HOURS = { h: 1, saat: 1, hours: 1 };
const DAYS = { gün: 1, days: 1, day: 1 };
const TRY = { try: 1, tl: 1, "₺": 1 };
const MTRY = { "mn tl": 1, "mntl": 1, "milyon tl": 1, "try m": 1, "m try": 1, tl: 1e-6, try: 1e-6 };
const SHARE = { share: 1, oran: 1, "%": 0.01 };

export const INDICATORS: IndicatorDef[] = [
  { key: "energy", group: "env", field: "energyGj", kind: "flow", units: GJ },
  { key: "renewable_energy", group: "env", field: "renewableGj", kind: "flow", units: GJ },
  { key: "water_withdrawal", group: "env", field: "waterWithdrawalM3", kind: "flow", units: M3 },
  { key: "water_discharge", group: "env", field: "waterDischargeM3", kind: "flow", units: M3 },
  { key: "water_stress_share", group: "env", field: "waterStressShare", kind: "single", units: SHARE },
  { key: "waste_total", group: "env", field: "wasteTotalT", kind: "flow", units: T },
  { key: "waste_recovered", group: "env", field: "wasteRecoveredT", kind: "flow", units: T },
  { key: "waste_hazardous", group: "env", field: "wasteHazardousT", kind: "flow", units: T },
  { key: "revenue", group: "env", field: "revenueMillionTry", kind: "single", units: MTRY },
  { key: "hours_worked", group: "safety", field: "hoursWorked", kind: "flow", units: HOURS },
  { key: "lost_time_injuries", group: "safety", field: "lostTimeInjuries", kind: "flow", units: COUNT },
  { key: "recordable_injuries", group: "safety", field: "recordables", kind: "flow", units: COUNT },
  { key: "lost_days", group: "safety", field: "lostDays", kind: "flow", units: DAYS },
  { key: "fatalities", group: "safety", field: "fatalities", kind: "flow", units: COUNT },
  { key: "headcount_start", group: "workforce", field: "headcountStart", kind: "stock_start", units: COUNT },
  { key: "headcount_end", group: "workforce", field: "headcountEnd", kind: "stock_end", units: COUNT },
  { key: "leavers", group: "workforce", field: "leavers", kind: "flow", units: COUNT },
  { key: "training_hours", group: "workforce", field: "trainingHours", kind: "flow", units: HOURS },
  { key: "women", group: "workforce", field: "women", kind: "stock_end", units: COUNT },
  { key: "managers", group: "workforce", field: "managers", kind: "stock_end", units: COUNT },
  { key: "women_managers", group: "workforce", field: "womenManagers", kind: "stock_end", units: COUNT },
  { key: "avg_pay_men", group: "workforce", field: "avgPayMen", kind: "single", units: TRY },
  { key: "avg_pay_women", group: "workforce", field: "avgPayWomen", kind: "single", units: TRY },
];

/** Withdrawal from water-stressed areas, m³; turned into the water-stress share of total withdrawal. */
export const STRESSED_WITHDRAWAL: { key: string; units: Record<string, number> } = { key: "water_withdrawal_stressed", units: M3 };

const DEF = Object.fromEntries(INDICATORS.map((d) => [d.key, d])) as Record<string, IndicatorDef>;

export const INDICATOR_COLUMNS = ["indicator", "site", "period", "value", "unit", "source"] as const;

export type IndicatorIssue = { row: number; key: string; vars?: Record<string, string | number> };

export type IndicatorValue = { key: string; group: IndicatorGroup; field: string; value: number; rows: number; sites: number };

export type IndicatorImport = {
  values: IndicatorValue[];
  patch: { env: Partial<EnvInput>; safety: Partial<SafetyInput>; workforce: Partial<WorkforceInput> };
  issues: IndicatorIssue[];
  rows: number;
};

const normUnit = (u: string) =>
  u
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/³/g, "3")
    .replace(/\s+/g, " ")
    .replace(/^ton(ne)?s?$/, "t");

/**
 * Period as a sortable "YYYY-MM" (or "YYYY"); accepts 2026, 2026-03, 2026/3, 03.2026, 3/2026.
 * Returns null for anything else and "" for an empty cell.
 */
export function normPeriod(raw: string): string | null {
  const s = raw.trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})$/);
  if (m) return m[1];
  m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return `${m[2]}-${m[1].padStart(2, "0")}`;
  return null;
}

type Row = { n: number; site: string; period: string; value: number };

/** Reads indicator rows (header within the first 10 rows) and aggregates them per indicator. */
export function importIndicatorRows(grid: string[][]): IndicatorImport {
  const out: IndicatorImport = { values: [], patch: { env: {}, safety: {}, workforce: {} }, issues: [], rows: 0 };
  const h = grid.slice(0, 10).findIndex((r) => r.some((c) => c.trim().toLowerCase() === "indicator") && r.some((c) => c.trim().toLowerCase() === "value"));
  if (h < 0) {
    out.issues.push({ row: grid.length ? 1 : 0, key: grid.length ? "missingColumns" : "empty", vars: { cols: "indicator, value" } });
    return out;
  }
  const header = grid[h].map((c) => c.trim().toLowerCase());
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  const byKey = new Map<string, Row[]>();
  grid.slice(h + 1).forEach((r, idx) => {
    const n = h + idx + 2;
    if (!r.some((c) => c.trim())) return;
    out.rows++;
    const key = col(r, "indicator").toLowerCase();
    const units = key === STRESSED_WITHDRAWAL.key ? STRESSED_WITHDRAWAL.units : DEF[key]?.units;
    if (!units) return void out.issues.push({ row: n, key: "badIndicator", vars: { value: col(r, "indicator") } });
    const raw = parseNumber(col(r, "value"));
    if (!Number.isFinite(raw) || raw < 0) return void out.issues.push({ row: n, key: "badValue", vars: { value: col(r, "value") } });
    const unit = normUnit(col(r, "unit"));
    const base = Object.keys(units)[0];
    const factor = unit === "" ? 1 : units[unit];
    if (factor === undefined) return void out.issues.push({ row: n, key: "badUnit", vars: { value: col(r, "unit"), allowed: Object.keys(units).filter(Boolean).join(", "), base } });
    const period = normPeriod(col(r, "period"));
    if (period === null) return void out.issues.push({ row: n, key: "badPeriod", vars: { value: col(r, "period") } });
    byKey.set(key, [...(byKey.get(key) ?? []), { n, site: col(r, "site").toLocaleLowerCase("tr"), period, value: raw * factor }]);
  });

  // Named sites only: a company-wide row (empty site) is not a site.
  const sites = (rows: Row[]) => new Set(rows.map((r) => r.site).filter(Boolean)).size;
  for (const [key, rows] of byKey) {
    if (key === STRESSED_WITHDRAWAL.key) continue;
    const def = DEF[key];
    let value: number | null = null;
    if (def.kind === "flow") value = rows.reduce((s, r) => s + r.value, 0);
    else if (def.kind === "single") {
      if (rows.length > 1) out.issues.push({ row: rows[1].n, key: "single", vars: { value: key } });
      else value = rows[0].value;
    } else {
      // Stock: one value per site, from its latest (year-end) or earliest (start-of-year) period.
      const pick = new Map<string, Row[]>();
      for (const r of rows) pick.set(r.site, [...(pick.get(r.site) ?? []), r]);
      let total = 0;
      let ok = true;
      for (const siteRows of pick.values()) {
        const periods = [...new Set(siteRows.map((r) => r.period))].sort();
        const p = def.kind === "stock_end" ? periods.at(-1) : periods[0];
        const at = siteRows.filter((r) => r.period === p);
        if (at.length > 1) {
          out.issues.push({ row: at[1].n, key: "duplicate", vars: { value: key } });
          ok = false;
        }
        total += at[0].value;
      }
      if (ok) value = total;
    }
    if (value === null) continue;
    out.values.push({ key, group: def.group, field: def.field, value, rows: rows.length, sites: sites(rows) });
    (out.patch[def.group] as Record<string, number>)[def.field] = value;
  }

  const stressed = byKey.get(STRESSED_WITHDRAWAL.key);
  if (stressed) {
    const withdrawal = out.patch.env.waterWithdrawalM3;
    if (!withdrawal) out.issues.push({ row: stressed[0].n, key: "needWithdrawal" });
    else if (out.patch.env.waterStressShare !== undefined) out.issues.push({ row: stressed[0].n, key: "stressConflict" });
    else {
      const share = Math.min(1, stressed.reduce((s, r) => s + r.value, 0) / withdrawal);
      out.patch.env.waterStressShare = share;
      out.values.push({ key: "water_stress_share", group: "env", field: "waterStressShare", value: share, rows: stressed.length, sites: sites(stressed) });
    }
  }
  const order = INDICATORS.map((d) => d.key);
  out.values.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return out;
}

/** Example rows: two sites, monthly energy, year-end headcount per site. */
export const INDICATOR_TEMPLATE_ROWS: string[][] = [
  [...INDICATOR_COLUMNS],
  ["energy", "Gebze", "2026-01", "1850", "MWh", "Sayaç okuma"],
  ["energy", "Gebze", "2026-02", "1720", "MWh", "Sayaç okuma"],
  ["energy", "İzmir", "2026", "96000", "GJ", "Doğal gaz faturası"],
  ["renewable_energy", "Gebze", "2026", "640", "MWh", "YEK-G belgesi"],
  ["water_withdrawal", "Gebze", "2026", "182000", "m3", "Belediye faturası"],
  ["water_withdrawal_stressed", "Gebze", "2026", "182000", "m3", "WRI Aqueduct: yüksek stres"],
  ["water_withdrawal", "İzmir", "2026", "41000", "m3", "Kuyu sayacı"],
  ["water_discharge", "Gebze", "2026", "150000", "m3", "Atıksu sayacı"],
  ["waste_total", "Gebze", "2026", "820", "t", "Atık beyan sistemi"],
  ["waste_recovered", "Gebze", "2026", "690", "t", "Atık beyan sistemi"],
  ["waste_hazardous", "Gebze", "2026", "35000", "kg", "Atık beyan sistemi"],
  ["hours_worked", "Gebze", "2026", "910000", "saat", "PDKS"],
  ["lost_time_injuries", "Gebze", "2026", "2", "", "İSG kayıtları"],
  ["headcount_start", "Gebze", "2026-01", "455", "", "İK"],
  ["headcount_end", "Gebze", "2026-12", "468", "", "İK"],
  ["headcount_end", "İzmir", "2026-12", "112", "", "İK"],
  ["avg_pay_men", "", "2026", "61500", "TL", "Bordro"],
];
