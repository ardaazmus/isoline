import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { classify } from "@/lib/calc/indicators";
import { AR_ITEMS } from "@/data/annual-report";
import { annualReportItems, annualReportStatus, cbamFrom, cbamProductsFrom, etsFrom, inventoryOf, materialityResult, pathwayFrom, taxonomyFacts, taxonomyWarnings, type ApprovedFact } from "./compute";
import { MaterialitySheet, PathwaySheet, TaxonomySheet, type MaterialityPayload, type TaxonomyPayload } from "./schemas";

const topic = (id: string, s: Partial<MaterialityPayload["topics"][number]> = {}): MaterialityPayload["topics"][number] => ({
  id,
  name: `Konu ${id}`,
  pillar: "E",
  positive: false,
  scale: 3,
  scope: 3,
  irremediability: 3,
  impactLikelihood: 5,
  magnitude: 2,
  financialLikelihood: 2,
  ...s,
});

describe("materiality worksheet", () => {
  it("classifies with the toolkit engine and lists material topics strongest first", () => {
    const p = { threshold: 3, topics: [topic("a"), topic("b", { scale: 1, scope: 1, irremediability: 1, magnitude: 5, financialLikelihood: 5 }), topic("c", { scale: 1, scope: 1, irremediability: 1, impactLikelihood: 1 })] };
    const r = materialityResult(p);
    expect(r.rows.map((x) => x.kind)).toEqual(["impact", "financial", "none"]);
    expect(r.material.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("refuses duplicate topic ids and out-of-scale scores", () => {
    expect(MaterialitySheet.safeParse({ threshold: 3, topics: [topic("a"), topic("a")] }).success).toBe(false);
    expect(MaterialitySheet.safeParse({ threshold: 3, topics: [topic("a", { scale: 6 })] }).success).toBe(false);
  });

  it("agrees with classify for any scores", () => {
    const s = fc.integer({ min: 1, max: 5 });
    fc.assert(
      fc.property(fc.record({ scale: s, scope: s, irremediability: s, impactLikelihood: s, magnitude: s, financialLikelihood: s, positive: fc.boolean() }), fc.integer({ min: 1, max: 5 }), (t, th) => {
        const row = materialityResult({ threshold: th, topics: [topic("x", t)] }).rows[0];
        const c = classify({ ...t, id: "x" }, th);
        expect(row.material).toBe(c.material);
        expect(row.kind).toBe(c.kind);
      }),
    );
  });
});

const tax = (over: Partial<TaxonomyPayload> = {}): TaxonomyPayload => ({
  totals: { turnover: 1000, capex: 200, opex: 100 },
  activities: [
    { id: "a1", name: "Güneş enerjisi üretimi", code: "4.1", turnover: 300, capex: 120, opex: 10, eligible: true, aligned: true },
    { id: "a2", name: "Çelik üretimi", code: "3.9", turnover: 500, capex: 50, opex: 40, eligible: true, aligned: false },
  ],
  notAssessed: [],
  ...over,
});

describe("taxonomy worksheet", () => {
  it("writes eligible / aligned / not eligible shares for each KPI", () => {
    const f = Object.fromEntries(taxonomyFacts(tax()).map((x) => [x.metricKey, x.valueNum]));
    expect(f["taxonomy.turnover.eligible"]).toBeCloseTo(0.8, 10);
    expect(f["taxonomy.turnover.aligned"]).toBeCloseTo(0.3, 10);
    expect(f["taxonomy.capex.aligned"]).toBeCloseTo(0.6, 10);
    expect(f["taxonomy.opex.not_eligible"]).toBeCloseTo(0.5, 10);
  });

  it("skips a KPI without a denominator and blocks activities larger than the total", () => {
    expect(taxonomyFacts(tax({ totals: { turnover: 1000, capex: 0, opex: 100 } })).some((f) => f.metricKey.startsWith("taxonomy.capex"))).toBe(false);
    const w = taxonomyWarnings(tax({ totals: { turnover: 100, capex: 200, opex: 100 } }));
    expect(w.find((x) => x.target === "turnover")).toMatchObject({ code: "taxonomy_exceeds_total", severity: "blocker" });
  });

  it("refuses an aligned activity that is not eligible, and not-assessed ids that are not eligible activities", () => {
    expect(TaxonomySheet.safeParse(tax({ activities: [{ id: "x", name: "X", code: "", turnover: 1, capex: 0, opex: 0, eligible: false, aligned: true }] })).success).toBe(false);
    expect(TaxonomySheet.safeParse(tax({ notAssessed: ["nope"] })).success).toBe(false);
  });

  it("keeps the shares of each KPI within [0, 1] and summing to one", () => {
    const amount = fc.integer({ min: 0, max: 1000 });
    fc.assert(
      fc.property(fc.array(fc.record({ turnover: amount, capex: amount, opex: amount, eligible: fc.boolean(), aligned: fc.boolean() }), { maxLength: 6 }), (acts) => {
        const activities = acts.map((a, i) => ({ ...a, aligned: a.eligible && a.aligned, id: `a${i}`, name: `A${i}`, code: "" }));
        const totals = { turnover: activities.reduce((s, a) => s + a.turnover, 0) + 1, capex: activities.reduce((s, a) => s + a.capex, 0) + 1, opex: activities.reduce((s, a) => s + a.opex, 0) + 1 };
        const f = taxonomyFacts({ totals, activities, notAssessed: [] });
        for (const k of ["turnover", "capex", "opex"]) {
          const v = (s: string) => f.find((x) => x.metricKey === `taxonomy.${k}.${s}`)!.valueNum;
          expect(v("aligned")).toBeLessThanOrEqual(v("eligible") + 1e-12);
          expect(v("eligible") + v("not_assessed") + v("not_eligible")).toBeCloseTo(1, 9);
          for (const s of ["eligible", "aligned", "not_assessed", "not_eligible"]) expect(v(s)).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});

describe("annual report checklist", () => {
  it("is complete only when every item of the profile is met, or not applicable with a reason", () => {
    const items = annualReportItems("ttk");
    expect(items.length).toBe(AR_ITEMS.filter((i) => i.profiles.includes("ttk")).length);
    const all = Object.fromEntries(items.map((i) => [i.id, { status: "met" as const }]));
    expect(annualReportStatus({ profile: "ttk", items: all }).complete).toBe(true);
    const first = items[0].id;
    expect(annualReportStatus({ profile: "ttk", items: { ...all, [first]: { status: "na" } } })).toMatchObject({ complete: false, naWithoutReason: 1 });
    expect(annualReportStatus({ profile: "ttk", items: { ...all, [first]: { status: "na", note: "Şirketin imtiyazlı payı yok." } } }).complete).toBe(true);
    expect(annualReportStatus({ profile: "ttk", items: { ...all, [first]: { status: "missing" } } }).complete).toBe(false);
    const rest = Object.fromEntries(Object.entries(all).filter(([k]) => k !== first));
    expect(annualReportStatus({ profile: "ttk", items: rest })).toMatchObject({ complete: false, unmarked: 1 });
    // a listed company has the SPK items on top
    expect(annualReportStatus({ profile: "listed", items: all }).complete).toBe(false);
  });
});

const facts = (rows: [string, string | null, number][]): ApprovedFact[] => rows.map(([k, f, v]) => ({ metricKey: k, facilityId: f, boundaryKind: f ? null : "ghg_operational_control", value: v }));

describe("analysis on approved figures", () => {
  const current = facts([
    ["ghg.scope1", null, 3600],
    ["ghg.scope2.location", null, 900],
    ["ghg.scope3", null, 500],
  ]);

  it("takes the pathway's base year from the base-year cycle when it is not typed in", () => {
    const sheet = PathwaySheet.parse({ baseYear: 2024, baseScope12: null, baseScope3: null, scope2Share: null, targetYear: 2030, bauGrowth: 0.01, measures: [{ id: "m1", name: "Isı geri kazanımı", abatement: 300, cost: -20, startYear: 2026, rampYears: 2 }] });
    expect(pathwayFrom(sheet, { year: 2026, facts: current }, null)).toEqual({ missing: "base" });
    const r = pathwayFrom(sheet, { year: 2026, facts: current }, facts([["ghg.scope1", null, 4000], ["ghg.scope2.location", null, 1000]]));
    if ("missing" in r) throw new Error("expected a pathway");
    expect(r.base).toEqual({ scope12: 5000, scope3: 0, fromCycle: true });
    expect(r.actual).toEqual({ year: 2026, value: 5000 });
    expect(r.rows[0].year).toBe(2024);
    expect(inventoryOf(current).scope2Share).toBeCloseTo(0.2, 10);
  });

  it("uses verified ETS emissions, else scope 1, for the ETS category", () => {
    const sheet = { sector: "iron_steel" as const, emissions: null, emissionsGrowth: 0, activity: 1000, activityGrowth: 0, benchmark: 1.3, freeRate: 1, coefficient: 1, price: 500, priceGrowth: 0 };
    const a = etsFrom(sheet, current, 2026);
    if ("missing" in a) throw new Error("expected a result");
    expect(a).toMatchObject({ emissions: 3600, source: "scope1" });
    const b = etsFrom(sheet, [...current, ...facts([["ets.verified_emissions", "f1", 60000]])], 2026);
    if ("missing" in b) throw new Error("expected a result");
    expect(b).toMatchObject({ emissions: 60000, source: "ets", category: "B", covered: true });
    expect(b.years).toHaveLength(9);
    expect(etsFrom(sheet, [], 2026)).toEqual({ missing: "emissions" });
  });

  it("builds CBAM products from the approved run and skips codes outside Annex I", () => {
    const f = facts([
      ["cbam.see.7208", "f1", 2],
      ["cbam.embedded.7208", "f1", 1000],
      ["cbam.see.0101", "f1", 1],
      ["cbam.embedded.0101", "f1", 10],
    ]);
    const p = cbamProductsFrom(f, 0);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ cn: "7208", sector: "iron_steel", tonnes: 500, seeDirect: 2 });
    const r = cbamFrom({ startPrice: 80, priceGrowth: 0.05, originCarbonPrice: 0, eurTry: 40, growth: 0 }, f);
    if ("missing" in r) throw new Error("expected a projection");
    expect(r.years[0].year).toBe(2026);
    expect(r.years.at(-1)!.cost).toBeGreaterThan(r.years[0].cost);
    expect(cbamFrom({ startPrice: 80, priceGrowth: 0, originCarbonPrice: 0, eurTry: 40, growth: 0 }, [])).toEqual({ missing: "cbam" });
  });
});
