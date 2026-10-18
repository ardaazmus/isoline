import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { etsCategory, freeAllocation, isPilotYear, lastBusinessDayOfNovember, lateReportFine, pilotAdjustedFine, projectEts } from "./ets";
import {
  computeInventory,
  defaultNonCo2,
  electricityLocation,
  electricityMarket,
  FUELS,
  fuelEmissions,
  fuelGases,
  GRID_FACTORS,
  GWP_AR6,
  GWP_AR6_COMBUSTION,
  NON_CO2_MOBILE,
  NON_CO2_STATIONARY,
  nonCo2Of,
  refrigerantEmissions,
  type FuelId,
  type Inventory,
} from "./ghg";
import {
  buildPathway,
  combinedScope12Rate,
  dynamicRate,
  linearTarget,
  maccCurve,
  netZeroPath,
  pathwayRates,
  requiredReduction,
  RATE_15C,
  RATE_WB2C,
} from "./pathway";
import { classify, environment, safetyRates, taxonomyKpis, workforce } from "./indicators";
import { criteriaMet, cbam, csddd, csrd, evaluate, trEts, tsrs, type Profile } from "./applicability";

describe("TR ETS", () => {
  it("classifies installations by annual emissions", () => {
    expect(etsCategory(50_000)).toBe("A");
    expect(etsCategory(50_001)).toBe("B");
    expect(etsCategory(500_001)).toBe("C");
  });
  it("rounds free allocation up to whole allowances", () => {
    expect(freeAllocation(0.8, 1, 1, 1000)).toBe(800);
    expect(freeAllocation(0.8001, 1, 1, 1000)).toBe(801);
  });
  it("doubles late-report fines for ETS participants", () => {
    expect(lateReportFine(40_000)).toBe(627_450);
    expect(lateReportFine(100_000)).toBe(2 * 1_254_900);
  });
  it("prices nothing in the 2026 reporting-only year", () => {
    const rows = projectEts(
      { sector: "cement", emissions: 600_000, emissionsGrowth: 0, activity: 700_000, activityGrowth: 0, benchmark: 0.7, rateByYear: { 2026: 1, 2027: 1 }, coefficient: 1, price: 1000, priceGrowth: 0 },
      2026,
      2027,
    );
    expect(rows[0].cost).toBe(0);
    expect(rows[1].deficit).toBe(110_000);
    expect(rows[1].cost).toBe(110_000_000);
    // Climate Law Art. 14/4-c: 2 × price per missing allowance; provisional Art. 1(1): −80 % in the pilot
    expect(rows[1].nonSurrenderPenalty).toBeCloseTo(110_000 * 1000 * 2 * 0.2);
  });
  it("reduces fines by 80 % only in the 2026–2027 pilot", () => {
    expect(isPilotYear(2026)).toBe(true);
    expect(isPilotYear(2028)).toBe(false);
    expect(pilotAdjustedFine(627_450, 2027)).toBeCloseTo(125_490);
    expect(pilotAdjustedFine(627_450, 2028)).toBe(627_450);
  });
  it("keeps the RG 33353 Art. 35/1-a fine table", () => {
    expect(lateReportFine(250_000)).toBe(2 * 1_254_900);
    expect(lateReportFine(250_001)).toBe(2 * 2_509_800);
    expect(lateReportFine(2_000_000)).toBe(2 * 4_392_150);
    expect(lateReportFine(2_000_001)).toBe(2 * 6_274_500);
  });
  it("puts the surrender deadline on the last business day of November", () => {
    expect(lastBusinessDayOfNovember(2027)).toBe("2027-11-30");
    expect(lastBusinessDayOfNovember(2030)).toBe("2030-11-29");
    expect(lastBusinessDayOfNovember(2031)).toBe("2031-11-28");
  });
});

