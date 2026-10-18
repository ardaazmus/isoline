/**
 * Corporate GHG inventory (GHG Protocol Corporate Standard, ISO 14064-1, TSRS 2 / IFRS S2 29(a)).
 * Scope 1: fuel combustion (activity × NCV × CO₂, CH₄ and N₂O factors), process emissions, refrigerant leaks × GWP.
 * Scope 2: location-based (ETKB consumption-point factor) and market-based (certified renewables at 0).
 * Scope 3: 15 categories, activity × user-supplied factor (the source of each factor is recorded).
 * Default NCV/EF values are IPCC 2006 Tier 1 defaults and are meant to be replaced by supplier or national
 * inventory values. CH₄ and N₂O use IPCC 2006 defaults, as Türkiye's national inventory does (NID 2026, sections
 * 3.1 and 3.2.6.2), weighted with AR6 GWP100.
 */
import etkbGrid from "@/data/factors/etkb-grid.json";
import type { RecalcRecord } from "../recalc";

export type FuelId = "natural_gas" | "diesel" | "gasoline" | "lpg" | "fuel_oil" | "coal" | "lignite";

export type FuelDefault = {
  id: FuelId;
  unit: "Sm3" | "L" | "kg" | "t";
  /** Net calorific value, GJ per unit. */
  ncv: number;
  /** CO₂ emission factor, tCO₂ per TJ (IPCC 2006 Vol. 2 Table 1.4). */
  ef: number;
};

/**
 * NCVs: IPCC 2006 Vol. 2 Table 1.2 TJ/Gg defaults (gas/diesel oil 43.0, motor gasoline 44.3, LPG 47.3,
 * residual fuel oil 40.4, other bituminous coal 25.8, lignite 11.9) converted with typical densities
 * (diesel 0.84 kg/L, gasoline 0.745 kg/L — assumptions, not IPCC values). Natural gas 34.5 MJ/Sm³ is a
 * typical network value; IPCC gives 48.0 TJ/Gg on a mass basis only. EFs: Table 1.4 defaults.
 */
export const FUELS: Record<FuelId, FuelDefault> = {
  natural_gas: { id: "natural_gas", unit: "Sm3", ncv: 0.0345, ef: 56.1 },
  diesel: { id: "diesel", unit: "L", ncv: 0.03612, ef: 74.1 },
  gasoline: { id: "gasoline", unit: "L", ncv: 0.033, ef: 69.3 },
  lpg: { id: "lpg", unit: "kg", ncv: 0.0473, ef: 63.1 },
  fuel_oil: { id: "fuel_oil", unit: "kg", ncv: 0.0404, ef: 77.4 },
  coal: { id: "coal", unit: "t", ncv: 25.8, ef: 94.6 },
  lignite: { id: "lignite", unit: "t", ncv: 11.9, ef: 101.0 },
};

/**
 * GWP100, IPCC AR6 WG1 Chapter 7 Supplementary Material, Table 7.SM.7 (published version, SF₆ with the
 * 1,000-year lifetime of Section 2.2.4.3; same values in the GHG Protocol AR6 list of August 2024).
 * Blends computed from components (R-410A = 50 % R-32 + 50 % R-125; R-404A = 44 % R-125 + 52 % R-143a
 * + 4 % R-134a; blend compositions are ASHRAE 34 values, not re-verified).
 */
export const GWP_AR6: Record<string, number> = {
  "R-134a": 1530,
  "R-32": 771,
  "R-125": 3740,
  "R-143a": 5810,
  "R-410A": 0.5 * 771 + 0.5 * 3740,
  "R-404A": 0.44 * 3740 + 0.52 * 5810 + 0.04 * 1530,
  SF6: 24300,
};

/**
 * GWP100 of the combustion gases, IPCC AR6 WG1 Chapter 7, Table 7.15 (p. 1017): CH₄ from fossil sources 29.8
 * (non-fossil 27.0 does not apply: every fuel in FUELS is fossil), N₂O 273.
 */
export const GWP_AR6_COMBUSTION = { ch4: 29.8, n2o: 273 } as const;

/** CH₄ and N₂O emission factors, kg per TJ on a net calorific basis. */
export type NonCo2Factors = { ch4: number; n2o: number };

