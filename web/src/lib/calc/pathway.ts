/**
 * Science-based target pathways (SBTi near-term criteria, linear absolute contraction):
 *   1.5 °C: ≥ 4.2 % of base-year emissions per year (scope 1+2)
 *   well-below 2 °C: ≥ 2.5 % per year (minimum for scope 3)
 * Long-term net-zero: ≥ 90 % absolute reduction by 2050 at the latest (Net-Zero Standard V1.3).
 * Net-Zero Standard V2.0 applies from 31.01.2027; its final pathways arrive Q4 2026, so V2 values are not modelled here.
 */

export const RATE_15C = 0.042;
export const RATE_WB2C = 0.025;
export const NET_ZERO_REDUCTION = 0.9;
export const NET_ZERO_YEAR = 2050;

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

export function buildPathway(input: PathwayInput, endYear = NET_ZERO_YEAR): PathwayYear[] {
  const base = Math.max(0, input.baseScope12) + Math.max(0, input.baseScope3);
  const rows: PathwayYear[] = [];
  for (let year = input.baseYear; year <= endYear; year++) {
    const s12_15 = linearTarget(input.baseScope12, input.baseYear, year, RATE_15C);
    const s3_wb = linearTarget(input.baseScope3, input.baseYear, year, RATE_WB2C);
    const s12_wb = linearTarget(input.baseScope12, input.baseYear, year, RATE_WB2C);
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