describe("GHG inventory", () => {
  it("computes fuel CO₂ as amount × NCV × EF and adds CH₄ and N₂O with AR6 GWPs", () => {
    // 1,000,000 Sm³ × 0.0345 GJ = 34.5 TJ; CO₂ 34.5 × 56.1 = 1,935.45 t
    // CH₄ 34.5 × 1 kg = 0.0345 t (× 29.8); N₂O 34.5 × 0.1 kg = 0.00345 t (× 273)
    const g = fuelGases({ fuel: "natural_gas", mobile: false, amount: 1_000_000, ncv: 0.0345, ef: 56.1 });
    expect(g.co2).toBeCloseTo(1935.45, 9);
    expect(g.ch4).toBeCloseTo(0.0345, 12);
    expect(g.n2o).toBeCloseTo(0.00345, 12);
    expect(g.co2e).toBeCloseTo(1935.45 + 0.0345 * 29.8 + 0.00345 * 273, 9);
    expect(fuelEmissions({ fuel: "natural_gas", mobile: false, amount: 1_000_000, ncv: 0.0345, ef: 56.1, ch4: 0, n2o: 0 })).toBeCloseTo(1935.45, 9);
  });
  it("matches IPCC 2006 Vol. 2 Tables 2.3, 3.2.2, 3.4.1 and 3.5.3 and AR6 Table 7.15", () => {
    expect(GWP_AR6_COMBUSTION).toEqual({ ch4: 29.8, n2o: 273 });
    expect(NON_CO2_STATIONARY).toEqual({
      natural_gas: { ch4: 1, n2o: 0.1 },
      diesel: { ch4: 3, n2o: 0.6 },
      gasoline: { ch4: 3, n2o: 0.6 },
      lpg: { ch4: 1, n2o: 0.1 },
      fuel_oil: { ch4: 3, n2o: 0.6 },
      coal: { ch4: 10, n2o: 1.5 },
      lignite: { ch4: 10, n2o: 1.5 },
    });
    expect(NON_CO2_MOBILE).toEqual({
      natural_gas: { ch4: 92, n2o: 3 },
      diesel: { ch4: 3.9, n2o: 3.9 },
      gasoline: { ch4: 3.8, n2o: 5.7 },
      lpg: { ch4: 62, n2o: 0.2 },
      fuel_oil: { ch4: 7, n2o: 2 },
      coal: { ch4: 2, n2o: 1.5 },
      lignite: { ch4: 10, n2o: 1.5 },
    });
  });
  it("matches the source records in docs/kaynak-veri/ipcc, value for value", () => {
    const rows = (file: string) =>
      readFileSync(join(process.cwd(), "..", "docs", "kaynak-veri", "ipcc", file), "utf8")
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .map((l) => l.split(";"));
    const csv = rows("ipcc_ch4_n2o.csv");
    expect(csv).toHaveLength(14);
    for (const [fuel, use, ch4, n2o] of csv) {
      expect(defaultNonCo2(fuel as FuelId, use === "mobile")).toEqual({ ch4: Number(ch4), n2o: Number(n2o) });
    }
    expect(Object.fromEntries(rows("ar6_gwp_combustion.csv").map(([g, v]) => [g, Number(v)]))).toEqual({ "CH4-fossil": GWP_AR6_COMBUSTION.ch4, N2O: GWP_AR6_COMBUSTION.n2o });
  });
  it("uses the line's own CH₄ and N₂O factors, else the default for its fuel and use", () => {
    expect(nonCo2Of({ fuel: "diesel", mobile: true })).toEqual({ ch4: 3.9, n2o: 3.9 });
    expect(nonCo2Of({ fuel: "diesel", mobile: false })).toEqual({ ch4: 3, n2o: 0.6 });
    expect(nonCo2Of({ fuel: "diesel", mobile: true, ch4: 0, n2o: 1 })).toEqual({ ch4: 0, n2o: 1 });
    expect(nonCo2Of({ fuel: "coal", mobile: false, ch4: -5 })).toEqual({ ch4: 0, n2o: 1.5 });
    // defaults are copies: editing one never changes the table
    defaultNonCo2("lpg", true).ch4 = 999;
    expect(NON_CO2_MOBILE.lpg.ch4).toBe(62);
  });
  it("adds about 1.6 % to diesel in road vehicles (IPCC defaults, AR6)", () => {
    const line = { fuel: "diesel" as const, mobile: true, amount: 100_000, ncv: FUELS.diesel.ncv, ef: FUELS.diesel.ef };
    const g = fuelGases(line);
    // (3.9 × 29.8 + 3.9 × 273) / 74,100 = 1,180.92 / 74,100
    expect(g.co2e / g.co2 - 1).toBeCloseTo((3.9 * 29.8 + 3.9 * 273) / 74_100, 12);
  });
  it("property: CO₂e is at least CO₂ and grows linearly with the amount", () => {
    const fuels = Object.keys(FUELS) as FuelId[];
    fc.assert(
      fc.property(
        fc.constantFrom(...fuels),
        fc.boolean(),
        fc.double({ min: 0, max: 1e9, noNaN: true }),
        fc.option(fc.double({ min: 0, max: 500, noNaN: true }), { nil: undefined }),
        fc.option(fc.double({ min: 0, max: 50, noNaN: true }), { nil: undefined }),
        (fuel, mobile, amount, ch4, n2o) => {
          const line = { fuel, mobile, amount, ncv: FUELS[fuel].ncv, ef: FUELS[fuel].ef, ch4, n2o };
          const g = fuelGases(line);
          expect(g.co2e).toBeGreaterThanOrEqual(g.co2);
          expect(g.co2e).toBeCloseTo(g.co2 + 29.8 * g.ch4 + 273 * g.n2o, 6);
          const d = fuelGases({ ...line, amount: amount * 2 });
          expect(d.co2e).toBeCloseTo(2 * g.co2e, 3);
        },
      ),
    );
  });
  it("reports combustion emissions by gas and keeps scope 1 equal to their CO₂e", () => {
    const inv: Inventory = {
      fuels: [
        { id: "a", fuel: "natural_gas", label: "", amount: 2_000_000, ncv: 0.0345, ef: 56.1, mobile: false, quality: "measured" },
        { id: "b", fuel: "diesel", label: "", amount: 50_000, ncv: FUELS.diesel.ncv, ef: 74.1, mobile: true, quality: "measured" },
      ],
      process: [],
      refrigerants: [],
      electricity: [],
      scope3: [],
      revenueMillionTry: 0,
      productionTonnes: 0,
    };
    const r = computeInventory(inv);
    const g = r.combustionGases;
    expect(r.scope1).toBeCloseTo(g.co2 + 29.8 * g.ch4 + 273 * g.n2o, 9);
    expect(r.scope1Mobile).toBeCloseTo(fuelEmissions(inv.fuels[1]), 9);
  });
  it("uses AR6 GWPs for refrigerant blends", () => {
    expect(GWP_AR6["R-410A"]).toBeCloseTo(2255.5);
    expect(refrigerantEmissions({ id: "r", gas: "R-134a", leakedKg: 10, quality: "measured" })).toBeCloseTo(15.3);
  });
  it("matches AR6 Table 7.SM.7 GWP100 values", () => {
    expect(GWP_AR6).toMatchObject({ "R-134a": 1530, "R-32": 771, "R-125": 3740, "R-143a": 5810, SF6: 24300 });
    // 0.44 × 3740 + 0.52 × 5810 + 0.04 × 1530
    expect(GWP_AR6["R-404A"]).toBeCloseTo(4728);
  });
  it("derives fuel defaults from IPCC 2006 Vol. 2 Tables 1.2 and 1.4", () => {
    // NCV in TJ/Gg = GJ/t; per-litre values use the stated densities (diesel 0.84, gasoline 0.745 kg/L)
    expect(FUELS.diesel.ncv).toBeCloseTo((43.0 * 0.84) / 1000, 6);
    expect(FUELS.gasoline.ncv).toBeCloseTo((44.3 * 0.745) / 1000, 4);
    expect(FUELS.lpg.ncv).toBeCloseTo(47.3 / 1000, 6);
    expect(FUELS.fuel_oil.ncv).toBeCloseTo(40.4 / 1000, 6);
    expect(FUELS.coal.ncv).toBe(25.8);
    expect(FUELS.lignite.ncv).toBe(11.9);
    const ef = Object.fromEntries(Object.values(FUELS).map((f) => [f.id, f.ef]));
    expect(ef).toEqual({ natural_gas: 56.1, diesel: 74.1, gasoline: 69.3, lpg: 63.1, fuel_oil: 77.4, coal: 94.6, lignite: 101.0 });
  });
  it("counts certified renewable MWh at zero in market-based scope 2", () => {
    const line = { id: "e", label: "", mwh: 1000, connection: "distribution" as const, certifiedMwh: 400, supplierFactor: null, quality: "measured" as const };
    expect(electricityMarket(line)).toBeCloseTo(600 * 0.469);
  });
  it("uses a site's own grid factor for location-based scope 2 and as the market-based fallback", () => {
    const line = { id: "e", label: "", mwh: 1000, connection: "distribution" as const, certifiedMwh: 400, supplierFactor: null, quality: "measured" as const };
    expect(electricityLocation(line)).toBeCloseTo(1000 * GRID_FACTORS.distribution);
    expect(electricityLocation({ ...line, gridFactor: null })).toBeCloseTo(1000 * GRID_FACTORS.distribution);
    expect(electricityLocation({ ...line, gridFactor: 0.291 })).toBeCloseTo(291);
    expect(electricityMarket({ ...line, gridFactor: 0.291 })).toBeCloseTo(600 * 0.291);
    expect(electricityMarket({ ...line, gridFactor: 0.291, supplierFactor: 0.1 })).toBeCloseTo(60);
  });
  it("property: market-based scope 2 never exceeds location-based when no supplier factor is set", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true }), fc.option(fc.double({ min: 0, max: 2, noNaN: true }), { nil: null }), (mwh, cert, gridFactor) => {
        const inv: Inventory = {
          fuels: [],
          process: [],
          refrigerants: [],
          electricity: [{ id: "e", label: "", mwh, connection: "transmission", gridFactor, certifiedMwh: cert, supplierFactor: null, quality: "measured" }],
          scope3: [],
          revenueMillionTry: 1,
          productionTonnes: 1,
        };
        const r = computeInventory(inv);
        expect(r.scope2Market).toBeLessThanOrEqual(r.scope2Location + 1e-9);
        expect(r.renewableShare).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe("pathways", () => {
  it("1.5 °C needs 42 % in ten years", () => {
    expect(requiredReduction(2024, 2034, RATE_15C)).toBeCloseTo(0.42);
    expect(linearTarget(1000, 2024, 2034, RATE_15C)).toBeCloseTo(580);
  });
  it("reproduces the SBTi CNZS V1.3.1 Method Appendix Table 1 reference rates", () => {
    const pct = (x: number) => Math.round(x * 10_000) / 100;
    expect([2024, 2025, 2026].map((y) => pct(combinedScope12Rate(y, y + 5, 0.5)))).toEqual([4.86, 5.13, 5.45]);
    expect([2024, 2025, 2026].map((y) => pct(combinedScope12Rate(y, y + 5, 0)))).toEqual([4.2, 4.2, 4.2]);
    expect([2024, 2025, 2026].map((y) => pct(combinedScope12Rate(y, y + 5, 1)))).toEqual([6.25, 6.67, 7.14]);
    expect([2024, 2025, 2026].map((y) => pct(dynamicRate("scope3_15c", y, y + 5)))).toEqual([4.2, 4.2, 4.2]);
    expect([2024, 2025, 2026].map((y) => pct(dynamicRate("scope3_wb2c", y, y + 5)))).toEqual([2.88, 3, 3.13]);
  });
  it("never goes below the LARR minimums of 4.2 % and 2.5 %", () => {
    expect(dynamicRate("scope3_wb2c", 2015, 2025)).toBe(RATE_WB2C);
    expect(dynamicRate("scope1", 2015, 2025)).toBe(RATE_15C);
  });
  it("adjusts for a most recent year later than the base year (Eq. 1–5)", () => {
    // Scope 2, BY 2022, MRY 2024 with equal emissions, TY 2030: TA_i = 100 %/16 × 6 = 37.5 %, rate = 37.5 % / 8
    expect(dynamicRate("scope2", 2022, 2030, { mostRecentYear: 2024 })).toBeCloseTo(0.375 / 8, 10);
    // emissions already 10 % lower in MRY: TA_c = (100 − 90 × 0.625) / 100 = 43.75 %
    expect(dynamicRate("scope2", 2022, 2030, { mostRecentYear: 2024, baseEmissions: 100, mostRecentEmissions: 90 })).toBeCloseTo(0.4375 / 8, 10);
    // the floor still applies after the conversion (WB2C: 75 %/26 × 6 / 8 ≈ 2.16 % → 2.5 %)
    expect(dynamicRate("scope3_wb2c", 2022, 2030, { mostRecentYear: 2024 })).toBe(RATE_WB2C);
  });
  it("applies the dynamic rates in the pathway", () => {
    const input = { baseYear: 2024, baseScope12: 1000, baseScope3: 1000, targetYear: 2034, bauGrowth: 0, measures: [], actuals: [] };
    const rates = pathwayRates(input);
    expect(rates.scope12).toBe(RATE_15C);
    expect(rates.wb2c).toBeCloseTo(0.75 / 26, 10);
    const row = buildPathway(input).find((r) => r.year === 2034)!;
    expect(row.target15).toBeCloseTo(1000 * (1 - 0.042 * 10) + 1000 * (1 - (0.75 / 26) * 10), 6);
    expect(pathwayRates({ ...input, scope2Share: 0.5 }).scope12).toBeCloseTo((0.9 / 26 + 1 / 16) / 2, 10);
  });
  it("net-zero path ends at 10 % residual", () => {
    expect(netZeroPath(1000, 2024, 2050)).toBeCloseTo(100);
  });
  it("orders the MACC by cost and spans cumulative abatement", () => {
    const c = maccCurve([
      { id: "a", name: "a", abatement: 100, cost: 50, startYear: 2026, rampYears: 1 },
      { id: "b", name: "b", abatement: 200, cost: -20, startYear: 2026, rampYears: 1 },
    ]);
    expect(c.map((m) => m.id)).toEqual(["b", "a"]);
    expect(c[1].x1).toBe(300);
  });
  it("property: the 1.5 °C path is never above the WB2C path", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e7, noNaN: true }), fc.double({ min: 0, max: 1e7, noNaN: true }), (s12, s3) => {
        const rows = buildPathway({ baseYear: 2024, baseScope12: s12, baseScope3: s3, targetYear: 2030, bauGrowth: 0.01, measures: [], actuals: [] }, 2050);
        rows.forEach((r) => expect(r.target15).toBeLessThanOrEqual(r.targetWb2c + 1e-6));
      }),
    );
  });
});

