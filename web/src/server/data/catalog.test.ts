import { describe, expect, it } from "vitest";
import { DATA_POINTS } from "@/lib/requests";
import { METRICS } from "./catalog";
import { CANONICAL, unitsFor } from "./units";

describe("metric catalogue (G3-01)", () => {
  it("covers every toolkit data point exactly once", () => {
    expect(METRICS.map((m) => m.code).sort()).toEqual(DATA_POINTS.map((d) => d.id).sort());
  });

  it("every numeric dimension has a canonical unit and at least one input unit", () => {
    for (const m of METRICS)
      for (const d of m.dimensions) {
        if (d === "none") continue;
        expect(CANONICAL[d], `${m.code}:${d}`).toBeTruthy();
        expect(unitsFor(d).length, `${m.code}:${d}`).toBeGreaterThan(0);
      }
  });

  it("year-end balances are not summed; personal data is marked", () => {
    expect(METRICS.find((m) => m.code === "work_headcount")!.aggregation).toBe("last");
    expect(METRICS.find((m) => m.code === "work_pay")!.aggregation).toBe("average");
    expect(METRICS.filter((m) => m.sensitive).map((m) => m.code).sort()).toEqual(["ohs_incidents", "work_diversity", "work_pay"]);
  });

  it("facility-level metrics are the physical ones", () => {
    const facility = METRICS.filter((m) => m.grain === "facility").map((m) => m.code);
    expect(facility).toEqual(expect.arrayContaining(["ghg_stationary", "ghg_electricity", "env_water_withdrawal", "ohs_hours"]));
    expect(facility).not.toContain("net_sales");
  });
});
