/**
 * EU CBAM (SKDM) obligation projection, definitive period.
 * Formula (Guidance No. 3, Eq. 55–63; Reg. 2023/956 Art. 31; Impl. Reg. 2025/2620 Annex Eq. 1–6):
 *   gross_y        = tonnes_y × SEE_y                              (tCO₂e)
 *   FAA_y          = tonnes_y × CBAMfactor_y × CSCF_y × BM          (free allocation adjustment)
 *   deduction_y    = paidCarbonPrice€ × gross_y / price_y           (Art. 9; actual emissions only)
 *   certificates_y = max(0, gross_y − FAA_y − deduction_y)
 *   cost_y         = certificates_y × price_y
 * SEE counts indirect emissions only for cement, fertilisers and agglomerated iron ore (not in Annex II).
 * When default values are used, the year's mark-up is added (2026 10%, 2027 20%, 2028+ 30%; fertilisers 1%).
 * Art. 9(1) allows the origin carbon-price deduction only for actual emissions; with default values only
 * yearly default carbon prices may be used (Art. 9(4)), and none are published yet, so the default route
 * gets no deduction. The Art. 9(5) implementing rules are still a draft (Ares(2026)4841230, not adopted).
 */

export type CbamSector = "iron_steel" | "aluminium" | "cement" | "fertilisers" | "hydrogen" | "electricity";

export const CBAM_SECTORS: CbamSector[] = ["iron_steel", "aluminium", "cement", "fertilisers", "hydrogen", "electricity"];

/**
 * Share of free allocation EU producers still receive (CBAM factor). Importer pays the complement.
 * Directive 2003/87/EC Art. 10a(1a), inserted by Directive (EU) 2023/959: 97,5 % in 2026 … 14 % in 2033,
 * no CBAM factor from 2034.
 */
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

/**
 * Cross-sectoral correction factor (CSCF) per year, Commission Implementing Decision (EU) 2026/1862:
 * 100 % for each year of the allocation period 2026–2030. Later years are not determined yet.
 */
export const CSCF: Record<number, number> = { 2026: 1, 2027: 1, 2028: 1, 2029: 1, 2030: 1 };

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

/** CSCF for the year; years without a published decision (2031+) fall back to 1 (see cscfDetermined). */
export function cscf(year: number): number {
  return CSCF[year] ?? 1;
}

export function cscfDetermined(year: number): boolean {
  return year in CSCF;
}

export function defaultMarkup(year: number, sector: CbamSector): number {
  if (sector === "fertilisers") return 0.01;
  if (year <= 2026) return 0.1;
  if (year === 2027) return 0.2;
  return 0.3;
}

/**
 * Indirect emissions count for goods not listed in Annex II of Reg. 2023/956: cement, fertilisers and,
 * within iron and steel, agglomerated iron ore (CN 2601 12 00).
 */
export function countsIndirect(sector: CbamSector, cn = ""): boolean {
  if (sector === "cement" || sector === "fertilisers") return true;
  return sector === "iron_steel" && cnDigits(cn).startsWith("26011200");
}

type AnnexRow = { code: string; sector: CbamSector; except?: string[]; ex?: boolean };

/**
 * Reg. 2023/956 Annex I (consolidated 20.10.2025), CN codes as printed; spaces removed.
 * "ex" rows cover only part of the code (2507 00 80: other kaolinic clays except non-calcined ones).
 */