/**
 * Stationary combustion: IPCC 2006 Vol. 2 Table 2.3, manufacturing industries and construction (p. 2.18).
 * Commercial/institutional boilers (Table 2.4) emit somewhat more CH₄; enter those values on the line.
 */
export const NON_CO2_STATIONARY: Record<FuelId, NonCo2Factors> = {
  natural_gas: { ch4: 1, n2o: 0.1 },
  diesel: { ch4: 3, n2o: 0.6 },
  gasoline: { ch4: 3, n2o: 0.6 },
  lpg: { ch4: 1, n2o: 0.1 },
  fuel_oil: { ch4: 3, n2o: 0.6 },
  coal: { ch4: 10, n2o: 1.5 },
  lignite: { ch4: 10, n2o: 1.5 },
};

/**
 * Mobile combustion, IPCC 2006 Vol. 2 Chapter 3:
 * - road (Table 3.2.2, p. 3.21): motor gasoline "low mileage light duty vehicle, vintage 1995 or later"
 *   (catalyst-equipped cars, the bulk of today's fleet), gas/diesel oil, natural gas, LPG;
 * - residual fuel oil: ocean-going ships (Table 3.5.3, p. 3.50);
 * - coal: rail, sub-bituminous coal (Table 3.4.1, p. 3.43).
 * Lignite has no mobile default and keeps the stationary values.
 */
export const NON_CO2_MOBILE: Record<FuelId, NonCo2Factors> = {
  natural_gas: { ch4: 92, n2o: 3 },
  diesel: { ch4: 3.9, n2o: 3.9 },
  gasoline: { ch4: 3.8, n2o: 5.7 },
  lpg: { ch4: 62, n2o: 0.2 },
  fuel_oil: { ch4: 7, n2o: 2 },
  coal: { ch4: 2, n2o: 1.5 },
  lignite: NON_CO2_STATIONARY.lignite,
};

export function defaultNonCo2(fuel: FuelId, mobile: boolean): NonCo2Factors {
  return { ...(mobile ? NON_CO2_MOBILE : NON_CO2_STATIONARY)[fuel] };
}

export type GridFactors = { transmission: number; distribution: number };

/** ETKB editions, one per calculation year (docs/kaynak-veri/etkb); values in tCO₂e/MWh. */
export const ETKB_EDITIONS = (etkbGrid.editions as { year: number; published: string; revision: string; file: string; factors: Record<string, { tco2: number; tco2e: number }> }[])
  .slice()
  .sort((a, b) => a.year - b.year);

/** Consumption-point factors of the latest ETKB edition, the default when an inventory has not chosen one. */
export const GRID_FACTORS: GridFactors = {
  transmission: ETKB_EDITIONS.at(-1)!.factors["TR-transmission"].tco2e,
  distribution: ETKB_EDITIONS.at(-1)!.factors["TR-distribution"].tco2e,
};

export type Quality = "measured" | "calculated" | "estimated";

export type FuelLine = {
  /** Factor library reference "<set>/<factor>" when the factor was picked from the library. */
  factorRef?: string;
  id: string;
  fuel: FuelId;
  label: string;
  amount: number;
  ncv: number;
  ef: number;
  /** CH₄ and N₂O factors, kg/TJ; absent = the IPCC default for the fuel and its use (see defaultNonCo2). */
  ch4?: number;
  n2o?: number;
  mobile: boolean;
  quality: Quality;
};

export type RefrigerantLine = { id: string; gas: string; leakedKg: number; quality: Quality };

export type ElectricityLine = {
  /** Factor library reference "<set>/<factor>" when the grid factor was picked from the library. */
  factorRef?: string;
  id: string;
  label: string;
  mwh: number;
  connection: keyof typeof GRID_FACTORS;
  /**
   * Location-based grid factor, tCO₂e/MWh, for a site outside the Turkish grid (e.g. an EEA country value);
   * absent or null = the ETKB factor for the connection point.
   */
  gridFactor?: number | null;
  /** MWh covered by YEK-G / I-REC certificates or a renewable PPA (counts at 0 in market-based). */
  certifiedMwh: number;
  /** Supplier-specific factor for the uncovered part, tCO₂e/MWh; null = fall back to the location-based grid factor. */
  supplierFactor: number | null;
  quality: Quality;
};

