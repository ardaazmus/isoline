/**
 * G4-09: the GHG wrapper gives the toolkit's numbers (parity with `computeInventory` on the same activity data),
 * scales linearly with boundary shares, spreads certificates by consumption and never invents a factor.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeInventory, ETKB_EDITIONS, FUELS, GWP_AR6, type Inventory } from "@/lib/calc/ghg";
import type { ResolvedFactor } from "./factors";
import { computeGhg, ghgTargets, gridTarget, nativeAmount, type FacilityIn, type Obs } from "./ghg-engine";

const rf = (target: string, value: number, extra: Partial<ResolvedFactor> = {}): ResolvedFactor => ({ target, valueId: `v-${target}`, setId: "s", setCode: "test", edition: null, licence: "open", key: target.split(":")[1], value, unit: null, ncv: null, ch4: null, n2o: null, chosen: false, ...extra });
const etkb = ETKB_EDITIONS.at(-1)!;
const FACTORS: Record<string, ResolvedFactor> = {
  "fuel:natural_gas": rf("fuel:natural_gas", FUELS.natural_gas.ef, { ncv: FUELS.natural_gas.ncv }),
  "fuel:diesel": rf("fuel:diesel", FUELS.diesel.ef, { ncv: FUELS.diesel.ncv }),
  "fuel:coal": rf("fuel:coal", FUELS.coal.ef, { ncv: FUELS.coal.ncv }),
  "gwp:r-410a": rf("gwp:r-410a", GWP_AR6["R-410A"]),
  "grid:transmission": rf("grid:transmission", etkb.factors["TR-transmission"].tco2e, { edition: etkb.year }),
  "grid:distribution": rf("grid:distribution", etkb.factors["TR-distribution"].tco2e, { edition: etkb.year }),
};

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const line = (key: string, canonical: number, canonicalUnit: string) => ({ key, value: String(canonical), unit: canonicalUnit, canonical: String(canonical), canonicalUnit });

type Site = { gasM3: number; dieselL: number; processT: number; refKg: number; elecMwh: number; connection: "transmission" | "distribution" };

function observations(id: string, s: Site): Obs[] {
  return [
    { versionId: `${id}-s`, metricCode: "ghg_stationary", facilityId: id, canonical: null, canonicalUnit: null, lines: [line("natural_gas", s.gasM3, "m3"), line("diesel", s.dieselL / 1000, "m3")], quality: "measured" },
    { versionId: `${id}-p`, metricCode: "ghg_process", facilityId: id, canonical: String(s.processT), canonicalUnit: "tCO2e", lines: null, quality: "calculated" },
    { versionId: `${id}-r`, metricCode: "ghg_refrigerants", facilityId: id, canonical: null, canonicalUnit: null, lines: [line("R-410A", s.refKg / 1000, "t")], quality: "estimated" },
    { versionId: `${id}-e`, metricCode: "ghg_electricity", facilityId: id, canonical: String(s.elecMwh * 3.6), canonicalUnit: "GJ", lines: null, quality: "measured" },
  ];
}

function toolkit(s: Site, certifiedMwh = 0): Inventory {
  return {
    grid: { transmission: etkb.factors["TR-transmission"].tco2e, distribution: etkb.factors["TR-distribution"].tco2e, edition: String(etkb.year) },
    fuels: [
      { id: "g", fuel: "natural_gas", label: "", amount: s.gasM3, ncv: FUELS.natural_gas.ncv, ef: FUELS.natural_gas.ef, mobile: false, quality: "measured" },
      { id: "d", fuel: "diesel", label: "", amount: s.dieselL, ncv: FUELS.diesel.ncv, ef: FUELS.diesel.ef, mobile: false, quality: "measured" },
    ],
    process: [{ id: "p", label: "", tco2e: s.processT, quality: "calculated" }],
    refrigerants: [{ id: "r", gas: "R-410A", leakedKg: s.refKg, quality: "estimated" }],
    electricity: [{ id: "e", label: "", mwh: s.elecMwh, connection: s.connection, certifiedMwh, supplierFactor: null, quality: "measured" }],
    scope3: [],
    revenueMillionTry: 0,
    productionTonnes: 0,
  };
}

const site = fc.record({
  gasM3: fc.double({ min: 0, max: 5e6, noNaN: true }),
  dieselL: fc.double({ min: 0, max: 1e6, noNaN: true }),
  processT: fc.double({ min: 0, max: 1e5, noNaN: true }),
  refKg: fc.double({ min: 0, max: 500, noNaN: true }),
  elecMwh: fc.double({ min: 0, max: 1e5, noNaN: true }),
  connection: fc.constantFrom("transmission" as const, "distribution" as const),
});

describe("GHG wrapper", () => {
  it("parity: one facility at 100 % gives the toolkit's scope 1, scope 2 (both methods) and energy", () => {
    fc.assert(
      fc.property(site, (s) => {
        const out = computeGhg({ year: etkb.year, facilities: [{ id: "f1", pct: 100, connection: s.connection, country: "TR" }], observations: observations("f1", s), factors: FACTORS });
        const v1 = computeInventory(toolkit(s));
        expect(close(out.group.scope1, v1.scope1)).toBe(true);
        expect(close(out.group.scope1Fugitive, v1.scope1Fugitive)).toBe(true);
        expect(close(out.group.scope2Location, v1.scope2Location)).toBe(true);
        expect(close(out.group.scope2Market, v1.scope2Market)).toBe(true);
        expect(close(out.group.energyGj, v1.energyGj)).toBe(true);
        expect(out.warnings.filter((w) => w.code === "factor_missing")).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it("a known case: 1,000,000 Sm³ natural gas and 2,000 MWh from the distribution grid", () => {
    const s: Site = { gasM3: 1_000_000, dieselL: 0, processT: 0, refKg: 0, elecMwh: 2000, connection: "distribution" };
    const out = computeGhg({ year: etkb.year, facilities: [{ id: "f", pct: 100, connection: "distribution", country: "TR" }], observations: observations("f", s), factors: FACTORS });
    // 1e6 Sm³ × 0.0345 GJ = 34.5 TJ: CO₂ 34.5 × 56.1 = 1,935.45 t; CH₄ 1 kg/TJ → 0.0345 t × 29.8; N₂O 0.1 kg/TJ
    // → 0.00345 t × 273 (IPCC 2006 Vol. 2 Table 2.2 stationary defaults, AR6 GWP) = 1,937.41995 tCO₂e
    expect(out.group.scope1Stationary).toBeCloseTo(1937.41995, 6);
    expect(out.group.scope2Location).toBeCloseTo(2000 * etkb.factors["TR-distribution"].tco2e, 9);
  });

  it("boundary shares scale linearly: group = Σ share × facility at 100 %", () => {
    fc.assert(
      fc.property(site, site, fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b, pa, pb) => {
        const facs: FacilityIn[] = [
          { id: "a", pct: pa, connection: a.connection, country: "TR" },
          { id: "b", pct: pb, connection: b.connection, country: "TR" },
        ];
        const out = computeGhg({ year: etkb.year, facilities: facs, observations: [...observations("a", a), ...observations("b", b)], factors: FACTORS });
        const one = (s: Site) => computeInventory(toolkit(s));
        const expected = (pa / 100) * one(a).scope1 + (pb / 100) * one(b).scope1;
        expect(close(out.group.scope1, expected)).toBe(true);
        const loc = (pa / 100) * one(a).scope2Location + (pb / 100) * one(b).scope2Location;
        expect(close(out.group.scope2Location, loc)).toBe(true);
        // a facility outside the boundary contributes nothing and is not listed
        expect(out.facilities.map((f) => f.facilityId).sort()).toEqual([...(pa > 0 ? ["a"] : []), ...(pb > 0 ? ["b"] : [])]);
      }),
      { numRuns: 150 },
    );
  });

  it("certificates are spread by consumption and never cover more than was consumed", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e5, noNaN: true }), fc.double({ min: 1, max: 1e5, noNaN: true }), fc.double({ min: 0, max: 3e5, noNaN: true }), (ma, mb, cert) => {
        const zero = { gasM3: 0, dieselL: 0, processT: 0, refKg: 0, connection: "distribution" as const };
        const obs = [...observations("a", { ...zero, elecMwh: ma }), ...observations("b", { ...zero, elecMwh: mb }), { versionId: "c", metricCode: "ghg_certificates", facilityId: null, canonical: String(cert * 3.6), canonicalUnit: "GJ", lines: null, quality: "measured" as const }];
        const out = computeGhg({ year: etkb.year, facilities: [{ id: "a", pct: 100, connection: "distribution", country: "TR" }, { id: "b", pct: 100, connection: "distribution", country: "TR" }], observations: obs, factors: FACTORS });
        const f = etkb.factors["TR-distribution"].tco2e;
        const covered = Math.min(cert, ma + mb);
        expect(close(out.group.scope2Market, (ma + mb - covered) * f)).toBe(true);
        expect(out.group.scope2Market).toBeLessThanOrEqual(out.group.scope2Location + 1e-6);
        expect(out.warnings.some((w) => w.code === "certificates_exceed_consumption")).toBe(cert > ma + mb + 1e-9);
      }),
      { numRuns: 150 },
    );
  });

  it("no silent factor: a missing fuel, GWP or scope 3 factor is reported and the line is left out", () => {
    const obs: Obs[] = [
      { versionId: "s", metricCode: "ghg_stationary", facilityId: "f", canonical: null, canonicalUnit: null, lines: [line("lignite", 10, "t")], quality: "measured" },
      { versionId: "r", metricCode: "ghg_refrigerants", facilityId: "f", canonical: null, canonicalUnit: null, lines: [line("R-32", 0.01, "t")], quality: "measured" },
      { versionId: "t", metricCode: "ghg_transport", facilityId: null, canonical: "1000", canonicalUnit: "tkm", lines: null, quality: "measured" },
    ];
    const out = computeGhg({ year: 2024, facilities: [{ id: "f", pct: 100, connection: "distribution", country: "TR" }], observations: obs, factors: {} });
    expect(out.warnings.filter((w) => w.code === "factor_missing").map((w) => w.target).sort()).toEqual(["fuel:lignite", "gwp:r-32", "scope3:ghg_transport"]);
    expect(out.group.scope1).toBe(0);
    expect(out.group.scope3).toBe(0);
    expect(out.used.observations).toEqual([]);
  });

  it("scope 3 uses the chosen factor and its category", () => {
    const obs: Obs[] = [{ versionId: "t", metricCode: "ghg_transport", facilityId: null, canonical: "200000", canonicalUnit: "tkm", lines: null, quality: "measured" }];
    const out = computeGhg({ year: 2026, facilities: [], observations: obs, factors: { "scope3:ghg_transport": rf("scope3:ghg_transport", 0.0001) } });
    expect(out.group.scope3).toBeCloseTo(20, 9);
    expect(out.org.scope3ByCategory).toEqual({ 4: 20 });
  });

  it("targets: what the observations need, lower-case, both grid points for Türkiye and EEA for a site abroad", () => {
    const facs: FacilityIn[] = [
      { id: "tr", pct: 100, connection: "transmission", country: "TR" },
      { id: "de", pct: 100, connection: "distribution", country: "DE" },
      { id: "out", pct: 0, connection: "distribution", country: "TR" },
    ];
    const obs: Obs[] = [
      ...observations("tr", { gasM3: 1, dieselL: 1, processT: 0, refKg: 1, elecMwh: 1, connection: "transmission" }),
      { versionId: "de-e", metricCode: "ghg_electricity", facilityId: "de", canonical: "36", canonicalUnit: "GJ", lines: null, quality: "measured" },
      { versionId: "out-s", metricCode: "ghg_stationary", facilityId: "out", canonical: null, canonicalUnit: null, lines: [line("coal", 1, "t")], quality: "measured" },
    ];
    expect(ghgTargets(facs, obs)).toEqual(["fuel:diesel", "fuel:natural_gas", "grid:distribution", "grid:eea-de", "grid:transmission", "gwp:r-410a"]);
    expect(gridTarget({ connection: "transmission", country: "TR" })).toBe("grid:transmission");
  });

  it("a site abroad uses the EEA country factor for location-based scope 2", () => {
    const obs: Obs[] = [{ versionId: "e", metricCode: "ghg_electricity", facilityId: "de", canonical: String(1000 * 3.6), canonicalUnit: "GJ", lines: null, quality: "measured" }];
    const out = computeGhg({ year: 2024, facilities: [{ id: "de", pct: 100, connection: "distribution", country: "DE" }], observations: obs, factors: { "grid:eea-de": rf("grid:eea-de", 0.33, { edition: 2024 }) } });
    expect(out.group.scope2Location).toBeCloseTo(330, 9);
  });

  it("native amounts: m³ → L for liquids, t → kg, energy via NCV, and a warning when density is assumed", () => {
    expect(nativeAmount("diesel", 2, "m3", FUELS.diesel.ncv)).toEqual({ amount: 2000 });
    expect(nativeAmount("lpg", 3, "t", FUELS.lpg.ncv)).toEqual({ amount: 3000 });
    expect(nativeAmount("coal", 5, "t", FUELS.coal.ncv)).toEqual({ amount: 5 });
    const d = nativeAmount("diesel", 0.84, "t", FUELS.diesel.ncv);
    expect(d.amount).toBeCloseTo(1000, 9);
    expect(d.warning).toBe("density_assumption");
    const e = nativeAmount("natural_gas", 34.5, "GJ", 0.0345);
    expect(e.amount).toBeCloseTo(1000, 9);
    expect(e.warning).toBe("energy_entered_for_fuel");
    expect(nativeAmount("natural_gas", 1, "t", 0.0345)).toEqual({ amount: null, warning: "fuel_unit_unsupported" });
  });
});
