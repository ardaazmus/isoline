/** G7-04..06: pack applicability and pack formulas. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { METRIC } from "../data/catalog";
import type { Obs } from "../calc/ghg-engine";
import { CKD_CORRECTION, CLINKER_EF, computeIndustry } from "./engine";
import { PACKS, suggestPacks } from "./packs";

const o = (versionId: string, metricCode: string, facilityId: string | null, canonical: number, quality: Obs["quality"] = "measured"): Obs => ({ versionId, metricCode, facilityId, canonical: String(canonical), canonicalUnit: null, lines: null, quality });
const fact = (k: string, f: string | null, v: number) => ({ id: `${k}:${f}`, metricKey: k, facilityId: f, boundaryKind: "ghg_operational_control", value: v });
const get = (r: ReturnType<typeof computeIndustry>, k: string) => r.facts.find((f) => f.metricKey === k)?.valueNum;

describe("industry packs", () => {
  it("every pack metric is in the catalogue; 'mandatory' only with a regulation behind it", () => {
    for (const p of PACKS)
      for (const m of p.metrics) {
        expect(METRIC.get(m.code), `${p.id}:${m.code}`).toBeTruthy();
        if (m.status === "mandatory") expect(m.basis).toMatch(/2023\/956|Regulation|Law|Kanun/);
      }
    expect(PACKS.every((p) => p.standardStatus !== "official")).toBe(true); // none of these is a published GRI sector standard
  });

  it("suggests packs from facility NACE codes; a mixed group gets several", () => {
    expect(suggestPacks(["24.10", "49.41", null])).toEqual(["steel", "logistics"]);
    expect(suggestPacks(["23.51"])).toEqual(["cement"]);
    expect(suggestPacks(["10.11"])).toEqual([]);
  });

  it("cement: clinker ratio, and IPCC Tier 1 calcination when the plant has not measured process CO₂", () => {
    const r = computeIndustry({ packs: [{ id: "cement", facilityIds: ["k"] }], observations: [o("1", "ind_clinker_production", "k", 800_000), o("2", "ind_cement_production", "k", 1_000_000)], facts: [] });
    expect(get(r, "ind.cement.clinker_ratio")).toBeCloseTo(0.8, 12);
    expect(get(r, "ind.cement.calcination_tco2")).toBeCloseTo(800_000 * 0.52 * 1.02, 6);
    expect(r.warnings.map((w) => w.code)).toEqual(["tier1_calcination"]);
    // measured process emissions replace the default
    const m = computeIndustry({ packs: [{ id: "cement", facilityIds: ["k"] }], observations: [o("1", "ind_clinker_production", "k", 800_000), o("2", "ind_cement_production", "k", 1_000_000), o("3", "ghg_process", "k", 410_000)], facts: [] });
    expect(get(m, "ind.cement.process_intensity")).toBeCloseTo(0.5125, 12);
    expect(get(m, "ind.cement.calcination_tco2")).toBeUndefined();
  });

  it("steel: scrap share and intensity per tonne of crude steel from the facility's GHG facts", () => {
    const r = computeIndustry({ packs: [{ id: "steel", facilityIds: ["s"] }], observations: [o("1", "ind_steel_crude_production", "s", 1_000_000), o("2", "ind_steel_scrap_input", "s", 1_100_000)], facts: [fact("ghg.scope1", "s", 400_000), fact("ghg.scope2.location", "s", 150_000)] });
    expect(get(r, "ind.steel.scrap_share")).toBeCloseTo(1.1, 12);
    expect(get(r, "ind.steel.ghg_intensity")).toBeCloseTo(0.55, 12);
    expect(r.used.facts.length).toBe(2);
  });

  it("logistics: gCO₂e per tonne-km from mobile scope 1; services: kWh per m²", () => {
    const tkm: Obs = { versionId: "t", metricCode: "ind_transport_tkm", facilityId: null, canonical: null, canonicalUnit: null, lines: [{ key: "road", value: "40000000", unit: "tkm", canonical: "40000000", canonicalUnit: "tkm" }], quality: "measured" };
    const r = computeIndustry({ packs: [{ id: "logistics", facilityIds: [] }], observations: [tkm], facts: [{ ...fact("ghg.scope1.mobile", null, 3_000), boundaryKind: "ghg_operational_control" }] });
    expect(get(r, "ind.logistics.intensity")).toBeCloseTo(75, 9); // 3 000 t × 10⁶ / 4·10⁷ tkm
    const s = computeIndustry({ packs: [{ id: "services", facilityIds: ["m"] }], observations: [o("1", "ind_floor_area", "m", 2_000), o("2", "ghg_electricity", "m", 720)], facts: [] });
    expect(get(s, "ind.services.electricity_intensity")).toBeCloseTo(100, 9); // 720 GJ = 200 MWh = 200 000 kWh / 2 000 m²
  });

  it("missing inputs are findings, never zeros", () => {
    const r = computeIndustry({ packs: [{ id: "steel", facilityIds: ["s"] }, { id: "logistics", facilityIds: [] }], observations: [], facts: [] });
    expect(r.facts).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(["pack_input_missing", "pack_input_missing"]);
  });

  it("property: Tier 1 calcination is linear in clinker", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e7, noNaN: true }), (c) => {
        const r = computeIndustry({ packs: [{ id: "cement", facilityIds: ["k"] }], observations: [o("1", "ind_clinker_production", "k", c)], facts: [] });
        expect(get(r, "ind.cement.calcination_tco2")!).toBeCloseTo(c * CLINKER_EF * CKD_CORRECTION, 4);
      }),
    );
  });
});