describe("indicators", () => {
  it("computes LTIFR and TRIR on their conventional bases", () => {
    const r = safetyRates({ hoursWorked: 2_000_000, lostTimeInjuries: 4, recordables: 10, lostDays: 50, fatalities: 0 });
    expect(r.ltifr).toBe(2);
    expect(r.trir).toBe(1);
  });
  it("computes unadjusted pay gap and turnover", () => {
    const w = workforce({ headcountStart: 900, headcountEnd: 1100, leavers: 100, trainingHours: 20_000, avgPayMen: 100, avgPayWomen: 88, women: 330, womenManagers: 20, managers: 80 });
    expect(w.turnover).toBeCloseTo(0.1);
    expect(w.payGap).toBeCloseTo(0.12);
  });
  it("converts energy to TEP and flags the 1,000 TEP energy-manager threshold", () => {
    const e = environment({ energyGj: 41_868, renewableGj: 0, waterWithdrawalM3: 10, waterDischargeM3: 4, waterStressShare: 0, wasteTotalT: 10, wasteRecoveredT: 7, wasteHazardousT: 1, revenueMillionTry: 1 });
    expect(e.energyToe).toBeCloseTo(1000);
    expect(e.energyManagerRequired).toBe(true);
    expect(e.waterConsumption).toBe(6);
  });
  it("keeps taxonomy shares between 0 and 1 and checks the 10 % not-assessed cap", () => {
    const k = taxonomyKpis(
      [
        { id: "a", name: "", code: "", turnover: 50, capex: 10, opex: 1, eligible: true, aligned: true },
        { id: "b", name: "", code: "", turnover: 5, capex: 1, opex: 1, eligible: true, aligned: false },
      ],
      { turnover: 100, capex: 20, opex: 10 },
      ["b"],
    );
    expect(k.turnover.aligned).toBe(0.5);
    expect(k.turnover.notAssessedWithinCap).toBe(true);
    expect(k.capex.notAssessed).toBeCloseTo(0.05);
  });
  it("classifies double materiality", () => {
    const c = classify({ id: "x", scale: 5, scope: 4, irremediability: 3, impactLikelihood: 5, magnitude: 2, financialLikelihood: 2, positive: false }, 3);
    expect(c.kind).toBe("impact");
  });
});

