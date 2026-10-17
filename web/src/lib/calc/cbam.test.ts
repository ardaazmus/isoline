import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  cbamFactor,
  defaultMarkup,
  deMinimisExempt,
  effectiveSee,
  projectPortfolio,
  projectProduct,
  quarterlyHolding,
  type CbamProduct,
  type CbamScenario,
} from "./cbam";

const steel: CbamProduct = {
  id: "p1",
  name: "HRC",
  cn: "7208",
  sector: "iron_steel",
  tonnes: 1000,
  growth: 0,
  seeDirect: 1.9,
  seeIndirect: 0.3,
  defaultSee: 2.2,
  useDefault: false,
  benchmark: 1.37,
};
const flat: CbamScenario = { startPrice: 80, priceGrowth: 0, originCarbonPrice: 0, eurTry: 40 };

describe("CBAM factor schedule", () => {
  it("phases out free allocation 97.5 % → 0 % between 2026 and 2034", () => {
    expect(cbamFactor(2026)).toBe(0.975);
    expect(cbamFactor(2030)).toBe(0.515);
    expect(cbamFactor(2034)).toBe(0);
    expect(cbamFactor(2040)).toBe(0);
  });
  it("never increases year over year", () => {
    for (let y = 2026; y < 2034; y++) expect(cbamFactor(y + 1)).toBeLessThanOrEqual(cbamFactor(y));
  });
});

describe("default value mark-ups (Guidance No. 3)", () => {
  it("are 10 / 20 / 30 % and 1 % for fertilisers", () => {
    expect(defaultMarkup(2026, "iron_steel")).toBe(0.1);
    expect(defaultMarkup(2027, "cement")).toBe(0.2);
    expect(defaultMarkup(2031, "aluminium")).toBe(0.3);
    expect(defaultMarkup(2028, "fertilisers")).toBe(0.01);
  });
});

describe("embedded emissions", () => {
  it("ignores indirect emissions for steel and counts them for cement", () => {
    expect(effectiveSee(steel, 2026, "actual")).toBeCloseTo(1.9);
    expect(effectiveSee({ ...steel, sector: "cement" }, 2026, "actual")).toBeCloseTo(2.2);
  });
});

describe("projection", () => {
  it("matches the worked example in research note C (1,000 t, SEE 1.90, BM 1.37, €80)", () => {
    const rows = projectProduct(steel, flat);
    expect(rows[0].cost).toBeCloseTo(45_140, -1);
    expect(rows.find((r) => r.year === 2030)!.cost).toBeCloseTo(95_560, -1);
    expect(rows.find((r) => r.year === 2034)!.cost).toBeCloseTo(152_000, -1);
  });

  it("charges more with default values than with lower verified values", () => {
    const actual = projectProduct(steel, flat, "actual");
    const def = projectProduct(steel, flat, "default");
    actual.forEach((r, i) => expect(def[i].cost).toBeGreaterThanOrEqual(r.cost));
  });

  it("portfolio totals equal the sum of products", () => {
    const p2 = { ...steel, id: "p2", tonnes: 500, useDefault: true };
    const port = projectPortfolio([steel, p2], flat);
    const a = projectProduct(steel, flat);
    const b = projectProduct(p2, flat);
    port.forEach((y, i) => expect(y.cost).toBeCloseTo(a[i].cost + b[i].cost, 6));
  });

  it("property: certificates are never negative and never exceed gross emissions", () => {
    fc.assert(
      fc.property(
        fc.record({
          tonnes: fc.double({ min: 0, max: 1e6, noNaN: true }),
          growth: fc.double({ min: -0.2, max: 0.3, noNaN: true }),
          seeDirect: fc.double({ min: 0, max: 20, noNaN: true }),
          benchmark: fc.double({ min: 0, max: 20, noNaN: true }),
          price: fc.double({ min: 0, max: 500, noNaN: true }),
          origin: fc.double({ min: 0, max: 500, noNaN: true }),
        }),
        (v) => {
          const rows = projectProduct(
            { ...steel, tonnes: v.tonnes, growth: v.growth, seeDirect: v.seeDirect, benchmark: v.benchmark },
            { ...flat, startPrice: v.price, originCarbonPrice: v.origin },
          );
          for (const r of rows) {
            expect(r.certificates).toBeGreaterThanOrEqual(0);
            expect(r.certificates).toBeLessThanOrEqual(r.gross + 1e-6);
            expect(r.cost).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });

  it("property: a higher origin carbon price never raises the obligation", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 200, noNaN: true }), fc.double({ min: 0, max: 200, noNaN: true }), (a, b) => {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const rl = projectProduct(steel, { ...flat, originCarbonPrice: lo });
        const rh = projectProduct(steel, { ...flat, originCarbonPrice: hi });
        rl.forEach((r, i) => expect(rh[i].certificates).toBeLessThanOrEqual(r.certificates + 1e-9));
      }),
    );
  });
});

describe("thresholds and holding", () => {
  it("applies the 50 t de minimis except for electricity and hydrogen", () => {
    expect(deMinimisExempt("iron_steel", 49)).toBe(true);
    expect(deMinimisExempt("iron_steel", 50)).toBe(false);
    expect(deMinimisExempt("hydrogen", 1)).toBe(false);
  });
  it("holds 50 % of year-to-date certificates per quarter", () => {
    expect(quarterlyHolding(1000, 2)).toBe(250);
    expect(quarterlyHolding(1000, 4)).toBe(500);
  });
});