export type Scope3Line = {
  /** Factor library reference "<set>/<factor>" when the factor was picked from the library. */
  factorRef?: string;
  id: string;
  category: number;
  label: string;
  amount: number;
  unit: string;
  /** tCO₂e per unit. */
  factor: number;
  factorSource: string;
  quality: Quality;
};

export type Inventory = {
  /** Year the inventory reports; factor editions are chosen for it. Missing = the client's reporting year. */
  year?: number;
  /** Consumption-point grid factors in use, frozen with the ETKB edition they came from. Missing = latest edition. */
  grid?: GridFactors & { edition: string };
  /** Recalculations after a factor edition change, newest first. */
  recalcs?: RecalcRecord[];
  fuels: FuelLine[];
  process: { id: string; label: string; tco2e: number; quality: Quality }[];
  refrigerants: RefrigerantLine[];
  electricity: ElectricityLine[];
  scope3: Scope3Line[];
  /** Normalisers for intensity metrics. */
  revenueMillionTry: number;
  productionTonnes: number;
};

type FuelInput = Pick<FuelLine, "fuel" | "mobile" | "amount" | "ncv" | "ef" | "ch4" | "n2o">;

/** The CH₄ and N₂O factors a line uses: its own, else the IPCC default for its fuel and use. */
export function nonCo2Of(line: Pick<FuelLine, "fuel" | "mobile" | "ch4" | "n2o">): NonCo2Factors {
  const d = defaultNonCo2(line.fuel, line.mobile);
  return { ch4: Math.max(0, line.ch4 ?? d.ch4), n2o: Math.max(0, line.n2o ?? d.n2o) };
}

/** Mass of each gas, tonnes, and their CO₂e (AR6 GWP100). */
export type FuelGases = { co2: number; ch4: number; n2o: number; co2e: number };

export function fuelGases(line: FuelInput): FuelGases {
  // amount × GJ/unit → GJ; ÷ 1000 → TJ; × t/TJ (CO₂) or kg/TJ ÷ 1000 (CH₄, N₂O) → t
  const tj = (Math.max(0, line.amount) * Math.max(0, line.ncv)) / 1000;
  const f = nonCo2Of(line);
  const co2 = tj * Math.max(0, line.ef);
  const ch4 = (tj * f.ch4) / 1000;
  const n2o = (tj * f.n2o) / 1000;
  return { co2, ch4, n2o, co2e: co2 + ch4 * GWP_AR6_COMBUSTION.ch4 + n2o * GWP_AR6_COMBUSTION.n2o };
}

/** Combustion emissions of a line, tCO₂e (CO₂ + CH₄ + N₂O). */
export function fuelEmissions(line: FuelInput): number {
  return fuelGases(line).co2e;
}

export function fuelEnergyGj(line: Pick<FuelLine, "amount" | "ncv">): number {
  return Math.max(0, line.amount) * Math.max(0, line.ncv);
}

export function refrigerantEmissions(line: RefrigerantLine): number {
  return (Math.max(0, line.leakedKg) * (GWP_AR6[line.gas] ?? 0)) / 1000;
}

/** The location-based factor a line uses: its own grid factor, else the ETKB factor for its connection point. */
export function gridFactorOf(line: Pick<ElectricityLine, "gridFactor" | "connection">, grid: GridFactors = GRID_FACTORS): number {
  return Math.max(0, line.gridFactor ?? grid[line.connection]);
}

export function electricityLocation(line: ElectricityLine, grid: GridFactors = GRID_FACTORS): number {
  return Math.max(0, line.mwh) * gridFactorOf(line, grid);
}

export function electricityMarket(line: ElectricityLine, grid: GridFactors = GRID_FACTORS): number {
  const covered = Math.min(Math.max(0, line.certifiedMwh), Math.max(0, line.mwh));
  const rest = Math.max(0, line.mwh) - covered;
  const factor = line.supplierFactor ?? gridFactorOf(line, grid);
  return rest * Math.max(0, factor);
}

export function scope3Emissions(line: Scope3Line): number {
  return Math.max(0, line.amount) * Math.max(0, line.factor);
}

