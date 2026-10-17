import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BUILTIN_SETS, factorRef, factorSetCsv, factorTemplateCsv, findFactors, formatCn, importFactorCsv, resolveRef, usableSets, type FactorSet } from "./factors";
import { FUELS, GRID_FACTORS, GWP_AR6 } from "./calc/ghg";
import { effectiveSee } from "./calc/cbam";
import { SAMPLE_CLIENT } from "@/data/sample";

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
    // The default grid factors are the latest ETKB edition's.
    expect(findFactors(BUILTIN_SETS.filter((s) => s.id === "etkb_2023"), "grid", "TR-distribution")[0].factor.value).toBe(GRID_FACTORS.distribution);
    expect(findFactors(BUILTIN_SETS, "gwp", "SF6")[0].factor.value).toBe(GWP_AR6.SF6);
    BUILTIN_SETS.forEach((s) => {
      expect(s.licence).not.toBe("user_licensed");
      expect(s.url).toMatch(/^https:\/\//);
    });
  });
  it("only exposes custom factors after the user confirms their rights", () => {
    const own = (sets: FactorSet[]) => findFactors(sets, "grid", "DE").filter((o) => o.set.origin === "custom");
    expect(own(usableSets([custom(false)]))).toHaveLength(0);
    expect(own(usableSets([custom(true)]))[0].factor.value).toBeCloseTo(0.38);
  });
  it("matches CBAM defaults by CN code, closest enclosing row first", () => {
    const sets = usableSets([custom(true)]);
    // Heading 7208 (official) and the custom 7208 39 00 row under it.
    expect(findFactors(sets, "cbam_default", "7208").map((o) => o.factor.key)).toEqual(["7208", "72083900"]);
    // An exact custom row outranks the official heading it falls under.
    expect(findFactors(sets, "cbam_default", "72083900").map((o) => o.factor.key)).toEqual(["72083900", "7208"]);
    expect(findFactors(sets, "cbam_default", "7208 39 00")).toEqual(findFactors(sets, "cbam_default", "7208.39.00"));
    expect(findFactors(sets, "cbam_default", "7209").map((o) => o.factor.key)).toEqual(["7209"]);
    // Shorter than a heading: nothing, rather than every row of the chapter.
    expect(findFactors(sets, "cbam_default", "720")).toEqual([]);
    expect(findFactors(sets, "cbam_default", "")).toEqual([]);
  });
  it("formats CN codes in the tariff grouping", () => {
    expect(formatCn("72083900")).toBe("7208 39 00");
    expect(formatCn("2507008080")).toBe("2507 00 80 80");
    expect(formatCn("720219")).toBe("7202 19");
    expect(formatCn("7208")).toBe("7208");
    expect(formatCn("TR-distribution")).toBe("TR-distribution");
  });
  it("keeps factor ids unique within every built-in set", () => {
    BUILTIN_SETS.forEach((s) => expect(new Set(s.factors.map((f) => f.id)).size).toBe(s.factors.length));
  });
  it("round-trips a reference", () => {
    const sets = usableSets([custom(true)]);
    const o = findFactors(sets, "fuel_co2", "natural_gas")[1];
    expect(resolveRef(sets, factorRef(o))?.factor.value).toBeCloseTo(56.4);
    expect(resolveRef(sets, "missing/x")).toBeNull();
  });
});

const cbam = BUILTIN_SETS.find((s) => s.id === "eu_cbam_dv_tr")!;
const eea = BUILTIN_SETS.find((s) => s.id === "eea_ener038")!;
const row = (cn: string) => cbam.factors.find((f) => f.key === cn)!;

