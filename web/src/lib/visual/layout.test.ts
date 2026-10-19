/** G8-04/05: isometric blocks encode progress only; the Sankey conserves every quantity. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ghgFlowInput, ghgFlows, isometric, sankey, type FlowFact } from "./layout";

const L = { scope1: "Kapsam 1", scope2: "Kapsam 2", scope3: "Kapsam 3", total: "Toplam", org: "Kurum geneli" };

describe("isometric site map", () => {
  it("one block per facility, grouped by entity; height follows the share of requests done", () => {
    const r = isometric([
      { id: "a", name: "Gebze", entity: "E1", accepted: 10, total: 10, blockers: 0 },
      { id: "b", name: "Dilovası", entity: "E1", accepted: 0, total: 10, blockers: 1 },
      { id: "c", name: "Manisa", entity: "E2", accepted: 5, total: 10, blockers: 0 },
    ]);
    expect(r.blocks.map((b) => b.id)).toEqual(["a", "b", "c"]);
    const h = Object.fromEntries(r.blocks.map((b) => [b.id, b.height]));
    expect(h.a).toBeGreaterThan(h.c);
    expect(h.c).toBeGreaterThan(h.b);
    expect(r.blocks.every((b) => b.top.split(" ").length === 4)).toBe(true);
  });
});

describe("Sankey", () => {
  it("node value = inflow = outflow for every middle node; total = sum of facilities", () => {
    const flows = ghgFlows({ facilities: [{ name: "Gebze", scope1: 2383, scope2: 545 }, { name: "Dilovası", scope1: 1162, scope2: 422 }], orgScope1: 114, scope3: 0, labels: L });
    const { nodes, links } = sankey(flows);
    const val = (id: string) => nodes.find((n) => n.id === id)!.value;
    expect(val("Kapsam 1")).toBeCloseTo(2383 + 1162 + 114, 9);
    expect(val("Toplam")).toBeCloseTo(2383 + 545 + 1162 + 422 + 114, 9);
    expect(links.some((l) => l.target === "Kapsam 3")).toBe(false); // zero flows are not drawn
  });

  it("property: conservation and proportional widths for any facility set", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ s1: fc.double({ min: 0, max: 1e6, noNaN: true }), s2: fc.double({ min: 0, max: 1e6, noNaN: true }) }), { minLength: 1, maxLength: 8 }), fc.double({ min: 0, max: 1e5, noNaN: true }), (fs, org) => {
        const facilities = fs.map((f, i) => ({ name: `F${i}`, scope1: f.s1, scope2: f.s2 }));
        const { nodes, links } = sankey(ghgFlows({ facilities, orgScope1: org, scope3: 0, labels: L }));
        for (const n of nodes) {
          const inn = links.filter((l) => l.target === n.id).reduce((s, l) => s + l.value, 0);
          const out = links.filter((l) => l.source === n.id).reduce((s, l) => s + l.value, 0);
          if (inn > 0 && out > 0) expect(Math.abs(inn - out)).toBeLessThanOrEqual(1e-6 * Math.max(1, inn));
        }
        const total = facilities.reduce((s, f) => s + f.scope1 + f.scope2, 0) + org;
        const t = nodes.find((n) => n.id === "Toplam");
        if (total > 0) expect(t!.value).toBeCloseTo(total, 3);
        // a link twice the value is twice as wide
        const [a, b] = links;
        if (a && b && a.value > 1e-3 && b.value > 1e-3) expect(Math.abs(a.width / a.value - b.width / b.value)).toBeLessThanOrEqual(1e-9 * (a.width / a.value));
      }),
    );
  });
});

describe("GHG flow input from the fact list", () => {
  const FACILITIES = [
    { id: "f1", name: "Gebze" },
    { id: "f2", name: "Dilovası" },
    { id: "f3", name: "Manisa" },
  ];
  const fact = fc.record({
    metric_key: fc.constantFrom("ghg.scope1", "ghg.scope2.location", "ghg.scope1.mobile", "ghg.scope3", "ghg.scope2.market", "energy.total"),
    facility: fc.constantFrom(null, ...FACILITIES),
    boundary_kind: fc.constantFrom("ghg_operational_control", "ghg_financial_control", null),
    status: fc.constantFrom("approved", "ready_for_review", "validating", "rejected", "superseded"),
    value: fc.option(fc.double({ min: 0, max: 1e6, noNaN: true }), { nil: null }),
  });

  /** The rule the page used to ask the database for: newest revision per metric and facility, operational control. */
  function reference(facts: FlowFact[]) {
    const keys = ["ghg.scope1", "ghg.scope2.location", "ghg.scope1.mobile", "ghg.scope3"];
    const rows = facts.filter((f) => keys.includes(f.metric_key) && f.boundary_kind === "ghg_operational_control" && !["superseded", "rejected"].includes(f.status)).sort((a, b) => b.revision - a.revision);
    const seen = new Set<string>();
    const cur = rows.filter((r) => {
      const k = `${r.metric_key}|${r.facility_id ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const v = (k: string, f: string | null) => Number(cur.find((r) => r.metric_key === k && r.facility_id === f)?.value_num ?? 0);
    const facilities = [...new Map(cur.filter((r) => r.facility_id).map((r) => [r.facility_id!, r.facility_name ?? r.facility_id!])).entries()].map(([id, name]) => ({ name, scope1: v("ghg.scope1", id), scope2: v("ghg.scope2.location", id) }));
    return { facilities: facilities.sort((a, b) => a.name.localeCompare(b.name)), orgScope1: v("ghg.scope1.mobile", null), scope3: v("ghg.scope3", null) };
  }

  it("property: same totals as the database rule, whatever the order of the list", () => {
    fc.assert(
      fc.property(fc.array(fact, { maxLength: 40 }), fc.boolean(), (raw, reverse) => {
        // revisions are unique per metric, facility and boundary, as in the table
        const n = new Map<string, number>();
        const facts: FlowFact[] = raw.map((r) => {
          const k = `${r.metric_key}|${r.facility?.id ?? ""}|${r.boundary_kind ?? ""}`;
          const revision = (n.get(k) ?? 0) + 1;
          n.set(k, revision);
          return { metric_key: r.metric_key, facility_id: r.facility?.id ?? null, facility_name: r.facility?.name ?? null, boundary_kind: r.boundary_kind, revision, status: r.status, value_num: r.value === null ? null : String(r.value) };
        });
        const list = reverse ? [...facts].reverse() : facts;
        expect(ghgFlowInput(list)).toEqual(reference(facts));
      }),
    );
  });

  it("a rejected newest revision falls back to the one before it; facilities in name order", () => {
    const f = (metric: string, facility: { id: string; name: string } | null, revision: number, status: string, value: string): FlowFact => ({ metric_key: metric, facility_id: facility?.id ?? null, facility_name: facility?.name ?? null, boundary_kind: "ghg_operational_control", revision, status, value_num: value });
    const [gebze, dilovasi] = FACILITIES;
    const r = ghgFlowInput([f("ghg.scope1", gebze, 2, "rejected", "999"), f("ghg.scope1", gebze, 1, "approved", "2383"), f("ghg.scope2.location", dilovasi, 1, "approved", "422"), f("ghg.scope1.mobile", null, 1, "approved", "114")]);
    expect(r).toEqual({ facilities: [{ name: "Dilovası", scope1: 0, scope2: 422 }, { name: "Gebze", scope1: 2383, scope2: 0 }], orgScope1: 114, scope3: 0 });
  });
});
