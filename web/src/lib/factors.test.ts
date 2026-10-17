import { describe, expect, it } from "vitest";
import { BUILTIN_SETS, factorRef, factorSetCsv, factorTemplateCsv, findFactors, importFactorCsv, resolveRef, usableSets, type FactorSet } from "./factors";
import { FUELS, GRID_FACTORS, GWP_AR6 } from "./calc/ghg";

const custom = (rightsConfirmed: boolean): FactorSet => ({
  id: "c1",
  name: "Lisanslı set",
  publisher: "Müşteri",
  licence: "user_licensed",
  licenceNote: "",
  url: "",
  asOf: "2026-10-17",
  origin: "custom",
  rightsConfirmed,
  factors: importFactorCsv(factorTemplateCsv(), "c1").factors,
});

describe("factor library", () => {
  it("builds the built-in sets from the calculation constants", () => {
    const ipcc = BUILTIN_SETS.find((s) => s.id === "ipcc_2006")!;
    expect(ipcc.factors.find((f) => f.key === "natural_gas")!.value).toBe(FUELS.natural_gas.ef);
    expect(findFactors(BUILTIN_SETS, "grid", "TR-distribution")[0].factor.value).toBe(GRID_FACTORS.distribution);
    expect(findFactors(BUILTIN_SETS, "gwp", "SF6")[0].factor.value).toBe(GWP_AR6.SF6);
    BUILTIN_SETS.forEach((s) => {
      expect(s.licence).not.toBe("user_licensed");
      expect(s.url).toMatch(/^https:\/\//);
    });
  });
  it("only exposes custom factors after the user confirms their rights", () => {
    expect(findFactors(usableSets([custom(false)]), "grid", "DE")).toHaveLength(0);
    expect(findFactors(usableSets([custom(true)]), "grid", "DE")[0].factor.value).toBeCloseTo(0.38);
  });
  it("matches CBAM defaults by CN prefix", () => {
    const sets = usableSets([custom(true)]);
    expect(findFactors(sets, "cbam_default", "7208")).toHaveLength(1);
    expect(findFactors(sets, "cbam_default", "7209")).toHaveLength(0);
  });
  it("round-trips a reference", () => {
    const sets = usableSets([custom(true)]);
    const o = findFactors(sets, "fuel_co2", "natural_gas")[1];
    expect(resolveRef(sets, factorRef(o))?.factor.value).toBeCloseTo(56.4);
    expect(resolveRef(sets, "missing/x")).toBeNull();
  });
});

describe("custom factor CSV", () => {
  it("imports the template without issues and keeps ncv and indirect parts", () => {
    const r = importFactorCsv(factorTemplateCsv(), "c1");
    expect(r.issues).toEqual([]);
    expect(r.factors).toHaveLength(4);
    expect(r.factors[0].ncv).toBeCloseTo(0.0346);
    expect(r.factors[3].indirect).toBeCloseTo(0.21);
  });
  it("reports invalid rows", () => {
    const r = importFactorCsv("kind;key;value;ncv\nfuel_co2;natural_gas;56;\nwind;x;1;\nscope3;;2;\ngrid;TR;-1;\ngrid;TR;0,4;\ngrid;TR;0,5;", "c1");
    expect(r.issues.map((i) => [i.row, i.key])).toEqual([
      [2, "needNcv"],
      [3, "badKind"],
      [4, "noKey"],
      [5, "badValue"],
      [7, "duplicate"],
    ]);
    expect(r.factors).toHaveLength(1);
  });
  it("exports a set that imports back identically", () => {
    const set = custom(true);
    const again = importFactorCsv(factorSetCsv(set), "c1").factors;
    expect(again).toEqual(set.factors);
  });
});
