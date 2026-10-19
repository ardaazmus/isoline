/**
 * GHG calculation over accepted observations (G4-03; GHG Protocol Corporate Standard + Scope 2 Guidance), wrapping
 * the toolkit engine (`computeInventory`) unchanged: each facility's observations become a toolkit inventory, the
 * result is scaled by the facility's share in the approved boundary, organisation-level items (mobile fleet,
 * certificates, scope 3) are added once. Refrigerant leaks use the resolved GWP (the toolkit table is AR6 only),
 * so a project that chose another GWP set gets that set. Pure — the service supplies observations, boundary and
 * factors.
 */
import { computeInventory, FUELS, type ElectricityLine, type FuelId, type FuelLine, type Inventory, type InventoryResult, type Quality, type Scope3Line } from "@/lib/calc/ghg";
import type { ResolvedFactor } from "./factors";

export type ObsLine = { key: string; value: string; unit: string; canonical: string; canonicalUnit: string };
export type Obs = { versionId: string; metricCode: string; facilityId: string | null; canonical: string | null; canonicalUnit: string | null; lines: ObsLine[] | null; quality: Quality };
export type FacilityIn = { id: string; pct: number; connection: "transmission" | "distribution"; country: string };
export type Warning = { code: string; target: string; detail?: Record<string, unknown> };

export type GhgInput = { year: number; facilities: FacilityIn[]; observations: Obs[]; factors: Record<string, ResolvedFactor> };

export type FacilityResult = { facilityId: string; pct: number; raw: InventoryResult; scope1: number; scope1Stationary: number; scope1Process: number; scope1Fugitive: number; scope2Location: number; scope2Market: number; energyGj: number; electricityMwh: number; estimatedShare: number };
export type GhgGroup = { scope1: number; scope1Stationary: number; scope1Mobile: number; scope1Process: number; scope1Fugitive: number; scope2Location: number; scope2Market: number; scope3: number; totalLocation: number; totalMarket: number; energyGj: number; electricityMwh: number; estimatedShare: number };
export type GhgOutput = {
  facilities: FacilityResult[];
  org: { mobile: number; scope3: number; scope3ByCategory: Record<number, number>; certificatesMwh: number };
  group: GhgGroup;
  used: { observations: string[]; factors: string[] };
  warnings: Warning[];
};

/** Fuel targets a run may need: one per fuel in the toolkit list. */
export const FUEL_TARGETS = (Object.keys(FUELS) as FuelId[]).map((f) => `fuel:${f}`);

/** Grid target of a facility: ETKB consumption point in Türkiye, EEA country intensity elsewhere. */
export const gridTarget = (f: Pick<FacilityIn, "connection" | "country">) => (f.country === "TR" ? `grid:${f.connection}` : `grid:eea-${f.country.toLowerCase()}`);

// litres ↔ kg, typical densities (the toolkit's documented assumptions for diesel and gasoline; LPG typical value)
const DENSITY_KG_PER_L: Partial<Record<FuelId, number>> = { diesel: 0.84, gasoline: 0.745, lpg: 0.51 };

/** Amount in the fuel's native unit (Sm³, L, kg, t) from a canonical value (m³, t or GJ). */
export function nativeAmount(fuel: FuelId, canonical: number, canonicalUnit: string, ncv: number): { amount: number | null; warning?: string } {
  const native = FUELS[fuel].unit;
  if (canonicalUnit === "GJ") return { amount: ncv > 0 ? canonical / ncv : null, warning: "energy_entered_for_fuel" };
  const density = DENSITY_KG_PER_L[fuel];
  if (native === "Sm3") return canonicalUnit === "m3" ? { amount: canonical } : { amount: null, warning: "fuel_unit_unsupported" };
  if (native === "L") {
    if (canonicalUnit === "m3") return { amount: canonical * 1000 };
    if (canonicalUnit === "t" && density) return { amount: (canonical * 1000) / density, warning: "density_assumption" };
    return { amount: null, warning: "fuel_unit_unsupported" };
  }
  if (native === "kg") {
    if (canonicalUnit === "t") return { amount: canonical * 1000 };
    if (canonicalUnit === "m3" && density) return { amount: canonical * 1000 * density, warning: "density_assumption" };
    return { amount: null, warning: "fuel_unit_unsupported" };
  }
  return canonicalUnit === "t" ? { amount: canonical } : { amount: null, warning: "fuel_unit_unsupported" };
}

const n = (s: string | null) => (s === null ? 0 : Number(s));
const emptyInventory = (year: number): Inventory => ({ year, fuels: [], process: [], refrigerants: [], electricity: [], scope3: [], revenueMillionTry: 0, productionTonnes: 0 });

