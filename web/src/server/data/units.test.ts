import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { convert, dimensionOf, normalizeUnit, plainDecimal, toCanonical, unitsFor } from "./units";

describe("units (plan 09 §3)", () => {
  it("converts exactly, without binary floating point drift", () => {
    expect(convert("1", "kWh", "GJ")).toBe("0.0036");
    expect(convert("1000", "kWh", "MWh")).toBe("1");
    expect(convert("1", "toe", "GJ")).toBe("41.868");
    expect(convert("2500", "kg", "t")).toBe("2.5");
    expect(convert("1", "L", "m3")).toBe("0.001");
    expect(convert("0.1", "MWh", "kWh")).toBe("100");
    expect(toCanonical("12345.678", "kWh")).toEqual({ value: "44.4444408", unit: "GJ" });
  });

  it("refuses to mix dimensions", () => {
    expect(() => convert("1", "kg", "kWh")).toThrow(/incompatible/);
    expect(() => convert("1", "TRY", "EUR")).not.toThrow(); // same dimension, but money is never converted by rate here
    expect(dimensionOf("TRY")).toBe("money");
  });

  it("reads the units people type", () => {
    expect(normalizeUnit("kwh")).toBe("kWh");
    expect(normalizeUnit("m³")).toBe("m3");
    expect(normalizeUnit("TEP")).toBe("toe");
    expect(normalizeUnit("ton")).toBe("t");
    expect(normalizeUnit("furlong")).toBeNull();
  });

  it("reads Turkish and English number formats", () => {
    expect(plainDecimal("1.234,5")).toBe("1234.5");
    expect(plainDecimal("1,234.5")).toBe("1234.5");
    expect(plainDecimal("1.234.567")).toBe("1234567");
    expect(plainDecimal("12,5")).toBe("12.5");
    expect(plainDecimal("1,234")).toBe("1.234"); // one separator is the decimal mark, as in the toolkit
    expect(plainDecimal("4.000")).toBe("4.000");
    expect(plainDecimal("-0,75")).toBe("-0.75");
    expect(plainDecimal(1e21)).toBe("1000000000000000000000");
    expect(plainDecimal("abc")).toBeNull();
    expect(plainDecimal("")).toBeNull();
  });

  it("property: a round trip through any unit of the dimension returns the value", () => {
    const dims = ["energy", "volume", "mass", "emissions"] as const;
    fc.assert(
      fc.property(fc.constantFrom(...dims), fc.integer({ min: 0, max: 10_000_000 }), fc.integer({ min: 0, max: 3 }), (dim, int, places) => {
        const units = unitsFor(dim);
        const value = places ? (int / 10 ** places).toFixed(places) : String(int);
        for (const a of units)
          for (const b of units) {
            const there = convert(value, a, b);
            const back = convert(there, b, a);
            expect(Math.abs(Number(back) - Number(value))).toBeLessThanOrEqual(Math.max(1e-9, Number(value) * 1e-12));
          }
      }),
      { numRuns: 200 },
    );
  });

  it("property: conversion is linear (sum of conversions = conversion of the sum)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), fc.integer({ min: 0, max: 1_000_000 }), (a, b) => {
        const s = Number(convert(String(a), "kWh", "GJ")) + Number(convert(String(b), "kWh", "GJ"));
        expect(Number(convert(String(a + b), "kWh", "GJ"))).toBeCloseTo(s, 9);
      }),
    );
  });
});