const base: Profile = {
  entityType: "listed",
  watchlistMarket: false,
  bistMainMarkets: true,
  branches: 10,
  history: [
    { totalAssetsTry: 3e9, revenueTry: 5e9, employees: 1200 },
    { totalAssetsTry: 3.5e9, revenueTry: 6e9, employees: 1250 },
  ],
  regulatedStatus: [true, true],
  reportingYear: 2026,
  firstTsrsYear: 2024,
  euEntity: false,
  euTurnoverEur: 80e6,
  euSubsidiaryTurnoverEur: 0,
  worldwideTurnoverEur: 200e6,
  employeesGroup: 1250,
  euCsrdCustomers: true,
  cbamSectors: ["iron_steel"],
  euExportTonnes: 48_200,
  annualEmissionsTco2e: 620_000,
  pilotSector: "iron_steel",
  eudrCommodities: false,
  smallOrMicro: false,
  dppProducts: true,
  batteries: false,
  energyToe: 90_000,
};

describe("applicability", () => {
  it("uses the 2025+ TSRS thresholds (1 bn / 2 bn / 500)", () => {
    expect(criteriaMet({ totalAssetsTry: 1.1e9, revenueTry: 1.9e9, employees: 600 }, 2025)).toBe(2);
    expect(criteriaMet({ totalAssetsTry: 0.6e9, revenueTry: 1.1e9, employees: 300 }, 2024)).toBe(3);
  });
  it("puts a large listed company in TSRS scope and a watch-list company out", () => {
    expect(tsrs(base).status).toBe("required");
    expect(tsrs({ ...base, watchlistMarket: true }).status).toBe("voluntary");
  });
  it("requires two years of regulated status", () => {
    expect(tsrs({ ...base, regulatedStatus: [false, true] }).status).toBe("voluntary");
  });
  it("keeps banks in scope regardless of size", () => {
    expect(tsrs({ ...base, entityType: "bank", history: [{ totalAssetsTry: 1, revenueTry: 1, employees: 1 }, { totalAssetsTry: 1, revenueTry: 1, employees: 1 }] }).status).toBe("required");
  });
  it("puts a category C steel plant in the ETS pilot with the monitoring-plan deadline", () => {
    const f = trEts(base);
    expect(f.status).toBe("required");
    expect(f.dates.some((d) => d.key === "ets_monitoring_plan")).toBe(true);
    // RG 33353 provisional Art. 3: first monitoring plan within 2 months of 27.08.2026
    expect(f.dates.find((d) => d.key === "ets_monitoring_plan")!.date).toBe("2026-10-27");
  });
  it("dates ETS reports on 30 April and surrender on the last business day of November", () => {
    const f = trEts({ ...base, reportingYear: 2029 });
    expect(f.dates.find((d) => d.key === "ets_report")!.date).toBe("2030-04-30");
    expect(f.dates.find((d) => d.key === "ets_surrender")!.date).toBe("2030-11-29");
  });
  it("flags the CBAM de minimis check up to and including 50 t", () => {
    expect(cbam({ ...base, euExportTonnes: 50 }).notes).toContain("cbam.de_minimis_check");
    expect(cbam({ ...base, euExportTonnes: 51 }).notes).not.toContain("cbam.de_minimis_check");
  });
  it("applies the Omnibus I thresholds: more than 1,000 employees and €450 m turnover", () => {
    const eu = { ...base, euEntity: true, euCsrdCustomers: false };
    expect(csrd({ ...eu, employeesGroup: 1001, worldwideTurnoverEur: 450_000_001 }).status).toBe("required");
    expect(csrd({ ...eu, employeesGroup: 1000, worldwideTurnoverEur: 900e6 }).status).toBe("not_applicable");
    expect(csrd({ ...eu, employeesGroup: 5000, worldwideTurnoverEur: 450e6 }).status).toBe("not_applicable");
    expect(csddd({ ...eu, employeesGroup: 5001, worldwideTurnoverEur: 1_500_000_001 }).dates[0].date).toBe("2029-07-26");
  });
  it("keeps the TSRS threshold transition under review for 2025", () => {
    expect(tsrs({ ...base, reportingYear: 2025, firstTsrsYear: 2025 }).notes).toContain("tsrs.threshold_transition_review");
  });
  it("treats a Turkish exporter as indirectly affected by CBAM and CSRD", () => {
    expect(cbam(base).status).toBe("indirect");
    expect(csrd(base).status).toBe("indirect");
  });
  it("exempts small unlisted banks only during the scope 3 relief years", () => {
    const small = { ...base, entityType: "bank" as const, sharesListed: false, branches: 1, firstTsrsYear: null, reportingYear: 2026 };
    expect(tsrs(small).status).toBe("voluntary");
    expect(tsrs({ ...small, firstTsrsYear: 2024 }).status).toBe("required");
    expect(tsrs({ ...small, sharesListed: true }).status).toBe("required");
    expect(tsrs({ ...small, branches: 12, history: [base.history[0], { ...base.history[1], employees: 900 }] }).status).toBe("required");
  });
  it("requires EU turnover above €450 m in both of the last two years for a non-EU parent", () => {
    const f = csrd({ ...base, euTurnoverEur: 500e6, euTurnoverPrevEur: 430e6, euSubsidiaryTurnoverEur: 250e6 });
    expect(f.status).not.toBe("required");
  });
  it("puts a non-EU parent with large EU business in CSRD scope from FY2028", () => {
    const f = csrd({ ...base, euTurnoverEur: 500e6, euSubsidiaryTurnoverEur: 250e6 });
    expect(f.status).toBe("required");
    expect(f.firstYear).toBe(2028);
  });
  it("marks the sources verified against primary texts in October 2026 as official", async () => {
    const { SOURCES } = await import("@/data/sources");
    const verified = ["kgk_scope_2026", "bddk_ar", "cbam_reg", "cbam_factor", "cbam_faa", "cbam_cscf", "cbam_deduction_draft", "csrd_omnibus", "ipcc_2006", "ipcc_ar6_gwp", "sbti_criteria", "tr_ets_reg", "kpk_2026_1", "climate_law"];
    verified.forEach((id) => expect(SOURCES[id]?.confidence, id).toBe("official"));
    expect(SOURCES.kgk_scope_2026.url).toContain("20260116-3.pdf");
  });
  it("every finding cites at least one known source", async () => {
    const { SOURCES } = await import("@/data/sources");
    for (const f of evaluate(base)) {
      expect(f.sources.length).toBeGreaterThan(0);
      f.sources.forEach((s) => expect(SOURCES[s], s).toBeDefined());
    }
  });
});
