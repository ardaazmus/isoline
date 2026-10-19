import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { addDays, criticalSet, GATE_TEMPLATE, reaches, schedule, WP_TRANSITIONS } from "./plan";

describe("13-gate plan (G2-08)", () => {
  it("schedules every gate after its dependencies and keeps data collection after the period ends", () => {
    const { items, finish } = schedule("2026-03-01", "2026-12-31", "2027-05-31");
    expect(items).toHaveLength(13);
    const at = (g: string) => items.find((i) => i.gate === g)!;
    for (const i of items) for (const d of i.deps) expect(at(d).dueOn < i.startsOn).toBe(true);
    expect(at("G6").dueOn >= addDays("2026-12-31", 30)).toBe(true);
    expect(finish).toBe(at("G12").dueOn);
    expect(at("G0").status).toBe("ready");
  });

  it("marks the chain that drives the release date as critical", () => {
    const { items } = schedule("2026-03-01", "2026-12-31", null);
    const critical = items.filter((i) => i.critical).map((i) => i.gate);
    expect(critical).toEqual(expect.arrayContaining(["G6", "G7", "G8", "G9", "G11", "G12"]));
    // writing runs in parallel with plenty of float; it is not on the critical path
    expect(critical).not.toContain("G10");
  });

  it("reports how late the plan is against the publication date", () => {
    expect(schedule("2026-03-01", "2026-12-31", "2027-02-01").lateBy).toBeGreaterThan(0);
    expect(schedule("2026-03-01", "2026-12-31", "2027-12-31").lateBy).toBe(0);
  });

  it("critical path follows the dates people set", () => {
    const nodes = [
      { id: "a", startsOn: "2026-01-01", dueOn: "2026-01-10", deps: [] },
      { id: "b", startsOn: "2026-01-01", dueOn: "2026-01-20", deps: [] },
      { id: "c", startsOn: "2026-01-21", dueOn: "2026-01-30", deps: ["a", "b"] },
    ];
    expect([...criticalSet(nodes)].sort()).toEqual(["b", "c"]);
  });

  it("detects a dependency loop before it is stored", () => {
    const deps = new Map([
      ["b", ["a"]],
      ["c", ["b"]],
    ]);
    expect(reaches(deps, "c", "a")).toBe(true); // adding a → c would loop
    expect(reaches(deps, "a", "c")).toBe(false);
  });

  it("every state can eventually reach done, and done only reopens through rework", () => {
    for (const s of Object.keys(WP_TRANSITIONS) as (keyof typeof WP_TRANSITIONS)[]) {
      const seen = new Set<string>();
      const stack = [s];
      while (stack.length) {
        const x = stack.pop()!;
        if (seen.has(x)) continue;
        seen.add(x);
        stack.push(...WP_TRANSITIONS[x]);
      }
      expect(seen.has("done")).toBe(true);
    }
    expect(WP_TRANSITIONS.done).toEqual(["rework"]);
  });

  it("property: for any start and publication date the schedule respects dependencies and durations", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 700 }), fc.integer({ min: 0, max: 400 }), (startOffset, periodOffset) => {
        const start = addDays("2025-01-01", startOffset);
        const periodEnd = addDays("2025-06-30", periodOffset);
        const { items } = schedule(start, periodEnd, null);
        const at = (g: string) => items.find((i) => i.gate === g)!;
        for (const g of GATE_TEMPLATE) {
          const i = at(g.gate);
          expect(i.startsOn >= start).toBe(true);
          expect(i.dueOn >= i.startsOn).toBe(true);
          for (const d of g.deps) expect(at(d).dueOn < i.startsOn).toBe(true);
        }
        expect(items.some((i) => i.critical)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
