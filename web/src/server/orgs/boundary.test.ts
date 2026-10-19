import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { reachFromParent, suggestBoundary, type Control, type EdgeIn, type EntityIn, type FacilityIn } from "./boundary";

const E = (id: string, isParent = false, validFrom: string | null = null, validTo: string | null = null): EntityIn => ({ id, isParent, validFrom, validTo });
const edge = (parent: string, child: string, sharePct: number, control: Control, validFrom = "2000-01-01", validTo: string | null = null): EdgeIn => ({ parent, child, sharePct, control, validFrom, validTo });
const F = (id: string, entityId: string, operated = true, cbamInstallation = false): FacilityIn => ({ id, entityId, operated, cbamInstallation, validFrom: null, validTo: null });

// Holding H owns 100 % of S1 (subsidiary), 60 % of S2 (subsidiary), 50 % of JV (joint), 30 % of A (associate),
// 5 % of I (investment). S2 owns 80 % of S3 (subsidiary). The group operates JV's plant; A's plant is not operated.
const entities = [E("H", true), E("S1"), E("S2"), E("S3"), E("JV"), E("A"), E("I")];
const edges = [edge("H", "S1", 100, "financial"), edge("H", "S2", 60, "financial"), edge("S2", "S3", 80, "financial"), edge("H", "JV", 50, "joint"), edge("H", "A", 30, "significant_influence"), edge("H", "I", 5, "none")];
const facilities = [F("f-s1", "S1"), F("f-s3", "S3"), F("f-s3-leased", "S3", false), F("f-jv", "JV", true), F("f-a", "A", false), F("f-i", "I")];
const pct = (s: ReturnType<typeof suggestBoundary>, id: string) => s.members.find((m) => m.id === id)?.pct;

describe("boundary suggestion (GHG Protocol ch. 3, table 1)", () => {
  it("equity share multiplies along chains", () => {
    const s = suggestBoundary("ghg_equity_share", entities, edges, facilities, "2026-12-31");
    expect(pct(s, "S2")).toBe(60);
    expect(pct(s, "S3")).toBe(48);
    expect(pct(s, "JV")).toBe(50);
    expect(pct(s, "A")).toBe(30);
    expect(pct(s, "I")).toBe(0);
    expect(pct(s, "f-s3")).toBe(48);
  });

  it("financial control: subsidiaries 100 %, joint ventures by share, associates and investments 0", () => {
    const s = suggestBoundary("ghg_financial_control", entities, edges, facilities, "2026-12-31");
    expect([pct(s, "S1"), pct(s, "S2"), pct(s, "S3"), pct(s, "JV"), pct(s, "A"), pct(s, "I")]).toEqual([100, 100, 100, 50, 0, 0]);
  });

  it("operational control: the operator of each facility decides", () => {
    const s = suggestBoundary("ghg_operational_control", entities, edges, facilities, "2026-12-31");
    expect(pct(s, "f-s1")).toBe(100);
    expect(pct(s, "f-s3")).toBe(100);
    expect(pct(s, "f-s3-leased")).toBe(0);
    expect(pct(s, "f-jv")).toBe(100);
    expect(pct(s, "f-a")).toBe(0);
  });

  it("financial reporting consolidates subsidiaries only (equity method for JV and associates)", () => {
    const s = suggestBoundary("financial_reporting", entities, edges, facilities, "2026-12-31");
    expect(s.members.find((m) => m.id === "JV")).toMatchObject({ pct: 0, reason: "equity_method" });
    expect(pct(s, "S3")).toBe(100);
  });

  it("CBAM lists installations of group entities", () => {
    const s = suggestBoundary("cbam_facility_product", entities, edges, [F("k1", "S1", true, true), F("o1", "S1", true, false), F("k2", "I", true, true)], "2026-12-31");
    expect([pct(s, "k1"), pct(s, "o1"), pct(s, "k2")]).toEqual([100, 0, 0]);
  });

  it("ownership changes within the year are respected on the as-of date (G2-02)", () => {
    const dated = [edge("H", "S1", 100, "financial", "2020-01-01", "2026-06-30"), edge("H", "S1", 40, "significant_influence", "2026-07-01")];
    expect(pct(suggestBoundary("ghg_financial_control", [E("H", true), E("S1")], dated, [], "2026-03-31"), "S1")).toBe(100);
    expect(pct(suggestBoundary("ghg_financial_control", [E("H", true), E("S1")], dated, [], "2026-12-31"), "S1")).toBe(0);
    expect(pct(suggestBoundary("ghg_equity_share", [E("H", true), E("S1")], dated, [], "2026-12-31"), "S1")).toBe(40);
  });

  it("an entity not linked to the parent is outside the group; missing parent is a warning", () => {
    expect(suggestBoundary("ghg_equity_share", [E("H", true), E("X")], [], [], "2026-12-31").members.find((m) => m.id === "X")).toMatchObject({ pct: 0, reason: "not_in_group" });
    expect(suggestBoundary("ghg_equity_share", [E("H"), E("X")], [], [], "2026-12-31").warnings).toContain("no_reporting_parent");
  });

  it("a cycle in the data is reported, not looped forever", () => {
    const r = reachFromParent([E("H", true), E("A"), E("B")], [edge("H", "A", 60, "financial"), edge("A", "B", 60, "financial"), edge("B", "A", 10, "financial")], "2026-12-31");
    expect(r.warnings).toContain("ownership_cycle");
  });

  it("properties: shares stay in 0..100, consolidation is all-or-nothing, unreachable means outside", () => {
    const ctrl = fc.constantFrom<Control>("operational", "financial", "joint", "significant_influence", "none");
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 100 }), ctrl), { maxLength: 12 }), (raw) => {
        const ents = [E("n0", true), ...[1, 2, 3, 4, 5, 6].map((i) => E(`n${i}`))];
        // edges only go from lower to higher index: a DAG like real ownership
        const es = raw.filter(([a, b]) => a < b).map(([a, b, s, c]) => edge(`n${a}`, `n${b}`, s, c));
        for (const kind of ["ghg_equity_share", "ghg_financial_control", "ghg_operational_control", "financial_reporting"] as const) {
          const s = suggestBoundary(kind, ents, es, [], "2026-12-31");
          for (const m of s.members) {
            expect(m.pct).toBeGreaterThanOrEqual(0);
            expect(m.pct).toBeLessThanOrEqual(100);
          }
        }
        // consolidation and operational control are all-or-nothing per entity
        for (const kind of ["financial_reporting", "ghg_operational_control"] as const) for (const m of suggestBoundary(kind, ents, es, [], "2026-12-31").members) expect([0, 100]).toContain(m.pct);
        // anything outside the parent's reach is outside every boundary
        const reached = reachFromParent(ents, es, "2026-12-31").reach;
        for (const m of suggestBoundary("ghg_equity_share", ents, es, [], "2026-12-31").members) if (!reached.get(m.id)!.reached) expect(m.pct).toBe(0);
      }),
      { numRuns: 300 },
    );
  });
});
