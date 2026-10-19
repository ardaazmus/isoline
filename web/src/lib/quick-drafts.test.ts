import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SAMPLE_CLIENT } from "@/data/sample";
import { METRICS } from "@/server/data/catalog";
import { environmentDrafts, ghgDrafts } from "./quick-drafts";
import type { Inventory } from "./calc/ghg";

const empty: Inventory = { fuels: [], process: [], refrigerants: [], electricity: [], scope3: [], revenueMillionTry: 0, productionTonnes: 0 };

describe("quick calculation → cycle drafts", () => {
  it("carries inputs only, in the catalogue's line keys and units", () => {
    const d = ghgDrafts(SAMPLE_CLIENT.ghg);
    const by = Object.fromEntries(d.map((x) => [x.metric, x]));
    for (const x of d) expect(METRICS.some((m) => m.code === x.metric)).toBe(true);
    const stationary = METRICS.find((m) => m.code === "ghg_stationary")!;
    for (const l of by.ghg_stationary?.lines ?? []) {
      expect(stationary.lineKeys).toContain(l.key);
      expect(l.unit).not.toBe("Sm3");
    }
    for (const l of by.ghg_mobile?.lines ?? []) expect(["diesel", "gasoline", "lpg"]).toContain(l.key);
    expect(by.ghg_electricity?.unit ?? "MWh").toBe("MWh");
  });

  it("sums repeated fuels and gases, and drops zero or negative entries", () => {
    const inv: Inventory = {
      ...empty,
      fuels: [
        { id: "1", fuel: "natural_gas", label: "", amount: 100, ncv: 0, ef: 0, mobile: false, quality: "measured" },
        { id: "2", fuel: "natural_gas", label: "", amount: 50, ncv: 0, ef: 0, mobile: false, quality: "measured" },
        { id: "3", fuel: "diesel", label: "", amount: 0, ncv: 0, ef: 0, mobile: true, quality: "measured" },
        { id: "4", fuel: "coal", label: "", amount: 5, ncv: 0, ef: 0, mobile: true, quality: "measured" },
      ],
      refrigerants: [
        { id: "r1", gas: "R-410A", leakedKg: 2, quality: "measured" },
        { id: "r2", gas: "R-410A", leakedKg: 3, quality: "measured" },
      ],
    };
    expect(ghgDrafts(inv)).toEqual([
      { metric: "ghg_stationary", lines: [{ key: "natural_gas", value: 150, unit: "m3" }] },
      { metric: "ghg_refrigerants", lines: [{ key: "R-410A", value: 5, unit: "kg" }] },
    ]);
    expect(ghgDrafts(empty)).toEqual([]);
  });

  it("never invents a value: every draft value is positive and comes from the inputs", () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -10, max: 1e6, noNaN: true }), { maxLength: 6 }), (mwh) => {
        const inv: Inventory = { ...empty, electricity: mwh.map((v, i) => ({ id: String(i), label: "", mwh: v, connection: "distribution" as const, certifiedMwh: 0, supplierFactor: null, quality: "measured" as const })) };
        const d = ghgDrafts(inv);
        const total = mwh.reduce((s, v) => s + Math.max(0, v), 0);
        if (total > 0) expect(d).toEqual([{ metric: "ghg_electricity", value: total, unit: "MWh" }]);
        else expect(d).toEqual([]);
      }),
    );
  });

  it("maps the environment calculator's figures", () => {
    const d = environmentDrafts({ energyGj: 10, renewableGj: 0, waterWithdrawalM3: 5, waterDischargeM3: 0, waterStressShare: 0, wasteTotalT: 2, wasteRecoveredT: 1, wasteHazardousT: 0, revenueMillionTry: 0 });
    expect(d.map((x) => x.metric)).toEqual(["env_energy", "env_water_withdrawal", "env_waste"]);
  });
});
