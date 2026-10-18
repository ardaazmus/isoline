import { describe, expect, it } from "vitest";
import fc from "fast-check";
import cbamTr from "@/data/factors/eu-cbam-defaults-tr.json";
import { SAMPLE_CLIENT } from "@/data/sample";
import { benchmarkRowFor, CBAM_BENCHMARKS, defaultRouteTR, pickBenchmark, resolveBenchmark, rowRoutes } from "./cbam-benchmarks";
import { cbamFactor, cscf, projectProduct } from "./cbam";

const p = (cn: string, extra: object = {}) => ({ cn, benchmark: 0, ...extra });

describe("benchmark table (Impl. Reg. 2025/2620, point 5.3)", () => {
  it("holds the published rows with Column A and Column B values and their indicators", () => {
    expect(CBAM_BENCHMARKS).toHaveLength(570);
    const row = (cn: string) => CBAM_BENCHMARKS.find((r) => r.cn === cn)!;
    expect(row("25070080")).toMatchObject({ a: [{ value: 0.666, route: null }], b: [{ value: 0.666, route: null }] });
    expect(row("25231000").b).toEqual([
      { value: 0.666, route: "A", period: null },
      { value: 0.859, route: "B", period: null },
    ]);
    expect(row("25233000").a).toEqual([
      { value: 0.717, route: null, period: 1 },
      { value: 0.686, route: null, period: 2 },
    ]);
    expect(row("72081000")).toMatchObject({ a: [{ value: 0.044 }], b: [{ value: 1.37, route: "C" }, { value: 0.481, route: "D" }, { value: 0.072, route: "E" }] });
    expect(rowRoutes(row("72081000"))).toEqual(["C", "D", "E"]);
  });
  it("finds a code's row, the enclosing row, or the agreeing rows under a heading", () => {
    expect(benchmarkRowFor("7208 39 00")).toMatchObject({ status: "ok", row: { cn: "72083900" } });
    expect(benchmarkRowFor("2523 10 00 10")).toMatchObject({ status: "ok", row: { cn: "25231000" } });
    expect(benchmarkRowFor("7208").status).toBe("ok"); // 20 codes, one value set
    expect(benchmarkRowFor("7604").status).toBe("ambiguous");
    expect(benchmarkRowFor("2716 00 00").status).toBe("none");
    expect(benchmarkRowFor("72").status).toBe("none");
  });
});

describe("production route of the default-value table", () => {
  it("takes the Türkiye route, and 'Other Countries' where Türkiye shows '-'", () => {
    expect(defaultRouteTR("7208")).toMatchObject({ routes: ["C"], otherCountries: false });
    expect(defaultRouteTR("7208 39 00")?.routes).toEqual(["C"]);
    expect(defaultRouteTR("2523 10 00 10")).toMatchObject({ routes: ["B"], otherCountries: true });
    expect(defaultRouteTR("2523 10 00 90")).toMatchObject({ routes: ["A"], otherCountries: true });
    expect(defaultRouteTR("3102 10 19")?.routes).toEqual([]);
  });
});

describe("picking a value", () => {
  it("uses (1) for 2026–27 and (2) for 2028–30", () => {
    const e = CBAM_BENCHMARKS.find((r) => r.cn === "25233000")!.b;
    expect(pickBenchmark(e, [], 2027)).toBe(0.717);
    expect(pickBenchmark(e, [], 2028)).toBe(0.686);
  });
  it("needs a route on route-specific rows and takes the highest of several alloy grades", () => {
    const e = [
      { value: 1.4, route: "C", period: null },
      { value: 1.6, route: "F", period: 1 },
      { value: 1.5, route: "F", period: 2 },
    ] as const;
    expect(pickBenchmark([...e], [], 2026)).toBeNull();
    expect(pickBenchmark([...e], ["C"], 2026)).toBe(1.4);
    expect(pickBenchmark([...e], ["C", "F"], 2026)).toBe(1.6);
    expect(pickBenchmark([...e], ["C", "F"], 2029)).toBe(1.5);
  });
});

