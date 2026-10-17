/**
 * Science-based target pathways (SBTi linear absolute contraction, Corporate Net-Zero Standard V1.3.1 and its
 * Method Appendix v1.0, both effective 14.04.2026; Near-Term Criteria V5.3.1):
 *   minimum rates: 4.2 % of base-year emissions per year for scope 1, scope 2 and scope 3 at 1.5 °C,
 *   2.5 % per year for scope 3 at well-below 2 °C;
 *   the rate is raised dynamically as the base year approaches the net-zero year (Method Appendix Eq. 1–5).
 * Long-term net-zero: ≥ 90 % absolute reduction by 2050 at the latest.
 * Net-Zero Standard V2.0 applies from 31.01.2027; its final pathways arrive Q4 2026, so V2 values are not modelled here.
 */

/** Minimum linear annual reduction rate (LARR min) for scope 1, scope 2 and 1.5 °C scope 3 targets. */
export const RATE_15C = 0.042;
/** Minimum linear annual reduction rate for well-below 2 °C scope 3 targets. */
export const RATE_WB2C = 0.025;
export const NET_ZERO_REDUCTION = 0.9;
export const NET_ZERO_YEAR = 2050;

export type SbtiTargetType = "scope1" | "scope2" | "scope3_15c" | "scope3_wb2c";

/**
 * Method Appendix Table 2: net-zero ambition (NZA), net-zero year (NZY) and LARR min per target type.
 * Table 2 lists no NZY for WB2C scope 3; its Table 1 reference rates (2.88 / 3.00 / 3.13 % for base years
 * 2024–2026) are reproduced with 2050, which is used here.
 */
export const SBTI_PARAMS: Record<SbtiTargetType, { nza: number; nzy: number; min: number }> = {
  scope1: { nza: 0.9, nzy: 2050, min: RATE_15C },
  scope2: { nza: 1, nzy: 2040, min: RATE_15C },
  scope3_15c: { nza: 0.9, nzy: 2050, min: RATE_15C },
  scope3_wb2c: { nza: 0.75, nzy: 2050, min: RATE_WB2C },
};

export type DynamicRateOptions = {
  /** Most recent inventory year (MRY); defaults to the base year. */
  mostRecentYear?: number;
  /** Emissions in the base year and the most recent year; only their ratio matters. Default: equal. */
  baseEmissions?: number;
  mostRecentEmissions?: number;
  /** The company's own net-zero year, if earlier than the pathway's. */
  netZeroYear?: number;
};

/** Eq. 1–5 without the LARR min floor: converted base-year-to-target-year rate. */
function convertedRate(type: SbtiTargetType, baseYear: number, targetYear: number, o: DynamicRateOptions = {}): number {
  const p = SBTI_PARAMS[type];
  const mry = o.mostRecentYear ?? baseYear;
  const nzy = Math.min(p.nzy, o.netZeroYear ?? p.nzy);
  const initial = p.nza / Math.max(1, nzy - mry); // Eq. 1
  const ambition = Math.min(1, initial * Math.max(0, targetYear - mry)); // Eq. 2
  const eBy = o.baseEmissions ?? 1;
  const eMry = o.mostRecentEmissions ?? eBy;
  if (eBy <= 0) return 0;
  const targetEmissions = eMry * (1 - ambition); // Eq. 3
  const converted = (eBy - targetEmissions) / eBy; // Eq. 4
  return converted / Math.max(1, targetYear - baseYear); // Eq. 5 before Max(LARR min, ·)
}

/** dLARR base year → target year (Eq. 5), floored at the target type's LARR min. */
export function dynamicRate(type: SbtiTargetType, baseYear: number, targetYear: number, o: DynamicRateOptions = {}): number {
  return Math.max(SBTI_PARAMS[type].min, convertedRate(type, baseYear, targetYear, o));
}

/**
 * Combined scope 1+2 rate: base-year-share-weighted scope 1 and scope 2 rates, floored at 4.2 %.
 * The appendix does not publish the combined sub-steps; this weighting reproduces every combined value in
 * its Table 1 (e.g. 50:50 → 4.86 / 5.13 / 5.45 %, 100:0 → 4.2 % for base years 2024–2026) when MRY = base year.
 */
export function combinedScope12Rate(baseYear: number, targetYear: number, scope2Share: number, o: DynamicRateOptions = {}): number {
  const s = Math.min(1, Math.max(0, scope2Share));
  const mixed = (1 - s) * convertedRate("scope1", baseYear, targetYear, o) + s * convertedRate("scope2", baseYear, targetYear, o);
  return Math.max(RATE_15C, mixed);
}

