/**
 * Results of the cycle worksheets, pure: the same engines as the toolkit (lib/calc/*) run on the reviewed sheet
 * and, for the analysis area, on the cycle's approved figures — never on unapproved data.
 */
import { AR_ITEMS, type ArItem } from "@/data/annual-report";
import { classify } from "@/lib/calc/indicators";
import { taxonomyKpis, type KpiKey } from "@/lib/calc/indicators";
import { buildPathway, pathwayRates, targetGap, type PathwayYear } from "@/lib/calc/pathway";
import { etsCategory, inEts, projectEts, type EtsYear } from "@/lib/calc/ets";
import { cnCoverage, projectPortfolio, type CbamPortfolioYear, type CbamProduct } from "@/lib/calc/cbam";
import type { AnnualReportPayload, CbamCostPayload, EtsPayload, MaterialityPayload, PathwayPayload, TaxonomyPayload } from "./schemas";

// ---------------------------------------------------------------- materiality (step 1)

export type MaterialityRow = MaterialityPayload["topics"][number] & { impact: number; financial: number; material: boolean; kind: "double" | "impact" | "financial" | "none" };

export function materialityResult(p: MaterialityPayload): { rows: MaterialityRow[]; material: MaterialityRow[] } {
  const rows = p.topics.map((t) => ({ ...t, ...classify(t, p.threshold) }));
  return { rows, material: rows.filter((r) => r.material).sort((a, b) => Math.max(b.impact, b.financial) - Math.max(a.impact, a.financial)) };
}

// ---------------------------------------------------------------- taxonomy (step 3)

export type FactDraft = { metricKey: string; facilityId: null; valueNum: number; unit: string };

/** The three KPIs (turnover, CapEx, OpEx) as shares: eligible, aligned, not assessed, not eligible. */
export function taxonomyFacts(p: TaxonomyPayload): FactDraft[] {
  const k = taxonomyKpis(p.activities, p.totals, p.notAssessed);
  const out: FactDraft[] = [];
  for (const key of ["turnover", "capex", "opex"] as KpiKey[]) {
    if (!(p.totals[key] > 0)) continue;
    const r = k[key];
    out.push(
      { metricKey: `taxonomy.${key}.eligible`, facilityId: null, valueNum: r.eligible, unit: "ratio" },
      { metricKey: `taxonomy.${key}.aligned`, facilityId: null, valueNum: r.aligned, unit: "ratio" },
      { metricKey: `taxonomy.${key}.not_assessed`, facilityId: null, valueNum: r.notAssessed, unit: "ratio" },
      { metricKey: `taxonomy.${key}.not_eligible`, facilityId: null, valueNum: r.notEligible, unit: "ratio" },
    );
  }
  return out;
}

/** Warnings the taxonomy run records: not-assessed share above the 10 % cap, totals smaller than the activities. */
export function taxonomyWarnings(p: TaxonomyPayload): { code: string; target: string; severity: "blocker" | "warning"; detail: Record<string, unknown> }[] {
  const k = taxonomyKpis(p.activities, p.totals, p.notAssessed);
  const out: { code: string; target: string; severity: "blocker" | "warning"; detail: Record<string, unknown> }[] = [];
  for (const key of ["turnover", "capex", "opex"] as KpiKey[]) {
    const sum = p.activities.filter((a) => a.eligible).reduce((s, a) => s + a[key], 0);
    if (sum > p.totals[key] * 1.005) out.push({ code: "taxonomy_exceeds_total", target: key, severity: "blocker", detail: { activities: sum, total: p.totals[key] } });
    if (p.totals[key] > 0 && !k[key].notAssessedWithinCap) out.push({ code: "taxonomy_not_assessed_cap", target: key, severity: "warning", detail: { share: k[key].notAssessed } });
  }
  return out;
}

// ---------------------------------------------------------------- annual report checklist (step 6)

export function annualReportItems(profile: AnnualReportPayload["profile"]): ArItem[] {
  return AR_ITEMS.filter((i) => i.profiles.includes(profile));
}

/** Every item of the profile marked: met, or not applicable with a reason. "missing" or unmarked keeps it open. */
export function annualReportStatus(p: AnnualReportPayload) {
  const items = annualReportItems(p.profile);
  let met = 0,
    na = 0,
    missing = 0,
    unmarked = 0,
    naWithoutReason = 0;
  for (const i of items) {
    const v = p.items[i.id];
    if (!v) unmarked++;
    else if (v.status === "met") met++;
    else if (v.status === "missing") missing++;
    else {
      na++;
      if (!v.note?.trim()) naWithoutReason++;
    }
  }
  return { total: items.length, met, na, missing, unmarked, naWithoutReason, complete: missing === 0 && unmarked === 0 && naWithoutReason === 0 };
}

/** Annual-report templates (TTK minimum content and the listed-company variant). */
export const ANNUAL_REPORT_TEMPLATES: Record<string, AnnualReportPayload["profile"]> = { ar_ttk: "ttk", ar_listed: "listed" };

// ---------------------------------------------------------------- analysis (alongside the cycle)

export type ApprovedFact = { metricKey: string; facilityId: string | null; boundaryKind: string | null; value: number | null };