describe("resolving the benchmark of a product", () => {
  it("default values: Column B on the table's route", () => {
    expect(resolveBenchmark(p("7209"), 2026, "default")).toMatchObject({ value: 1.458, source: "default", status: "ok", routes: ["C"], routeFromTable: true });
    expect(resolveBenchmark(p("2523 10 00 10"), 2026, "default").value).toBe(0.859);
    expect(resolveBenchmark(p("2523 29 00"), 2026, "default").value).toBe(0.666);
  });
  it("default values ignore a chosen route (point 5.1)", () => {
    expect(resolveBenchmark(p("7209", { bmRoute: "E" }), 2026, "default").value).toBe(1.458);
  });
  it("actual data: Column A plus the precursors' share, by default Column B − Column A", () => {
    const r = resolveBenchmark(p("7208"), 2026, "actual");
    expect(r).toMatchObject({ source: "actual", a: 0.044, b: 1.37, precursorDefault: true });
    expect(r.precursor).toBeCloseTo(1.326, 10);
    expect(r.value).toBeCloseTo(1.37, 10);
    expect(resolveBenchmark(p("7208", { precursorBm: 0.5 }), 2026, "actual").value).toBeCloseTo(0.544, 10);
    expect(resolveBenchmark(p("7208", { bmRoute: "E" }), 2026, "actual").value).toBeCloseTo(0.072, 10);
  });
  it("manual benchmarks are used as entered", () => {
    expect(resolveBenchmark(p("7208", { bmMode: "manual", benchmark: 1.2 }), 2026, "default")).toMatchObject({ value: 1.2, source: "manual" });
  });
  it("reports what it cannot settle and applies no free allocation then", () => {
    expect(resolveBenchmark(p("7604"), 2026, "default")).toMatchObject({ status: "ambiguous", value: 0 });
    expect(resolveBenchmark(p("2716 00 00"), 2026, "default")).toMatchObject({ status: "none", value: 0 });
    expect(resolveBenchmark(p("2523 10 00"), 2026, "default")).toMatchObject({ status: "route", value: 0 });
    expect(resolveBenchmark(p("2523 10 00", { bmRoute: "B" }), 2026, "actual").status).toBe("ok");
  });
  it("settles 252 of the 260 Türkiye default-value codes; the rest are headings that need an 8-digit code", () => {
    const rows = cbamTr.rows as unknown as [string][];
    const unresolved = rows.map(([cn]) => [cn, resolveBenchmark(p(cn), 2026, "default").status]).filter(([, s]) => s !== "ok");
    expect(unresolved).toEqual(["7205", "7227", "722830", "722850", "7229", "730459", "731815", "731816"].map((cn) => [cn, "ambiguous"]));
  });
});

describe("free allocation adjustment in the projection", () => {
  it("uses the official benchmark of the sample products", () => {
    const [c1, c2] = SAMPLE_CLIENT.cbam.products;
    const s = SAMPLE_CLIENT.cbam.scenario;
    const y = projectProduct(c2, s)[0];
    expect(y.faa).toBeCloseTo(Math.min(y.gross, y.tonnes * 1.458 * cbamFactor(2026) * cscf(2026)), 6);
    const a = projectProduct(c1, s)[0];
    expect(a.faa).toBeCloseTo(Math.min(a.gross, a.tonnes * 1.37 * cbamFactor(2026) * cscf(2026)), 6);
  });
  it("property: the adjustment never exceeds gross emissions and grows with the benchmark", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 5, noNaN: true }), fc.double({ min: 0, max: 5, noNaN: true }), (b1, b2) => {
        const base = { ...SAMPLE_CLIENT.cbam.products[0], bmMode: "manual" as const };
        const [lo, hi] = [Math.min(b1, b2), Math.max(b1, b2)];
        const s = SAMPLE_CLIENT.cbam.scenario;
        const r1 = projectProduct({ ...base, benchmark: lo }, s);
        const r2 = projectProduct({ ...base, benchmark: hi }, s);
        r1.forEach((y, i) => {
          expect(y.faa).toBeLessThanOrEqual(y.gross + 1e-9);
          expect(r2[i].faa).toBeGreaterThanOrEqual(y.faa - 1e-9);
        });
      }),
    );
  });
});
