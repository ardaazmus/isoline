/**
 * EU CBAM (SKDM) obligation projection, definitive period.
 * Formula (Guidance No. 3, Eq. 55–63; Reg. 2023/956 Art. 31):
 *   gross_y        = tonnes_y × SEE_y                       (tCO₂e)
 *   FAA_y          = tonnes_y × BM × CBAMfactor_y           (free allocation adjustment)
 *   deduction_y    = paidCarbonPrice€ × gross_y / price_y    (Art. 9, rules still draft)
 *   certificates_y = max(0, gross_y − FAA_y − deduction_y)
 *   cost_y         = certificates_y × price_y
 * SEE counts indirect emissions only for cement and fertilisers.
 * When default values are used, the year's mark-up is added (2026 10%, 2027 20%, 2028+ 30%; fertilisers 1%).
 */

export type CbamSector = "iron_steel" | "aluminium" | "cement" | "fertilisers" | "hydrogen" | "electricity";

export const CBAM_SECTORS: CbamSector[] = ["iron_steel", "aluminium", "cement", "fertilisers", "hydrogen", "electricity"];

/** Share of free allocation EU producers still receive (CBAM factor). Importer pays the complement. */
export const CBAM_FACTOR: Record<number, number> = {
  2026: 0.975,
  2027: 0.95,
  2028: 0.9,
  2029: 0.775,
  2030: 0.515,
  2031: 0.39,
  2032: 0.265,
  2033: 0.14,
  2034: 0,
};

export const FIRST_YEAR = 2026;
export const LAST_YEAR = 2034;

/** Official quarterly CBAM certificate prices published for 2026 (€/tCO₂e). */
export const CBAM_PRICES_2026 = [
  { quarter: "2026-Q1", price: 75.36, published: "2026-04-07" },
  { quarter: "2026-Q2", price: 75.28, published: "2026-07-06" },
  { quarter: "2026-Q3", price: 82.32, published: "2026-10-05" },
] as const;

export const DE_MINIMIS_TONNES = 50;
export const PENALTY_EUR_PER_T = 100;

export function cbamFactor(year: number): number {
  if (year <= FIRST_YEAR) return CBAM_FACTOR[FIRST_YEAR];
  if (year >= LAST_YEAR) return 0;
  return CBAM_FACTOR[year];
}

export function defaultMarkup(year: number, sector: CbamSector): number {
  if (sector === "fertilisers") return 0.01;
  if (year <= 2026) return 0.1;
  if (year === 2027) return 0.2;
  return 0.3;
}

export function countsIndirect(sector: CbamSector): boolean {
  return sector === "cement" || sector === "fertilisers";
}

export type CbamProduct = {
  id: string;
  name: string;
  cn: string;
  sector: CbamSector;
  /** Tonnes exported to the EU in the first projection year. */
  tonnes: number;
  /** Annual change in exported tonnes (0.02 = +2 %/yr). */
  growth: number;
  /** Verified specific embedded emissions, tCO₂e per tonne. */
  seeDirect: number;
  seeIndirect: number;
  /** Default value from Implementing Reg. 2025/2621 (Annex I), tCO₂e/t, entered by the user. */
  defaultSee: number;
  useDefault: boolean;
  /** Free-allocation benchmark for the production route (Impl. Reg. 2025/2620), tCO₂e/t. */
  benchmark: number;
};

export type CbamScenario = {
  /** Certificate price in the first year, €/tCO₂e. */
  startPrice: number;
  /** Annual price change (0.05 = +5 %/yr). */
  priceGrowth: number;
  /** Effective carbon price actually paid in the country of origin, €/tCO₂e (after free allocation). */
  originCarbonPrice: number;
  /** Optional EUR→TRY rate for local-currency figures. */
  eurTry: number;
};

export type CbamYear = {
  year: number;
  tonnes: number;
  see: number;
  gross: number;
  faa: number;
  deduction: number;
  certificates: number;
  price: number;
  cost: number;
  costPerTonne: number;
  /** Paid share = 1 − CBAM factor. */
  paidShare: number;
};

export function effectiveSee(p: CbamProduct, year: number, mode: "actual" | "default" = p.useDefault ? "default" : "actual"): number {
  if (mode === "default") return Math.max(0, p.defaultSee) * (1 + defaultMarkup(year, p.sector));
  const indirect = countsIndirect(p.sector) ? Math.max(0, p.seeIndirect) : 0;
  return Math.max(0, p.seeDirect) + indirect;
}

export function priceFor(s: CbamScenario, year: number): number {
  return Math.max(0, s.startPrice) * Math.pow(1 + s.priceGrowth, year - FIRST_YEAR);
}

export function projectProduct(
  p: CbamProduct,
  s: CbamScenario,
  mode?: "actual" | "default",
  from = FIRST_YEAR,
  to = LAST_YEAR,
): CbamYear[] {
  const rows: CbamYear[] = [];
  for (let year = from; year <= to; year++) {
    const tonnes = Math.max(0, p.tonnes) * Math.pow(1 + p.growth, year - FIRST_YEAR);
    const see = effectiveSee(p, year, mode);
    const gross = tonnes * see;
    const factor = cbamFactor(year);
    const faa = Math.min(gross, tonnes * Math.max(0, p.benchmark) * factor);
    const price = priceFor(s, year);
    const deduction = price > 0 ? Math.min(gross - faa, (Math.max(0, s.originCarbonPrice) * gross) / price) : 0;
    const certificates = Math.max(0, gross - faa - deduction);
    const cost = certificates * price;
    rows.push({
      year,
      tonnes,
      see,
      gross,
      faa,
      deduction,
      certificates,
      price,
      cost,
      costPerTonne: tonnes > 0 ? cost / tonnes : 0,
      paidShare: 1 - factor,
    });
  }
  return rows;
}

export type CbamPortfolioYear = Omit<CbamYear, "see" | "costPerTonne"> & { costDefault: number; costActual: number };

/** Sums all products per year; also returns the all-default and all-actual cost lines for comparison. */
export function projectPortfolio(products: CbamProduct[], s: CbamScenario): CbamPortfolioYear[] {
  const years: CbamPortfolioYear[] = [];
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    years.push({ year, tonnes: 0, gross: 0, faa: 0, deduction: 0, certificates: 0, price: priceFor(s, year), cost: 0, paidShare: 1 - cbamFactor(year), costDefault: 0, costActual: 0 });
  }
  for (const p of products) {
    const chosen = projectProduct(p, s);
    const def = projectProduct(p, s, "default");
    const act = projectProduct(p, s, "actual");
    chosen.forEach((r, i) => {
      const y = years[i];
      y.tonnes += r.tonnes;
      y.gross += r.gross;
      y.faa += r.faa;
      y.deduction += r.deduction;
      y.certificates += r.certificates;
      y.cost += r.cost;
      y.costDefault += def[i].cost;
      y.costActual += act[i].cost;
    });
  }
  return years;
}

/** Quarterly holding rule from 2027: at least 50 % of year-to-date embedded emissions (after FAA) held as certificates. */
export function quarterlyHolding(netYearCertificates: number, quarter: 1 | 2 | 3 | 4): number {
  return Math.max(0, netYearCertificates) * (quarter / 4) * 0.5;
}

/** EU importers below 50 t/year (steel, aluminium, fertilisers, cement combined) are exempt; electricity and hydrogen have no threshold. */
export function deMinimisExempt(sector: CbamSector, importerAnnualTonnes: number): boolean {
  if (sector === "electricity" || sector === "hydrogen") return false;
  return importerAnnualTonnes < DE_MINIMIS_TONNES;
}
