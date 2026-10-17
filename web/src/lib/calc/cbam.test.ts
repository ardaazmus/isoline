import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  CBAM_ANNEX_I,
  cbamFactor,
  cnCoverage,
  countsIndirect,
  cscf,
  cscfDetermined,
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
  it("matches every year of Directive 2003/87/EC Art. 10a(1a) as inserted by Directive 2023/959", () => {
    const official = { 2026: 0.975, 2027: 0.95, 2028: 0.9, 2029: 0.775, 2030: 0.515, 2031: 0.39, 2032: 0.265, 2033: 0.14, 2034: 0 };
    for (const [y, f] of Object.entries(official)) expect(cbamFactor(Number(y))).toBe(f);
  });
});

describe("cross-sectoral correction factor (Decision 2026/1862)", () => {
  it("is 100 % for 2026–2030 and undetermined afterwards", () => {
    for (let y = 2026; y <= 2030; y++) {
      expect(cscf(y)).toBe(1);
      expect(cscfDetermined(y)).toBe(true);
    }
    expect(cscfDetermined(2031)).toBe(false);
    expect(cscf(2031)).toBe(1);
  });
});

describe("Annex I CN coverage (Reg. 2023/956, consolidated 20.10.2025)", () => {
  it("covers listed headings and their subheadings", () => {
    expect(cnCoverage("7208")).toEqual({ status: "covered", sector: "iron_steel" });
    expect(cnCoverage("7208 51 20")).toEqual({ status: "covered", sector: "iron_steel" });
    expect(cnCoverage("2601 12 00")).toEqual({ status: "covered", sector: "iron_steel" });
    expect(cnCoverage("7318 15 90")).toEqual({ status: "covered", sector: "iron_steel" });
    expect(cnCoverage("7616 99 10")).toEqual({ status: "covered", sector: "aluminium" });
    expect(cnCoverage("2523 29 00")).toEqual({ status: "covered", sector: "cement" });
    expect(cnCoverage("3105 20 10")).toEqual({ status: "covered", sector: "fertilisers" });
    expect(cnCoverage("2804 10 00")).toEqual({ status: "covered", sector: "hydrogen" });
    expect(cnCoverage("2716 00 00")).toEqual({ status: "covered", sector: "electricity" });
  });
  it("excludes the listed ferro-alloys, scrap and PK fertilisers", () => {
    expect(cnCoverage("7202 21 00")).toEqual({ status: "not_covered" });
    expect(cnCoverage("7202 99 80")).toEqual({ status: "not_covered" });
    expect(cnCoverage("7204 49 00")).toEqual({ status: "not_covered" });
    expect(cnCoverage("3105 60 00")).toEqual({ status: "not_covered" });
    expect(cnCoverage("7202 11 20")).toEqual({ status: "covered", sector: "iron_steel" });
  });
  it("leaves goods outside Annex I uncovered", () => {
    expect(cnCoverage("7615")).toEqual({ status: "not_covered" });
    expect(cnCoverage("7312 10")).toEqual({ status: "not_covered" });
    expect(cnCoverage("8501")).toEqual({ status: "not_covered" });
  });
  it("asks for the full code when the input is broader than a row or an ex row", () => {
    expect(cnCoverage("7202")).toEqual({ status: "partial", sector: "iron_steel" });
    expect(cnCoverage("2601")).toEqual({ status: "partial", sector: "iron_steel" });
    expect(cnCoverage("3105")).toEqual({ status: "partial", sector: "fertilisers" });
    expect(cnCoverage("2507 00 80")).toEqual({ status: "partial", sector: "cement" });
    expect(cnCoverage("72")).toEqual({ status: "invalid" });
  });
  it("lists codes of 4 or more digits only", () => {
    CBAM_ANNEX_I.forEach((r) => expect(r.code === "72" || /^\d{4,8}$/.test(r.code)).toBe(true));
  });
  it("property: any 8-digit code under a covered heading without exclusions is covered in that sector", () => {
    const plain = CBAM_ANNEX_I.filter((r) => !r.except && !r.ex && r.code.length === 4);
    fc.assert(
      fc.property(fc.constantFrom(...plain), fc.integer({ min: 0, max: 9999 }), (row, tail) => {
        const cn = row.code + String(tail).padStart(4, "0");
        expect(cnCoverage(cn)).toEqual({ status: "covered", sector: row.sector });
      }),
    );
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
  it("counts indirect emissions for agglomerated iron ore, which is not in Annex II", () => {
    expect(countsIndirect("iron_steel", "2601 12 00")).toBe(true);
    expect(countsIndirect("iron_steel", "7208")).toBe(false);
    expect(countsIndirect("aluminium")).toBe(false);
    expect(effectiveSee({ ...steel, cn: "2601 12 00" }, 2026, "actual")).toBeCloseTo(2.2);
  });
});

describe("projection", () => {
  it("matches the worked example in research note C (1,000 t, SEE 1.90, BM 1.37, €80)", () => {
    const rows = projectProduct(steel, flat);
    expect(rows[0].cost).toBeCloseTo(45_140, -1);
    expect(rows.find((r) => r.year === 2030)!.cost).toBeCloseTo(95_560, -1);
    expect(rows.find((r) => r.year === 2034)!.cost).toBeCloseTo(152_000, -1);
  });

  it("deducts the origin carbon price only on the actual-emissions route (Art. 9(1), 9(4))", () => {
    const s = { ...flat, originCarbonPrice: 20 };
    const actual = projectProduct(steel, s, "actual");
    const def = projectProduct(steel, s, "default");
    // 2026: gross 1,900 t × 20 € / 80 € = 475 certificates deducted
    expect(actual[0].deduction).toBeCloseTo(475);
    def.forEach((r) => expect(r.deduction).toBe(0));
    expect(projectProduct({ ...steel, useDefault: true }, s)[0].deduction).toBe(0);
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
    // Art. 2a(1): exempt where the net mass "does not cumulatively exceed" 50 t
    expect(deMinimisExempt("iron_steel", 50)).toBe(true);
    expect(deMinimisExempt("iron_steel", 50.001)).toBe(false);
    expect(deMinimisExempt("hydrogen", 1)).toBe(false);
    expect(deMinimisExempt("electricity", 1)).toBe(false);
  });
  it("holds 50 % of year-to-date certificates per quarter", () => {
    expect(quarterlyHolding(1000, 2)).toBe(250);
    expect(quarterlyHolding(1000, 4)).toBe(500);
  });
});
