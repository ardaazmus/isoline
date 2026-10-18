import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { SAMPLE_CLIENT } from "@/data/sample";
import { computeInventory, ETKB_EDITIONS, GRID_FACTORS, type Inventory } from "./calc/ghg";
import { BUILTIN_SETS, usableSets, type FactorSet } from "./factors";
import { applyRecalc, familyEditions, gridEdition, isSignificant, pickEdition, planRecalc, setsForYear } from "./recalc";

const inv = (): Inventory => structuredClone(SAMPLE_CLIENT.ghg);

describe("ETKB editions", () => {
  it("carries the four published calculation years with the values of the official forms", () => {
    expect(ETKB_EDITIONS.map((e) => [e.year, e.published])).toEqual([
      [2020, "2024-03-18"],
      [2021, "2024-03-18"],
      [2022, "2024-12-06"],
      [2023, "2025-12-26"],
    ]);
    const v = (y: number, k: string) => ETKB_EDITIONS.find((e) => e.year === y)!.factors[k];
    expect(v(2020, "TR-distribution")).toEqual({ tco2: 0.459, tco2e: 0.462 });
    expect(v(2021, "TR-transmission")).toEqual({ tco2: 0.44, tco2e: 0.445 });
    expect(v(2022, "TR-generation")).toEqual({ tco2: 0.438, tco2e: 0.442 });
    expect(v(2023, "TR-plant-natural-gas")).toEqual({ tco2: 0.4, tco2e: 0.405 });
    expect(GRID_FACTORS).toEqual({ transmission: 0.436, distribution: 0.469 });
  });
  it("is exposed in the library as one family with one set per year; 2023 keeps its earlier id", () => {
    expect(familyEditions(BUILTIN_SETS, "etkb").map((s) => s.id)).toEqual(["etkb_2020", "etkb_2021", "etkb_2022", "etkb_2023"]);
    expect(BUILTIN_SETS.find((s) => s.id === "etkb_2023")!.factors.map((f) => f.id)).toContain("etkb_2023:distribution");
  });
});

describe("edition choice", () => {
  it("takes the year's edition, else the latest before it, else the earliest", () => {
    expect(pickEdition(BUILTIN_SETS, "etkb", 2022)).toMatchObject({ set: { id: "etkb_2022" }, exact: true });
    expect(pickEdition(BUILTIN_SETS, "etkb", 2026)).toMatchObject({ set: { id: "etkb_2023" }, exact: false });
    expect(pickEdition(BUILTIN_SETS, "etkb", 2015)).toMatchObject({ set: { id: "etkb_2020" }, exact: false });
    expect(pickEdition(BUILTIN_SETS, "nope", 2026)).toBeNull();
  });
  it("offers one edition per family and keeps sets outside a family", () => {
    const ids = setsForYear(BUILTIN_SETS, 2021).map((s) => s.id);
    expect(ids).toContain("etkb_2021");
    expect(ids).not.toContain("etkb_2023");
    expect(ids).toContain("ipcc_2006");
  });
  it("property: the chosen edition is never newer than the year unless no older one exists", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2000, max: 2040 }), (y) => {
        const p = pickEdition(BUILTIN_SETS, "etkb", y)!;
        if (y >= 2020) expect(p.set.year).toBeLessThanOrEqual(y);
        else expect(p.set.id).toBe("etkb_2020");
        expect(p.exact).toBe(p.set.year === y);
      }),
    );
  });
});