export const CBAM_ANNEX_I: AnnexRow[] = [
  { code: "25070080", sector: "cement", ex: true },
  { code: "25231000", sector: "cement" },
  { code: "25232100", sector: "cement" },
  { code: "25232900", sector: "cement" },
  { code: "25233000", sector: "cement" },
  { code: "25239000", sector: "cement" },
  { code: "27160000", sector: "electricity" },
  { code: "28080000", sector: "fertilisers" },
  { code: "2814", sector: "fertilisers" },
  { code: "28342100", sector: "fertilisers" },
  { code: "3102", sector: "fertilisers" },
  { code: "3105", sector: "fertilisers", except: ["31056000"] },
  {
    code: "72",
    sector: "iron_steel",
    except: ["72022", "72023000", "72025000", "72027000", "72028000", "72029100", "72029200", "72029300", "720299", "7204"],
  },
  { code: "26011200", sector: "iron_steel" },
  { code: "7301", sector: "iron_steel" },
  { code: "7302", sector: "iron_steel" },
  { code: "730300", sector: "iron_steel" },
  { code: "7304", sector: "iron_steel" },
  { code: "7305", sector: "iron_steel" },
  { code: "7306", sector: "iron_steel" },
  { code: "7307", sector: "iron_steel" },
  { code: "7308", sector: "iron_steel" },
  { code: "730900", sector: "iron_steel" },
  { code: "7310", sector: "iron_steel" },
  { code: "731100", sector: "iron_steel" },
  { code: "7318", sector: "iron_steel" },
  { code: "7326", sector: "iron_steel" },
  { code: "7601", sector: "aluminium" },
  { code: "7603", sector: "aluminium" },
  { code: "7604", sector: "aluminium" },
  { code: "7605", sector: "aluminium" },
  { code: "7606", sector: "aluminium" },
  { code: "7607", sector: "aluminium" },
  { code: "7608", sector: "aluminium" },
  { code: "76090000", sector: "aluminium" },
  { code: "7610", sector: "aluminium" },
  { code: "76110000", sector: "aluminium" },
  { code: "7612", sector: "aluminium" },
  { code: "76130000", sector: "aluminium" },
  { code: "7614", sector: "aluminium" },
  { code: "7616", sector: "aluminium" },
  { code: "28041000", sector: "hydrogen" },
];

function cnDigits(cn: string): string {
  return cn.replace(/\D/g, "");
}

export type CnCoverage =
  | { status: "covered"; sector: CbamSector }
  /** The entered code is broader than an Annex I row or an exclusion, or the row is an "ex" row: check the full 8-digit code. */
  | { status: "partial"; sector: CbamSector }
  | { status: "not_covered" }
  /** Fewer than 4 digits: cannot be matched. */
  | { status: "invalid" };

/** Whether a CN code falls under CBAM Annex I. */
export function cnCoverage(cn: string): CnCoverage {
  const d = cnDigits(cn);
  if (d.length < 4) return { status: "invalid" };
  let partial: CbamSector | null = null;
  for (const row of CBAM_ANNEX_I) {
    if (d.startsWith(row.code)) {
      const except = row.except ?? [];
      if (except.some((e) => d.startsWith(e))) continue;
      if (row.ex || except.some((e) => e.startsWith(d))) partial ??= row.sector;
      else return { status: "covered", sector: row.sector };
    } else if (row.code.startsWith(d)) {
      partial ??= row.sector;
    }
  }
  return partial ? { status: "partial", sector: partial } : { status: "not_covered" };
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
  const indirect = countsIndirect(p.sector, p.cn) ? Math.max(0, p.seeIndirect) : 0;
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
  const route = mode ?? (p.useDefault ? "default" : "actual");
  for (let year = from; year <= to; year++) {
    const tonnes = Math.max(0, p.tonnes) * Math.pow(1 + p.growth, year - FIRST_YEAR);
    const see = effectiveSee(p, year, route);
    const gross = tonnes * see;
    const factor = cbamFactor(year);
    const faa = Math.min(gross, tonnes * Math.max(0, p.benchmark) * factor * cscf(year));
    const price = priceFor(s, year);
    // Art. 9(1): actual emissions only; the default route would need yearly default carbon prices (Art. 9(4)).
    const deduction =
      route === "actual" && price > 0 ? Math.min(gross - faa, (Math.max(0, s.originCarbonPrice) * gross) / price) : 0;
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

/**
 * Art. 2a and Annex VII: an importer whose net mass "does not cumulatively exceed" 50 t in the calendar
 * year is exempt, so exactly 50 t is still exempt. Art. 2a(4): not applicable to electricity or hydrogen.
 */
export function deMinimisExempt(sector: CbamSector, importerAnnualTonnes: number): boolean {
  if (sector === "electricity" || sector === "hydrogen") return false;
  return importerAnnualTonnes <= DE_MINIMIS_TONNES;
}