const groupValue = (facts: ApprovedFact[], key: string) => {
  const g = facts.filter((f) => f.metricKey === key && f.facilityId === null && f.value !== null);
  return (g.find((f) => f.boundaryKind === "ghg_operational_control") ?? g[0])?.value ?? null;
};

/** Scope 1+2 (location-based) and scope 3 of a cycle's approved figures. */
export function inventoryOf(facts: ApprovedFact[]): { scope12: number | null; scope3: number | null; scope2Share: number | null } {
  const s1 = groupValue(facts, "ghg.scope1");
  const s2 = groupValue(facts, "ghg.scope2.location");
  const s3 = groupValue(facts, "ghg.scope3");
  const scope12 = s1 === null && s2 === null ? null : (s1 ?? 0) + (s2 ?? 0);
  return { scope12, scope3: s3, scope2Share: scope12 && scope12 > 0 && s2 !== null ? s2 / scope12 : null };
}

export type PathwayResult = { rows: PathwayYear[]; gap: number; rates: { scope12: number; wb2c: number }; base: { scope12: number; scope3: number; fromCycle: boolean }; actual: { year: number; value: number } | null } | { missing: "base" };

/** The 1.5 °C / WB2C pathway from the sheet, the base year from the approved base-year cycle when not typed in. */
export function pathwayFrom(p: PathwayPayload, current: { year: number; facts: ApprovedFact[] }, baseCycle: ApprovedFact[] | null): PathwayResult {
  const fromBase = baseCycle ? inventoryOf(baseCycle) : null;
  const scope12 = p.baseScope12 ?? fromBase?.scope12 ?? null;
  if (scope12 === null) return { missing: "base" };
  const scope3 = p.baseScope3 ?? fromBase?.scope3 ?? 0;
  const input = { baseYear: p.baseYear, baseScope12: scope12, baseScope3: scope3, scope2Share: p.scope2Share ?? fromBase?.scope2Share ?? undefined, targetYear: p.targetYear, bauGrowth: p.bauGrowth, measures: p.measures, actuals: [] };
  const rows = buildPathway(input);
  const now = inventoryOf(current.facts);
  const actual = now.scope12 === null ? null : { year: current.year, value: now.scope12 + (now.scope3 ?? 0) };
  return { rows, gap: targetGap(rows, p.targetYear), rates: pathwayRates(input), base: { scope12, scope3, fromCycle: p.baseScope12 === null }, actual };
}

export type EtsResult = { emissions: number; source: "sheet" | "ets" | "scope1"; category: ReturnType<typeof etsCategory>; covered: boolean; years: EtsYear[] } | { missing: "emissions" };

/** TR ETS category and the allowance balance from the approved verified emissions (else scope 1). */
export function etsFrom(p: EtsPayload, facts: ApprovedFact[], year: number): EtsResult {
  const verified = facts.filter((f) => f.metricKey === "ets.verified_emissions" && f.facilityId !== null && f.value !== null).reduce((s, f) => s + f.value!, 0);
  const scope1 = groupValue(facts, "ghg.scope1");
  const emissions = p.emissions ?? (verified > 0 ? verified : scope1);
  if (emissions === null) return { missing: "emissions" };
  const source = p.emissions !== null ? "sheet" : verified > 0 ? "ets" : "scope1";
  const category = etsCategory(emissions);
  const rateByYear: Record<number, number> = {};
  for (let y = year; y <= year + 8; y++) rateByYear[y] = p.freeRate;
  const years = projectEts({ sector: p.sector, emissions, emissionsGrowth: p.emissionsGrowth, activity: p.activity, activityGrowth: p.activityGrowth, benchmark: p.benchmark, rateByYear, coefficient: p.coefficient, price: p.price, priceGrowth: p.priceGrowth }, year, year + 8);
  return { emissions, source, category, covered: inEts(category), years };
}

/** CBAM products from the approved CBAM run: one per facility and CN code (tonnes = embedded ÷ specific). */
export function cbamProductsFrom(facts: ApprovedFact[], growth: number): CbamProduct[] {
  const out: CbamProduct[] = [];
  for (const f of facts) {
    const m = /^cbam\.see\.(.+)$/.exec(f.metricKey);
    if (!m || f.facilityId === null || !f.value || f.value <= 0) continue;
    const cn = m[1];
    const embedded = facts.find((x) => x.metricKey === `cbam.embedded.${cn}` && x.facilityId === f.facilityId)?.value ?? null;
    const cov = cnCoverage(cn);
    if (embedded === null || cov.status === "not_covered" || cov.status === "invalid") continue;
    out.push({ id: `${f.facilityId}:${cn}`, name: cn, cn, sector: cov.sector, tonnes: embedded / f.value, growth, seeDirect: f.value, seeIndirect: 0, defaultSee: 0, useDefault: false, benchmark: 0, bmMode: "official" });
  }
  return out;
}

export function cbamFrom(p: CbamCostPayload, facts: ApprovedFact[]): { products: CbamProduct[]; years: CbamPortfolioYear[] } | { missing: "cbam" } {
  const products = cbamProductsFrom(facts, p.growth);
  if (!products.length) return { missing: "cbam" };
  return { products, years: projectPortfolio(products, { startPrice: p.startPrice, priceGrowth: p.priceGrowth, originCarbonPrice: p.originCarbonPrice, eurTry: p.eurTry }) };
}
