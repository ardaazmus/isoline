/**
 * Turkish ETS (TR ETS) under the Climate Law no. 7552 and the TR ETS Regulation (RG 27.08.2026, 33353).
 * Category (Art. 4/1-y, z, aa) by the annual emissions conservatively calculated from installed capacity,
 * excluding biomass CO₂: A ≤ 50 kt (MRV only), B 50–500 kt, C > 500 kt (B and C are in the ETS).
 * Pilot (KPK/2026/1): 2026–2027 emissions; 2026 is a reporting-only year; price mechanism from 2027;
 * free allocation 100 %, benchmark based.
 * Free allocation (Art. 13/7) = benchmark × free-allocation rate × sector activity coefficient × activity level,
 * rounded up (Art. 13/10). Reports are due 30 April (Art. 29/1), surrender by the last business day of
 * November (Art. 16/1). Climate Law provisional Art. 1(1): administrative fines are reduced by 80 % in the pilot.
 */

export type EtsCategory = "A" | "B" | "C";

export const PILOT_SECTORS = ["electricity", "cement", "iron_steel", "aluminium", "fertilisers"] as const;
export type PilotSector = (typeof PILOT_SECTORS)[number] | "other";

export const PILOT_YEARS = [2026, 2027] as const;
export const FIRST_PRICED_YEAR = 2027;
/** Climate Law 7552 provisional Art. 1(1): fines imposed in the pilot period are applied with an 80 % reduction. */
export const PILOT_FINE_REDUCTION = 0.8;

export function isPilotYear(year: number): boolean {
  return (PILOT_YEARS as readonly number[]).includes(year);
}

/** Applies the pilot-period fine reduction when the year is a pilot year. */
export function pilotAdjustedFine(amount: number, year: number): number {
  return isPilotYear(year) ? amount * (1 - PILOT_FINE_REDUCTION) : amount;
}

/** Surrender deadline (Art. 16/1): last business day of November; weekends skipped, public holidays not modelled. */
export function lastBusinessDayOfNovember(year: number): string {
  const d = new Date(Date.UTC(year, 10, 30));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Late verified-report fines, Art. 35/1-a (TL, 2026). ETS participants pay double. */
export const LATE_REPORT_FINE_TL: { category: string; maxKt: number; fine: number }[] = [
  { category: "A", maxKt: 50, fine: 627_450 },
  { category: "B", maxKt: 250, fine: 1_254_900 },
  { category: "B", maxKt: 500, fine: 2_509_800 },
  { category: "C", maxKt: 2000, fine: 4_392_150 },
  { category: "C", maxKt: Infinity, fine: 6_274_500 },
];

export function etsCategory(annualTCO2e: number): EtsCategory {
  if (annualTCO2e <= 50_000) return "A";
  if (annualTCO2e <= 500_000) return "B";
  return "C";
}

export function inEts(category: EtsCategory): boolean {
  return category !== "A";
}

export function inPilot(category: EtsCategory, sector: PilotSector): boolean {
  return inEts(category) && sector !== "other";
}

export function lateReportFine(annualTCO2e: number): number {
  const kt = annualTCO2e / 1000;
  const row = LATE_REPORT_FINE_TL.find((r) => kt <= r.maxKt)!;
  return inEts(etsCategory(annualTCO2e)) ? row.fine * 2 : row.fine;
}

export function freeAllocation(benchmark: number, rate: number, coefficient: number, activity: number): number {
  const raw = Math.max(0, benchmark) * Math.max(0, rate) * Math.max(0, coefficient) * Math.max(0, activity);
  // Rounded up to whole allowances; guard against float noise such as 1000.0000000002.
  return Math.ceil(Number(raw.toFixed(6)));
}

export type EtsInput = {
  sector: PilotSector;
  /** Verified emissions per year, tCO₂e. */
  emissions: number;
  emissionsGrowth: number;
  activity: number;
  activityGrowth: number;
  benchmark: number;
  /** Free allocation rate per year; pilot = 1. */
  rateByYear: Record<number, number>;
  coefficient: number;
  /** Allowance price in the first priced year, TL/tCO₂e. */
  price: number;
  priceGrowth: number;
};

export type EtsYear = {
  year: number;
  emissions: number;
  allocation: number;
  balance: number;
  deficit: number;
  price: number;
  cost: number;
  priced: boolean;
  /**
   * Penalty if the deficit is not surrendered: 2 × the higher of the last-3-month primary and secondary
   * average prices per allowance (Climate Law Art. 14/4-c), reduced by 80 % in pilot years.
   */
  nonSurrenderPenalty: number;
};

export function projectEts(input: EtsInput, from: number, to: number): EtsYear[] {
  const out: EtsYear[] = [];
  for (let year = from; year <= to; year++) {
    const n = year - from;
    const emissions = Math.max(0, input.emissions) * Math.pow(1 + input.emissionsGrowth, n);
    const activity = Math.max(0, input.activity) * Math.pow(1 + input.activityGrowth, n);
    const rate = input.rateByYear[year] ?? input.rateByYear[from] ?? 1;
    const allocation = freeAllocation(input.benchmark, rate, input.coefficient, activity);
    const balance = allocation - emissions;
    const deficit = Math.max(0, -balance);
    const priced = year >= FIRST_PRICED_YEAR;
    const price = priced ? Math.max(0, input.price) * Math.pow(1 + input.priceGrowth, year - Math.max(from, FIRST_PRICED_YEAR)) : 0;
    out.push({
      year,
      emissions,
      allocation,
      balance,
      deficit,
      price,
      cost: deficit * price,
      priced,
      nonSurrenderPenalty: pilotAdjustedFine(deficit * price * 2, year),
    });
  }
  return out;
}
