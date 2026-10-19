/** G4-04..06 and G4-09: environment, workforce, finance, CBAM and ETS wrappers; run evaluation is deterministic. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { defaultMarkup } from "@/lib/calc/cbam";
import type { TrialBalance } from "@/lib/trial-balance";
import { computeCbam, computeEnvironment, computeEts, computeFinance, computeWorkforce, cbamTargets, MIN_GROUP } from "./engines";
import type { Obs } from "./ghg-engine";
import { evaluate, inputDigest, outputDigest, type Snapshot } from "./service";

const o = (versionId: string, metricCode: string, facilityId: string | null, canonical: number, quality: Obs["quality"] = "measured"): Obs => ({ versionId, metricCode, facilityId, canonical: String(canonical), canonicalUnit: null, lines: null, quality });
const lines = (versionId: string, metricCode: string, facilityId: string, rows: [string, number][]): Obs => ({ versionId, metricCode, facilityId, canonical: null, canonicalUnit: null, lines: rows.map(([key, v]) => ({ key, value: String(v), unit: "t", canonical: String(v), canonicalUnit: "t" })), quality: "measured" });
const facs = [
  { id: "a", pct: 100, country: "TR" },
  { id: "b", pct: 50, country: "TR" },
  { id: "x", pct: 0, country: "TR" },
];
const fact = (r: { facts: { metricKey: string; valueNum?: number; valueText?: string; suppressed?: boolean }[] }, k: string) => r.facts.find((f) => f.metricKey === k);

describe("environment", () => {
  it("sums facility values by boundary share and derives renewable share, water consumption and intensity", () => {
    const r = computeEnvironment({
      facilities: facs,
      observations: [o("1", "env_energy", "a", 1000), o("2", "env_energy", "b", 400), o("3", "env_energy", "x", 9999), o("4", "env_renewable", "a", 300), o("5", "env_water_withdrawal", "a", 50), o("6", "env_water_discharge", "a", 20), o("7", "net_sales", null, 600_000_000)],
    });
    expect(fact(r, "env.energy_gj")!.valueNum).toBe(1200);
    expect(fact(r, "env.renewable_share")!.valueNum).toBeCloseTo(0.25, 12);
    expect(fact(r, "env.water_consumption_m3")!.valueNum).toBe(30);
    expect(fact(r, "env.energy_intensity")!.valueNum).toBeCloseTo(2, 12); // 1200 GJ / 600 mTRY
    expect(r.used.observations).not.toContain("3"); // outside the boundary
  });

  it("flags renewable energy above total energy", () => {
    const r = computeEnvironment({ facilities: facs, observations: [o("1", "env_energy", "a", 10), o("2", "env_renewable", "a", 20)] });
    expect(r.warnings.map((w) => w.code)).toContain("renewable_exceeds_energy");
  });
});

describe("workforce", () => {
  it("suppresses the women share when either group has fewer than five people (KVKK md. 6)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 0, max: 200 }), (headcount, w) => {
        const women = Math.min(w, headcount);
        const r = computeWorkforce({ facilities: [], observations: [o("h", "work_headcount", null, headcount), o("w", "work_diversity", null, women)] });
        const share = fact(r, "workforce.women_share")!;
        expect(share.suppressed).toBe(women < MIN_GROUP || headcount - women < MIN_GROUP);
        expect(share.valueNum).toBeCloseTo(women / headcount, 12);
      }),
    );
  });

  it("LTIFR per million hours from facility hours and lost-time injuries", () => {
    const r = computeWorkforce({ facilities: facs, observations: [o("1", "ohs_hours", "a", 400_000), o("2", "ohs_hours", "b", 200_000), o("3", "ohs_incidents", "a", 2)] });
    expect(fact(r, "ohs.hours_worked")!.valueNum).toBe(500_000);
    expect(fact(r, "ohs.ltifr")!.valueNum).toBeCloseTo(4, 12);
  });
});

const tb = (year: number | undefined, accounts: [string, number, number][]): TrialBalance => ({
  fileName: "mizan.csv",
  sha256: "0".repeat(64),
  importedAt: "2027-01-10T00:00:00.000Z",
  year,
  rows: accounts.length,
  balanceSource: "movements",
  accounts: accounts.map(([code, debit, credit]) => ({ code, name: code, debit, credit, balance: debit - credit })),
});

describe("finance", () => {
  const balanced = tb(2026, [
    ["600", 0, 1_000_000],
    ["610", 20_000, 0],
    ["100", 980_000, 0],
  ]);
  it("net sales come from the trial balance (600–602 less 610–612) and are reconciled with the reported figure", () => {
    const ok = computeFinance({ facilities: [], observations: [o("n", "net_sales", null, 981_000)], year: 2026, tb: { evidenceId: "e", filename: "m.csv", sha256: "s", parsed: balanced } });
    expect(fact(ok, "finance.net_sales")!.valueNum).toBe(980_000);
    expect(ok.warnings.map((w) => w.code)).toEqual([]); // 0.1 % apart, inside 0.5 %
    const off = computeFinance({ facilities: [], observations: [o("n", "net_sales", null, 1_000_000)], year: 2026, tb: { evidenceId: "e", filename: "m.csv", sha256: "s", parsed: balanced } });
    expect(off.warnings.map((w) => w.code)).toEqual(["tb_net_sales_mismatch"]);
  });

  it("a trial balance of another year or out of balance is reported; without one the reported figure is used", () => {
    const wrong = computeFinance({ facilities: [], observations: [], year: 2026, tb: { evidenceId: "e", filename: "m.csv", sha256: "s", parsed: tb(2025, [["600", 0, 10], ["100", 5, 0]]) } });
    expect(wrong.warnings.map((w) => w.code).sort()).toEqual(["tb_not_balanced", "tb_year_mismatch"]);
    const none = computeFinance({ facilities: [], observations: [o("n", "net_sales", null, 5)], year: 2026, tb: null });
    expect(none.warnings.map((w) => w.code)).toEqual(["tb_missing"]);
    expect(fact(none, "finance.net_sales")!.valueNum).toBe(5);
  });
});

describe("CBAM", () => {
  it("verified actual SEE wins; otherwise the EU default value with the year's mark-up", () => {
    const obs = [lines("g", "cbam_goods", "a", [["7208 10 00", 100], ["72142000", 50]]), lines("s", "cbam_see", "a", [["72081000", 1.9]])];
    expect(cbamTargets({ facilities: facs, observations: obs })).toEqual(["cbam:tr:72142000"]);
    const factors = { "cbam:tr:72142000": { target: "cbam:tr:72142000", valueId: "v", setId: "s", setCode: "eu_cbam_dv_tr", edition: 2026, licence: "open", key: "7214", value: 2, unit: null, ncv: null, ch4: null, n2o: null, chosen: false } };
    const r = computeCbam({ facilities: facs, observations: obs, year: 2027, factors });
    expect(fact(r, "cbam.embedded.72081000")!.valueNum).toBeCloseTo(190, 9);
    expect(fact(r, "cbam.see.72142000")!.valueNum).toBeCloseTo(2 * (1 + defaultMarkup(2027, "iron_steel")), 12);
    expect(fact(r, "cbam.embedded_total")!.valueNum).toBeCloseTo(190 + 50 * 2 * 1.2, 9);
    expect(r.warnings.map((w) => w.code)).toContain("cbam_default_value_used");
  });

  it("a CN code outside Annex I is not counted", () => {
    const r = computeCbam({ facilities: facs, observations: [lines("g", "cbam_goods", "a", [["0901", 10]])], year: 2026, factors: {} });
    expect(r.facts).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(["cbam_cn_not_covered"]);
  });
});

describe("TR-ETS", () => {
  it("category per installation from verified emissions, not scaled by equity share", () => {
    const r = computeEts({ facilities: facs, observations: [o("1", "ets_emissions", "a", 60_000), o("2", "ets_emissions", "b", 600_000)] });
    expect(r.facts.filter((f) => f.metricKey === "ets.category").map((f) => [f.facilityId, f.valueText])).toEqual([
      ["a", "B"],
      ["b", "C"],
    ]);
    expect(r.facts.find((f) => f.metricKey === "ets.verified_emissions" && f.facilityId === "b")!.valueNum).toBe(600_000);
  });
});

describe("run evaluation", () => {
  it("is deterministic: the same snapshot and factors give the same output digest", () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: 0, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 6 }), (values) => {
        const snap: Snapshot = { kind: "environment", year: 2026, boundary: null, facilities: [{ id: "a", pct: 100, connection: "distribution", country: "TR" }], observations: values.map((v, i) => o(`v${i}`, "env_energy", "a", v)), tb: null, pending: [], duplicates: [] };
        const a = evaluate(snap, {});
        const b = evaluate(structuredClone(snap), {});
        expect(outputDigest(a.facts)).toBe(outputDigest(b.facts));
        expect(inputDigest(snap)).toBe(inputDigest(structuredClone(snap)));
      }),
    );
  });

  it("a changed input changes the input digest", () => {
    const snap: Snapshot = { kind: "environment", year: 2026, boundary: null, facilities: [], observations: [o("v", "env_energy", null, 1)], tb: null, pending: [], duplicates: [] };
    expect(inputDigest(snap)).not.toBe(inputDigest({ ...snap, observations: [o("v", "env_energy", null, 2)] }));
    // an open request closed since the last run is a different input state, even with the same values
    expect(inputDigest(snap)).not.toBe(inputDigest({ ...snap, pending: ["r1:sent"] }));
  });
});