describe("official CBAM default values for Türkiye (EU 2026/1740)", () => {
  it("matches rows read from the Commission's Excel file", () => {
    // xlsx rows checked by hand against 'DV correcting act_final update_06.08.xlsx', sheet Türkiye.
    expect(row("31021019")).toMatchObject({ direct: 1.44, indirect: 0.08, value: 1.51 });
    expect(row("7208")).toMatchObject({ direct: 2.428, value: 2.428 });
    expect(row("7208").indirect).toBeUndefined();
    expect(row("72201200").value).toBe(5.47);
    expect(row("73072100").value).toBe(3.71);
  });
  it("uses the 'Other Countries and Territories' value where Türkiye shows '–'", () => {
    expect(row("25232900")).toMatchObject({ value: 1.44, otherCountries: true });
    expect(cbam.factors.filter((f) => f.otherCountries)).toHaveLength(10);
    expect(row("7208").otherCountries).toBeUndefined();
  });
  it("takes the total column as the value: direct + indirect within rounding, direct alone when indirect is N/A", () => {
    expect(cbam.factors.length).toBeGreaterThan(200);
    cbam.factors.forEach((f) => {
      expect(f.value).toBeGreaterThan(0);
      if (f.indirect === undefined) expect(f.value).toBe(f.direct);
      else expect(Math.abs(f.direct! + f.indirect - f.value)).toBeLessThanOrEqual(0.0151);
    });
  });
  it("feeds the default SEE with the total and leaves the mark-up to the calculation", () => {
    const p = SAMPLE_CLIENT.cbam.products.find((x) => x.useDefault)!;
    const picked = resolveRef(BUILTIN_SETS, p.defaultRef)!;
    expect(picked.factor.value).toBe(p.defaultSee);
    expect(effectiveSee(p, 2026)).toBeCloseTo(p.defaultSee * 1.1, 10);
  });
  it("links every sample product to the official row of its CN code", () => {
    SAMPLE_CLIENT.cbam.products.forEach((p) => {
      const o = resolveRef(BUILTIN_SETS, p.defaultRef)!;
      expect(o.factor.key).toBe(p.cn);
      expect(o.factor.value).toBe(p.defaultSee);
    });
  });
});

describe("EEA ENER038 grid intensities", () => {
  it("converts gCO₂e/kWh to tCO₂e/MWh without float noise", () => {
    expect(findFactors([eea], "grid", "AT")[0].factor.value).toBe(0.053);
    expect(findFactors([eea], "grid", "PL")[0].factor.value).toBe(0.566);
    expect(findFactors([eea], "grid", "EU27")[0].factor.value).toBe(0.18344);
  });
  it("covers the 27 member states plus the EU-27 figure, all for 2024", () => {
    expect(eea.factors).toHaveLength(28);
    eea.factors.forEach((f) => {
      expect(f.year).toBe(2024);
      expect(f.value).toBeGreaterThan(0);
      expect(f.value).toBeLessThan(1);
    });
  });
});

describe("custom factor CSV", () => {
  it("imports the template without issues and keeps ncv and the CBAM direct part", () => {
    const r = importFactorCsv(factorTemplateCsv(), "c1");
    expect(r.issues).toEqual([]);
    expect(r.factors).toHaveLength(4);
    expect(r.factors[0].ncv).toBeCloseTo(0.0346);
    expect(r.factors[3]).toMatchObject({ kind: "cbam_default", value: 2.1, direct: 2.1 });
    expect(r.factors[3].indirect).toBeUndefined();
  });
  it("reads files without the direct column (older template)", () => {
    const r = importFactorCsv("kind;key;value;indirect\ncbam_default;31021019;1,51;0,08", "c1");
    expect(r.issues).toEqual([]);
    expect(r.factors[0]).toMatchObject({ value: 1.51, indirect: 0.08 });
    expect(r.factors[0].direct).toBeUndefined();
  });
  it("round-trips any CBAM row through CSV export and import", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\d{4}(\d{2}){0,3}$/),
        fc.integer({ min: 1, max: 99_999 }),
        fc.option(fc.integer({ min: 0, max: 9_999 }), { nil: undefined }),
        (cn, total, indirect) => {
          const set: FactorSet = { ...custom(true), factors: [{ id: `c1:cbam_default:${cn}`, kind: "cbam_default", key: cn, label: cn, value: total / 1000, direct: total / 1000, indirect: indirect === undefined ? undefined : indirect / 1000, unit: undefined, ncv: undefined, year: undefined }] };
          expect(importFactorCsv(factorSetCsv(set), "c1").factors).toEqual(set.factors);
        },
      ),
    );
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