export type InventoryResult = {
  scope1: number;
  scope1Stationary: number;
  scope1Mobile: number;
  scope1Process: number;
  scope1Fugitive: number;
  /** Fuel combustion by gas, tonnes of each gas (GHG Protocol reports each gas separately). */
  combustionGases: { co2: number; ch4: number; n2o: number };
  scope2Location: number;
  scope2Market: number;
  scope3: number;
  scope3ByCategory: Record<number, number>;
  totalLocation: number;
  totalMarket: number;
  energyGj: number;
  electricityMwh: number;
  renewableShare: number;
  intensityRevenue: number;
  intensityProduct: number;
  estimatedShare: number;
  /** Share of scope 1 + 2 (location-based) from lines marked "estimated". */
  estimatedShareScope12: number;
  /** Share of scope 3 from lines marked "estimated". */
  estimatedShareScope3: number;
};

export function computeInventory(inv: Inventory): InventoryResult {
  const grid = inv.grid ?? GRID_FACTORS;
  let stationary = 0;
  let mobile = 0;
  let estimated = 0;
  let energyGj = 0;
  const gases = { co2: 0, ch4: 0, n2o: 0 };
  for (const f of inv.fuels) {
    const g = fuelGases(f);
    const e = g.co2e;
    gases.co2 += g.co2;
    gases.ch4 += g.ch4;
    gases.n2o += g.n2o;
    if (f.mobile) mobile += e;
    else stationary += e;
    energyGj += fuelEnergyGj(f);
    if (f.quality === "estimated") estimated += e;
  }
  const process = inv.process.reduce((s, p) => s + Math.max(0, p.tco2e), 0);
  estimated += inv.process.filter((p) => p.quality === "estimated").reduce((s, p) => s + Math.max(0, p.tco2e), 0);
  let fugitive = 0;
  for (const r of inv.refrigerants) {
    const e = refrigerantEmissions(r);
    fugitive += e;
    if (r.quality === "estimated") estimated += e;
  }
  let s2l = 0;
  let s2m = 0;
  let mwh = 0;
  let renewable = 0;
  for (const el of inv.electricity) {
    s2l += electricityLocation(el, grid);
    s2m += electricityMarket(el, grid);
    mwh += Math.max(0, el.mwh);
    renewable += Math.min(Math.max(0, el.certifiedMwh), Math.max(0, el.mwh));
    if (el.quality === "estimated") estimated += electricityLocation(el, grid);
  }
  energyGj += mwh * 3.6;
  const estimated12 = estimated;
  const byCat: Record<number, number> = {};
  let s3 = 0;
  let estimated3 = 0;
  for (const l of inv.scope3) {
    const e = scope3Emissions(l);
    byCat[l.category] = (byCat[l.category] ?? 0) + e;
    s3 += e;
    if (l.quality === "estimated") estimated3 += e;
  }
  estimated += estimated3;
  const scope1 = stationary + mobile + process + fugitive;
  const totalLocation = scope1 + s2l + s3;
  return {
    scope1,
    scope1Stationary: stationary,
    scope1Mobile: mobile,
    scope1Process: process,
    scope1Fugitive: fugitive,
    combustionGases: gases,
    scope2Location: s2l,
    scope2Market: s2m,
    scope3: s3,
    scope3ByCategory: byCat,
    totalLocation,
    totalMarket: scope1 + s2m + s3,
    energyGj,
    electricityMwh: mwh,
    renewableShare: mwh > 0 ? renewable / mwh : 0,
    intensityRevenue: inv.revenueMillionTry > 0 ? (scope1 + s2l) / inv.revenueMillionTry : 0,
    intensityProduct: inv.productionTonnes > 0 ? (scope1 + s2l) / inv.productionTonnes : 0,
    estimatedShare: totalLocation > 0 ? estimated / totalLocation : 0,
    estimatedShareScope12: scope1 + s2l > 0 ? estimated12 / (scope1 + s2l) : 0,
    estimatedShareScope3: s3 > 0 ? estimated3 / s3 : 0,
  };
}

export const SCOPE3_CATEGORIES = Array.from({ length: 15 }, (_, i) => i + 1);