export function linearTarget(base: number, baseYear: number, year: number, rate: number): number {
  if (year <= baseYear) return Math.max(0, base);
  return Math.max(0, base * (1 - rate * (year - baseYear)));
}

export function requiredReduction(baseYear: number, targetYear: number, rate: number): number {
  return Math.min(1, Math.max(0, rate * (targetYear - baseYear)));
}

/** Net-zero glide: linear from base to 10 % residual in the net-zero year. */
export function netZeroPath(base: number, baseYear: number, year: number, nzYear = NET_ZERO_YEAR): number {
  if (year <= baseYear) return Math.max(0, base);
  if (year >= nzYear) return Math.max(0, base) * (1 - NET_ZERO_REDUCTION);
  const t = (year - baseYear) / (nzYear - baseYear);
  return Math.max(0, base) * (1 - NET_ZERO_REDUCTION * t);
}

export type Measure = {
  id: string;
  name: string;
  /** Annual abatement once fully running, tCO₂e/yr. */
  abatement: number;
  /** Marginal abatement cost, €/tCO₂e (negative = saves money). */
  cost: number;
  startYear: number;
  /** Years from start to full effect (linear ramp). */
  rampYears: number;
};

export function measureEffect(m: Measure, year: number): number {
  if (year < m.startYear) return 0;
  const ramp = Math.max(1, m.rampYears);
  const share = Math.min(1, (year - m.startYear + 1) / ramp);
  return Math.max(0, m.abatement) * share;
}

/** Marginal abatement cost curve: measures sorted by cost, each with its cumulative x-span. */
export function maccCurve(measures: Measure[]) {
  const sorted = [...measures].filter((m) => m.abatement > 0).sort((a, b) => a.cost - b.cost);
  let x = 0;
  return sorted.map((m) => {
    const seg = { ...m, x0: x, x1: x + m.abatement };
    x += m.abatement;
    return seg;
  });
}

export type PathwayInput = {
  baseYear: number;
  baseScope12: number;
  baseScope3: number;
  /** Share of scope 2 in base-year scope 1+2 (0–1). Missing = treated as all scope 1, which gives the lowest combined rate. */
  scope2Share?: number;
  targetYear: number;
  /** Business-as-usual annual growth of emissions without measures. */
  bauGrowth: number;
  measures: Measure[];
  /** Reported actuals by year (scope 1+2+3). */
  actuals: { year: number; value: number; estimated: boolean }[];
};

export type PathwayYear = {
  year: number;
  target15: number;
  targetWb2c: number;
  netZero: number;
  bau: number;
  withMeasures: number;
  abatement: number;
};

/** The linear rates buildPathway applies: S1+2 at 1.5 °C and the well-below 2 °C rate (scope 3, and the WB2C reference line). */
export function pathwayRates(input: Pick<PathwayInput, "baseYear" | "targetYear" | "scope2Share">) {
  return {
    scope12: combinedScope12Rate(input.baseYear, input.targetYear, input.scope2Share ?? 0),
    wb2c: dynamicRate("scope3_wb2c", input.baseYear, input.targetYear),
  };
}

export function buildPathway(input: PathwayInput, endYear = NET_ZERO_YEAR): PathwayYear[] {
  const base = Math.max(0, input.baseScope12) + Math.max(0, input.baseScope3);
  const rates = pathwayRates(input);
  const rows: PathwayYear[] = [];
  for (let year = input.baseYear; year <= endYear; year++) {
    const s12_15 = linearTarget(input.baseScope12, input.baseYear, year, rates.scope12);
    const s3_wb = linearTarget(input.baseScope3, input.baseYear, year, rates.wb2c);
    const s12_wb = linearTarget(input.baseScope12, input.baseYear, year, rates.wb2c);
    const bau = base * Math.pow(1 + input.bauGrowth, year - input.baseYear);
    const abatement = input.measures.reduce((s, m) => s + measureEffect(m, year), 0);
    rows.push({
      year,
      target15: s12_15 + s3_wb,
      targetWb2c: s12_wb + s3_wb,
      netZero: netZeroPath(base, input.baseYear, year),
      bau,
      withMeasures: Math.max(0, bau - abatement),
      abatement,
    });
  }
  return rows;
}

/** Gap between the measured plan and the 1.5 °C path in the target year (positive = shortfall). */
export function targetGap(rows: PathwayYear[], targetYear: number): number {
  const r = rows.find((x) => x.year === targetYear);
  return r ? r.withMeasures - r.target15 : 0;
}