describe("retroactive recalculation", () => {
  it("moves the default grid factors to the year's edition and reports before and after", () => {
    const i = inv();
    expect(gridEdition(i)).toBe("etkb_2023");
    const plan = planRecalc(i, BUILTIN_SETS, 2022);
    expect(plan.grid).toEqual({ from: "etkb_2023", to: "etkb_2022" });
    expect(plan.next.grid).toEqual({ edition: "etkb_2022", transmission: 0.445, distribution: 0.478 });
    // 300,000 MWh at distribution: 0.469 → 0.478.
    expect(plan.before.scope2Location).toBeCloseTo(300_000 * 0.469, 6);
    expect(plan.after.scope2Location).toBeCloseTo(300_000 * 0.478, 6);
    expect(plan.changes).toEqual([expect.objectContaining({ kind: "electricity", from: "etkb_2023", to: "etkb_2022" })]);
    expect(plan.scope12Change).toBeCloseTo((300_000 * (0.478 - 0.469)) / (plan.before.scope1 + 300_000 * 0.469), 10);
    expect(isSignificant(plan)).toBe(false);
  });
  it("moves library-linked lines to the same key in the new edition and records the run", () => {
    const i = inv();
    i.electricity = [{ ...i.electricity[0], factorRef: "etkb_2023/etkb_2023:plant-natural-gas", gridFactor: 0.405 }];
    const plan = planRecalc(i, BUILTIN_SETS, 2021);
    const e = plan.next.electricity[0];
    expect(e).toMatchObject({ factorRef: "etkb_2021/etkb_2021:plant-natural-gas", gridFactor: 0.38 });
    const done = applyRecalc(i, plan, new Date("2026-10-18T10:00:00Z"));
    expect(done.recalcs?.[0]).toMatchObject({ at: "2026-10-18T10:00:00.000Z", year: 2021, lines: 1, grid: { from: "etkb_2023", to: "etkb_2021" } });
    expect(done.recalcs?.[0].after.scope2Location).toBeCloseTo(computeInventory(done).scope2Location, 6);
    expect(done.year).toBe(2021);
  });
  it("keeps a line whose key is missing from the new edition and lists it", () => {
    const custom: FactorSet = { ...BUILTIN_SETS.find((s) => s.id === "etkb_2023")!, id: "etkb_2030", year: 2030, factors: BUILTIN_SETS.find((s) => s.id === "etkb_2023")!.factors.filter((f) => !f.key.includes("plant")).map((f) => ({ ...f, id: f.id.replace("etkb_2023", "etkb_2030") })) };
    const i = inv();
    i.electricity = [{ ...i.electricity[0], factorRef: "etkb_2023/etkb_2023:plant-lignite", gridFactor: 1.133 }];
    const plan = planRecalc(i, [...BUILTIN_SETS, custom], 2030);
    expect(plan.missing).toEqual([expect.objectContaining({ ref: "etkb_2023/etkb_2023:plant-lignite", edition: "etkb_2030" })]);
    expect(plan.next.electricity[0].gridFactor).toBe(1.133);
  });
  it("leaves lines linked to custom sets alone", () => {
    const own: FactorSet = { id: "c1", name: "Own", publisher: "", licence: "user_licensed", licenceNote: "", url: "", asOf: "", origin: "custom", rightsConfirmed: true, factors: [{ id: "c1:x", kind: "grid", key: "X", label: "X", value: 0.1 }] };
    const i = inv();
    i.electricity = [{ ...i.electricity[0], factorRef: "c1/c1:x", gridFactor: 0.1 }];
    const plan = planRecalc(i, usableSets([own]), 2020);
    expect(plan.next.electricity[0]).toMatchObject({ factorRef: "c1/c1:x", gridFactor: 0.1 });
    expect(plan.after.scope2Location).toBeCloseTo(plan.before.scope2Location, 6);
  });
  it("property: recalculating to the edition already in use changes nothing", () => {
    fc.assert(
      fc.property(fc.constantFrom(2020, 2021, 2022, 2023), (y) => {
        const first = applyRecalc(inv(), planRecalc(inv(), BUILTIN_SETS, y));
        const again = planRecalc(first, BUILTIN_SETS, y);
        expect(again.changes).toEqual([]);
        expect(again.grid).toBeNull();
        expect(again.scope12Change).toBe(0);
      }),
    );
  });
  it("flags a significant change of scope 1 + 2", () => {
    expect(isSignificant({ scope12Change: 0.05 })).toBe(true);
    expect(isSignificant({ scope12Change: -0.0499 })).toBe(false);
  });
});

describe("retroactive recalculation: CH₄ and N₂O", () => {
  const fam = (y: number, gas?: { ch4: number; n2o: number }): FactorSet => ({
    id: `fuelfam_${y}`, name: "", publisher: "", licence: "user_licensed", licenceNote: "", url: "", asOf: "", origin: "custom", rightsConfirmed: true, family: "fuelfam", year: y,
    factors: [{ id: `fuelfam_${y}:gas`, kind: "fuel_co2", key: "natural_gas", label: "", value: 56, ncv: 0.035, ...gas }],
  });
  const line = (ref: string) => ({ id: "f", fuel: "natural_gas" as const, label: "", amount: 1e6, ncv: 0.034, ef: 55.9, ch4: 5, n2o: 0.5, mobile: false, quality: "measured" as const, factorRef: ref });
  it("takes the new edition's CH₄ and N₂O when it has them, else keeps the line's", () => {
    const with2 = planRecalc({ ...inv(), electricity: [], fuels: [line("fuelfam_2022/fuelfam_2022:gas")] }, usableSets([fam(2022), fam(2023, { ch4: 1, n2o: 0.1 })]), 2023);
    expect(with2.next.fuels[0]).toMatchObject({ ef: 56, ncv: 0.035, ch4: 1, n2o: 0.1 });
    const without = planRecalc({ ...inv(), electricity: [], fuels: [line("fuelfam_2022/fuelfam_2022:gas")] }, usableSets([fam(2022), fam(2023)]), 2023);
    expect(without.next.fuels[0]).toMatchObject({ ef: 56, ch4: 5, n2o: 0.5 });
    expect(without.changes[0].after).toBeCloseTo(computeInventory({ ...inv(), electricity: [], process: [], refrigerants: [], fuels: without.next.fuels }).scope1, 6);
  });
});
