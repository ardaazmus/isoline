import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { importInventoryCsv, inventoryTemplateCsv, parseCsv, parseNumber } from "./inventory-csv";
import { computeInventory } from "./calc/ghg";

describe("parseNumber", () => {
  it("reads Turkish and English number formats", () => {
    expect(parseNumber("1234,5")).toBe(1234.5);
    expect(parseNumber("1.234,5")).toBe(1234.5);
    expect(parseNumber("1,234.5")).toBe(1234.5);
    expect(parseNumber("42.000.000")).toBe(42_000_000);
    expect(parseNumber("0.0345")).toBeCloseTo(0.0345);
    expect(parseNumber(" 60 000 ")).toBe(60000);
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("")).toBeNaN();
  });
  it("property: round-trips plain decimals written with a comma", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e9, noNaN: true }), (v) => {
        const s = v.toFixed(3).replace(".", ",");
        expect(parseNumber(s)).toBeCloseTo(Number(v.toFixed(3)), 6);
      }),
    );
  });
});

describe("parseCsv", () => {
  it("handles BOM, semicolons, quotes and CRLF", () => {
    const rows = parseCsv('﻿a;b\r\n"x;1";"he said ""hi"""\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x;1", 'he said "hi"'],
    ]);
  });
  it("detects comma-delimited files", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("importInventoryCsv", () => {
  it("imports every row of the template without issues", () => {
    const r = importInventoryCsv(inventoryTemplateCsv());
    expect(r.issues).toEqual([]);
    expect(r.rows).toBe(6);
    expect(r.lines.fuels).toHaveLength(2);
    expect(r.lines.fuels[1].mobile).toBe(true);
    expect(r.lines.scope3[0].factor).toBeCloseTo(1.9);
    expect(r.lines.electricity[0].certifiedMwh).toBe(6000);
    const inv = computeInventory({ ...r.lines, revenueMillionTry: 1, productionTonnes: 1 });
    expect(inv.scope3).toBeCloseTo(28_500);
  });
  it("reports bad rows with their spreadsheet row number and keeps the good ones", () => {
    const csv = ["type;label;item;amount;factor", "fuel;x;kerosene;10;", "scope3;y;16;5;1", "process;z;;12;", "fuel;w;diesel;-3;"].join("\n");
    const r = importInventoryCsv(csv);
    expect(r.lines.process).toHaveLength(1);
    expect(r.issues.map((i) => [i.row, i.key])).toEqual([
      [2, "badFuel"],
      [3, "badCategory"],
      [5, "badAmount"],
    ]);
  });
  it("refuses files without the required columns", () => {
    expect(importInventoryCsv("label;value\nx;1").issues[0].key).toBe("missingColumns");
  });
  it("caps certified electricity at the consumed amount", () => {
    const r = importInventoryCsv("type;amount;certified_mwh\nelectricity;100;250");
    expect(r.lines.electricity[0].certifiedMwh).toBe(100);
  });
});