export function computeGhg(input: GhgInput): GhgOutput {
  const warnings: Warning[] = [];
  const usedObs = new Set<string>();
  const usedFactors = new Set<string>();
  const warn = (w: Warning) => {
    if (!warnings.some((x) => x.code === w.code && x.target === w.target)) warnings.push(w);
  };
  const F = (target: string) => {
    const f = input.factors[target];
    if (f) usedFactors.add(target);
    else warn({ code: "factor_missing", target });
    return f;
  };
  const obsOf = (metric: string, facility: string | null) => input.observations.filter((o) => o.metricCode === metric && o.facilityId === facility);

  const fuels = (o: Obs, mobile: boolean): FuelLine[] =>
    (o.lines ?? []).flatMap((l, i) => {
      const fuel = l.key as FuelId;
      if (!FUELS[fuel]) {
        warn({ code: "unknown_fuel", target: o.versionId, detail: { key: l.key } });
        return [];
      }
      const f = F(`fuel:${fuel}`);
      if (!f) return [];
      const ncv = f.ncv ?? FUELS[fuel].ncv;
      const nat = nativeAmount(fuel, Number(l.canonical), l.canonicalUnit, ncv);
      if (nat.warning) warn({ code: nat.warning, target: `${o.versionId}:${fuel}`, detail: { fuel, unit: l.unit } });
      if (nat.amount === null) return [];
      usedObs.add(o.versionId);
      return [{ id: `${o.versionId}:${i}`, fuel, label: fuel, amount: nat.amount, ncv, ef: f.value, ch4: f.ch4 ?? undefined, n2o: f.n2o ?? undefined, mobile, quality: o.quality }];
    });

  // certificates (organisation-level) are spread over facilities in proportion to their consumption
  const cert = obsOf("ghg_certificates", null).reduce((s, o) => (usedObs.add(o.versionId), s + n(o.canonical) / 3.6), 0);
  const elecByFacility = new Map(input.facilities.filter((f) => f.pct > 0).map((f) => [f.id, obsOf("ghg_electricity", f.id).reduce((s, o) => s + n(o.canonical) / 3.6, 0)]));
  const elecTotal = [...elecByFacility.values()].reduce((a, b) => a + b, 0);
  if (cert > elecTotal + 1e-9) warn({ code: "certificates_exceed_consumption", target: "ghg_certificates", detail: { certificatesMwh: cert, consumptionMwh: elecTotal } });
  const covered = Math.min(cert, elecTotal);

  const facilities: FacilityResult[] = [];
  for (const fac of input.facilities) {
    if (fac.pct <= 0) continue;
    const inv = emptyInventory(input.year);
    for (const o of obsOf("ghg_stationary", fac.id)) inv.fuels.push(...fuels(o, false));
    for (const o of obsOf("ghg_process", fac.id)) {
      usedObs.add(o.versionId);
      inv.process.push({ id: o.versionId, label: "process", tco2e: n(o.canonical), quality: o.quality });
    }
    const elec = obsOf("ghg_electricity", fac.id);
    if (elec.length) {
      const target = gridTarget(fac);
      const grid = F(target);
      if (grid && fac.country === "TR") {
        const tr = input.factors["grid:transmission"]?.value ?? grid.value;
        const dist = input.factors["grid:distribution"]?.value ?? grid.value;
        inv.grid = { transmission: tr, distribution: dist, edition: String(grid.edition ?? "") };
      }
      if (grid)
        for (const o of elec) {
          usedObs.add(o.versionId);
          const own = n(o.canonical) / 3.6;
          const line: ElectricityLine = { id: o.versionId, label: "electricity", mwh: own, connection: fac.connection, gridFactor: fac.country === "TR" ? null : grid.value, certifiedMwh: elecTotal > 0 ? (own / elecTotal) * covered : 0, supplierFactor: null, quality: o.quality };
          inv.electricity.push(line);
        }
    }
    for (const o of obsOf("ghg_production", fac.id)) {
      usedObs.add(o.versionId);
      inv.productionTonnes += n(o.canonical);
    }
    // the toolkit's engine computes fuels, process and electricity
    const raw = computeInventory(inv);
    // refrigerant leaks with the resolved GWP: mass (t) × GWP = tCO₂e
    let fugitive = 0;
    let fugitiveEstimated = 0;
    for (const o of obsOf("ghg_refrigerants", fac.id))
      for (const l of o.lines ?? []) {
        const g = F(`gwp:${l.key.toLowerCase()}`);
        if (!g) continue;
        usedObs.add(o.versionId);
        const e = Math.max(0, Number(l.canonical)) * g.value;
        fugitive += e;
        if (o.quality === "estimated") fugitiveEstimated += e;
      }
    const base12 = raw.scope1 + raw.scope2Location;
    const est12 = raw.estimatedShareScope12 * base12 + fugitiveEstimated;
    const k = fac.pct / 100;
    facilities.push({
      facilityId: fac.id,
      pct: fac.pct,
      raw,
      scope1: (raw.scope1 + fugitive) * k,
      scope1Stationary: raw.scope1Stationary * k,
      scope1Process: raw.scope1Process * k,
      scope1Fugitive: fugitive * k,
      scope2Location: raw.scope2Location * k,
      scope2Market: raw.scope2Market * k,
      energyGj: raw.energyGj * k,
      electricityMwh: raw.electricityMwh * k,
      estimatedShare: base12 + fugitive > 0 ? est12 / (base12 + fugitive) : 0,
    });
  }
  // Türkiye publishes no residual mix: the uncovered part of market-based uses the grid factor (Scope 2 Guidance §6.11, disclosed)
  if (elecTotal > 0) warn({ code: "market_residual_proxy", target: "ghg_electricity" });

  // organisation-level: mobile fleet and scope 3
  const orgInv = emptyInventory(input.year);
  for (const o of obsOf("ghg_mobile", null)) orgInv.fuels.push(...fuels(o, true));
  const s3 = (o: Obs, category: number, target: string, amount: number, unit: string) => {
    const f = F(target);
    if (!f) return;
    usedObs.add(o.versionId);
    const line: Scope3Line = { id: `${o.versionId}:${target}`, category, label: target, amount, unit, factor: f.value, factorSource: f.setCode, quality: o.quality };
    orgInv.scope3.push(line);
  };
  for (const o of obsOf("ghg_transport", null)) s3(o, 4, "scope3:ghg_transport", n(o.canonical), "tkm");
  for (const o of obsOf("ghg_travel", null)) s3(o, 6, "scope3:ghg_travel", n(o.canonical), "pkm");
  for (const o of obsOf("ghg_purchases", null)) for (const l of o.lines ?? []) s3(o, 1, `scope3:ghg_purchases:${l.key.toLowerCase().replace(/[^a-z0-9_.-]+/g, "_")}`, Number(l.canonical), l.canonicalUnit);
  const org = computeInventory(orgInv);

  const sum = (pick: (f: FacilityResult) => number) => facilities.reduce((s, f) => s + pick(f), 0);
  const scope1 = sum((f) => f.scope1) + org.scope1Mobile;
  const scope2Location = sum((f) => f.scope2Location);
  const scope2Market = sum((f) => f.scope2Market);
  const estimatedNum = facilities.reduce((s, f) => s + f.estimatedShare * (f.scope1 + f.scope2Location), 0) + org.estimatedShareScope12 * org.scope1Mobile;
  return {
    facilities,
    org: { mobile: org.scope1Mobile, scope3: org.scope3, scope3ByCategory: org.scope3ByCategory, certificatesMwh: cert },
    group: {
      scope1,
      scope1Stationary: sum((f) => f.scope1Stationary),
      scope1Mobile: org.scope1Mobile,
      scope1Process: sum((f) => f.scope1Process),
      scope1Fugitive: sum((f) => f.scope1Fugitive),
      scope2Location,
      scope2Market,
      scope3: org.scope3,
      totalLocation: scope1 + scope2Location + org.scope3,
      totalMarket: scope1 + scope2Market + org.scope3,
      energyGj: sum((f) => f.energyGj) + org.energyGj,
      electricityMwh: sum((f) => f.electricityMwh),
      estimatedShare: scope1 + scope2Location > 0 ? estimatedNum / (scope1 + scope2Location) : 0,
    },
    used: { observations: [...usedObs], factors: [...usedFactors] },
    warnings,
  };
}

