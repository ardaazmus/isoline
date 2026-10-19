/** G8-04/05: isometric blocks encode progress only; the Sankey conserves every quantity. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ghgFlows, isometric, sankey } from "./layout";

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
