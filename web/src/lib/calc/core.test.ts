import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { etsCategory, freeAllocation, lateReportFine, projectEts } from "./ets";
import { computeInventory, electricityMarket, fuelEmissions, GWP_AR6, refrigerantEmissions, type Inventory } from "./ghg";
import { buildPathway, linearTarget, maccCurve, netZeroPath, requiredReduction, RATE_15C } from "./pathway";
import { classify, environment, safetyRates, taxonomyKpis, workforce } from "./indicators";
import { criteriaMet, cbam, csrd, evaluate, trEts, tsrs, type Profile } from "./applicability";

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
  });
});

describe("GHG inventory", () => {
  it("computes fuel CO₂ as amount × NCV × EF", () => {
    // 1,000,000 Sm³ × 0.0345 GJ × 56.1 t/TJ = 1,935.45 t
    expect(fuelEmissions({ amount: 1_000_000, ncv: 0.0345, ef: 56.1 })).toBeCloseTo(1935.45, 2);
  });
  it("uses AR6 GWPs for refrigerant blends", () => {
    expect(GWP_AR6["R-410A"]).toBeCloseTo(2255.5);
    expect(refrigerantEmissions({ id: "r", gas: "R-134a", leakedKg: 10, quality: "measured" })).toBeCloseTo(15.3);
  });
  it("counts certified renewable MWh at zero in market-based scope 2", () => {
    const line = { id: "e", label: "", mwh: 1000, connection: "distribution" as const, certifiedMwh: 400, supplierFactor: null, quality: "measured" as const };
    expect(electricityMarket(line)).toBeCloseTo(600 * 0.469);
  });
  it("property: market-based scope 2 never exceeds location-based when no supplier factor is set", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e6, noNaN: true }), fc.double({ min: 0, max: 1e6, noNaN: true }), (mwh, cert) => {
        const inv: Inventory = {
          fuels: [],
          process: [],
          refrigerants: [],
          electricity: [{ id: "e", label: "", mwh, connection: "transmission", certifiedMwh: cert, supplierFactor: null, quality: "measured" }],
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
  });
  it("treats a Turkish exporter as indirectly affected by CBAM and CSRD", () => {
    expect(cbam(base).status).toBe("indirect");
    expect(csrd(base).status).toBe("indirect");
  });
  it("puts a non-EU parent with large EU business in CSRD scope from FY2028", () => {
    const f = csrd({ ...base, euTurnoverEur: 500e6, euSubsidiaryTurnoverEur: 250e6 });
    expect(f.status).toBe("required");
    expect(f.firstYear).toBe(2028);
  });
  it("every finding cites at least one known source", async () => {
    const { SOURCES } = await import("@/data/sources");
    for (const f of evaluate(base)) {
      expect(f.sources.length).toBeGreaterThan(0);
      f.sources.forEach((s) => expect(SOURCES[s], s).toBeDefined());
    }
  });
});
