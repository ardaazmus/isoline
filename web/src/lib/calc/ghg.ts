/**
 * Corporate GHG inventory (GHG Protocol Corporate Standard, ISO 14064-1, TSRS 2 / IFRS S2 29(a)).
 * Scope 1: fuel combustion (activity × NCV × CO₂ factor), process emissions, refrigerant leaks × GWP.
 * Scope 2: location-based (ETKB consumption-point factor) and market-based (certified renewables at 0).
 * Scope 3: 15 categories, activity × user-supplied factor (the source of each factor is recorded).
 * Default NCV/EF values are IPCC 2006 Tier 1 defaults (CO₂ only) and are meant to be replaced by
 * supplier or national inventory values.
 */

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

/** ETKB 2023 consumption-point factors, tCO₂e/MWh (published 26.12.2025). */
export const GRID_FACTORS = {
  transmission: 0.436,
  distribution: 0.469,
} as const;

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
  fuels: FuelLine[];
  process: { id: string; label: string; tco2e: number; quality: Quality }[];
  refrigerants: RefrigerantLine[];
  electricity: ElectricityLine[];
  scope3: Scope3Line[];
  /** Normalisers for intensity metrics. */
  revenueMillionTry: number;
  productionTonnes: number;
};

export function fuelEmissions(line: Pick<FuelLine, "amount" | "ncv" | "ef">): number {
  // amount × GJ/unit → GJ; × tCO₂/TJ ÷ 1000 → tCO₂
  return (Math.max(0, line.amount) * Math.max(0, line.ncv) * Math.max(0, line.ef)) / 1000;
}

export function fuelEnergyGj(line: Pick<FuelLine, "amount" | "ncv">): number {
  return Math.max(0, line.amount) * Math.max(0, line.ncv);
}

export function refrigerantEmissions(line: RefrigerantLine): number {
  return (Math.max(0, line.leakedKg) * (GWP_AR6[line.gas] ?? 0)) / 1000;
}

/** The location-based factor a line uses: its own grid factor, else the ETKB factor for its connection point. */
export function gridFactorOf(line: Pick<ElectricityLine, "gridFactor" | "connection">): number {
  return Math.max(0, line.gridFactor ?? GRID_FACTORS[line.connection]);
}

export function electricityLocation(line: ElectricityLine): number {
  return Math.max(0, line.mwh) * gridFactorOf(line);
}

export function electricityMarket(line: ElectricityLine): number {
  const covered = Math.min(Math.max(0, line.certifiedMwh), Math.max(0, line.mwh));
  const rest = Math.max(0, line.mwh) - covered;
  const factor = line.supplierFactor ?? gridFactorOf(line);
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
};

export function computeInventory(inv: Inventory): InventoryResult {
  let stationary = 0;
  let mobile = 0;
  let estimated = 0;
  let energyGj = 0;
  for (const f of inv.fuels) {
    const e = fuelEmissions(f);
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
    s2l += electricityLocation(el);
    s2m += electricityMarket(el);
    mwh += Math.max(0, el.mwh);
    renewable += Math.min(Math.max(0, el.certifiedMwh), Math.max(0, el.mwh));
    if (el.quality === "estimated") estimated += electricityLocation(el);
  }
  energyGj += mwh * 3.6;
  const byCat: Record<number, number> = {};
  let s3 = 0;
  for (const l of inv.scope3) {
    const e = scope3Emissions(l);
    byCat[l.category] = (byCat[l.category] ?? 0) + e;
    s3 += e;
    if (l.quality === "estimated") estimated += e;
  }
  const scope1 = stationary + mobile + process + fugitive;
  const totalLocation = scope1 + s2l + s3;
  return {
    scope1,
    scope1Stationary: stationary,
    scope1Mobile: mobile,
    scope1Process: process,
    scope1Fugitive: fugitive,
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
  };
}

export const SCOPE3_CATEGORIES = Array.from({ length: 15 }, (_, i) => i + 1);
