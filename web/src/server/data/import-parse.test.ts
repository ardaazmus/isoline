import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { detectMapping, parseRows, type Target } from "./import-parse";

const targets: Target[] = [
  { requestId: "r-el-g", metricCode: "ghg_electricity", facilityId: "f-g", facilityName: "Gebze", status: "sent", reviewerUserId: "rev" },
  { requestId: "r-el-d", metricCode: "ghg_electricity", facilityId: "f-d", facilityName: "Dilovası", status: "accepted", reviewerUserId: "rev" },
  { requestId: "r-fuel", metricCode: "ghg_stationary", facilityId: "f-g", facilityName: "Gebze", status: "sent", reviewerUserId: "rev" },
  { requestId: "r-sales", metricCode: "net_sales", facilityId: null, facilityName: null, status: "assigned", reviewerUserId: "rev" },
];

const grid = [
  ["Anadolu Gıda — 2026 veri dosyası"],
  ["Metrik", "Tesis", "Kalem", "Değer", "Birim", "Kalite", "Açıklama"],
  ["ghg_electricity", "Gebze", "", "1.250.000", "kWh", "ölçüm", "TEDAŞ faturaları"],
  ["ghg_electricity", "Dilovası", "", "900000", "kWh", "", ""],
  ["ghg_stationary", "Gebze", "natural_gas", "125000", "m³", "", ""],
  ["ghg_stationary", "Gebze", "natural_gas", "1", "m3", "", ""],
  ["ghg_stationary", "Gebze", "plutonium", "1", "kg", "", ""],
  ["net_sales", "", "", "2.345,6", "milyon TL", "", ""],
  ["ghg_electricity", "Ankara", "", "1", "kWh", "", ""],
  ["ghg_electricity", "Gebze", "", "abc", "kWh", "", ""],
  ["unknown_metric", "", "", "1", "t", "", ""],
  ["", "", "", "", "", "", ""],
];

describe("import parser (G3-05)", () => {
  it("finds the header below a title row and maps Turkish headings", () => {
    const d = detectMapping(grid)!;
    expect(d.headerRow).toBe(1);
    expect(d.mapping).toEqual({ metric: 0, facility: 1, line: 2, value: 3, unit: 4, quality: 5, note: 6 });
  });

  it("accepts good rows and reports each bad row with its column and reason", () => {
    const d = detectMapping(grid)!;
    const r = parseRows(grid, d.headerRow, d.mapping, targets);
    expect(r.total).toBe(9);
    expect(r.rows.map((x) => [x.row, x.requestId, x.value, x.unit])).toEqual([
      [3, "r-el-g", "1250000", "kWh"],
      [5, "r-fuel", "125000", "m3"],
      [8, "r-sales", "2345.6", "mTRY"],
    ]);
    expect(r.rows[0].quality).toBe("measured");
    expect(r.errors).toEqual([
      { row: 4, column: null, code: "request_accepted" },
      { row: 6, column: null, code: "duplicate_row" },
      { row: 7, column: "line", code: "unknown_line" },
      { row: 9, column: "facility", code: "unknown_facility" },
      { row: 10, column: "value", code: "invalid_number" },
      { row: 11, column: "metric", code: "unknown_metric" },
    ]);
  });

  it("refuses a unit of the wrong kind", () => {
    const g = [["metric", "facility", "value", "unit"], ["ghg_electricity", "Gebze", "10", "kg"]];
    const d = detectMapping(g)!;
    expect(parseRows(g, d.headerRow, d.mapping, targets).errors).toEqual([{ row: 2, column: "unit", code: "unit_not_allowed" }]);
  });

  it("property: every non-empty row is either accepted or reported, never both or neither", () => {
    const row = fc.tuple(fc.constantFrom("ghg_electricity", "net_sales", "x"), fc.constantFrom("Gebze", "", "Ankara"), fc.oneof(fc.integer({ min: -5, max: 1e6 }).map(String), fc.constant("abc")), fc.constantFrom("kWh", "MWh", "t", "TL", ""));
    fc.assert(
      fc.property(fc.array(row, { maxLength: 30 }), (rs) => {
        const g = [["metric", "facility", "value", "unit"], ...rs.map((r) => [...r])];
        const d = detectMapping(g)!;
        const out = parseRows(g, d.headerRow, d.mapping, targets);
        const nonEmpty = rs.filter((r) => r.some((c) => c.trim())).length;
        expect(out.rows.length + out.errors.length).toBe(nonEmpty);
        const rowsOk = new Set(out.rows.map((x) => x.row));
        for (const e of out.errors) expect(rowsOk.has(e.row)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});