/** Targets a run asks the registry for, from the observations and facilities it will use. */
export function ghgTargets(facilities: FacilityIn[], observations: Obs[]): string[] {
  const t = new Set<string>();
  const live = new Set(facilities.filter((f) => f.pct > 0).map((f) => f.id));
  for (const f of facilities) if (f.pct > 0 && observations.some((o) => o.metricCode === "ghg_electricity" && o.facilityId === f.id)) t.add(gridTarget(f));
  if (t.has("grid:transmission") || t.has("grid:distribution")) {
    t.add("grid:transmission");
    t.add("grid:distribution");
  }
  for (const o of observations) {
    if (o.facilityId && !live.has(o.facilityId)) continue;
    if (o.metricCode === "ghg_stationary" || o.metricCode === "ghg_mobile") for (const l of o.lines ?? []) if (FUELS[l.key as FuelId]) t.add(`fuel:${l.key}`);
    if (o.metricCode === "ghg_refrigerants") for (const l of o.lines ?? []) t.add(`gwp:${l.key.toLowerCase()}`);
    if (o.metricCode === "ghg_transport") t.add("scope3:ghg_transport");
    if (o.metricCode === "ghg_travel") t.add("scope3:ghg_travel");
    if (o.metricCode === "ghg_purchases") for (const l of o.lines ?? []) t.add(`scope3:ghg_purchases:${l.key.toLowerCase().replace(/[^a-z0-9_.-]+/g, "_")}`);
  }
  return [...t].sort();
}
