import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { importIndicatorRows, INDICATOR_COLUMNS, INDICATOR_TEMPLATE_ROWS, normPeriod } from "./indicators-import";
import { importIndicatorsFile, importInventoryFile, IMPORT_LOG_LIMIT, lastImport, logImport, type ImportRecord } from "./imports";
import { INVENTORY_TEMPLATE_ROWS, inventoryTemplateCsv } from "./inventory-csv";
import { xlsxWorkbook } from "./spreadsheet";

const H = [...INDICATOR_COLUMNS];
const run = (...rows: string[][]) => importIndicatorRows([H, ...rows]);
const val = (r: ReturnType<typeof run>, key: string) => r.values.find((v) => v.key === key)?.value;

describe("indicator import", () => {
  it("reads the template without issues and aggregates by kind", () => {
    const r = importIndicatorRows(INDICATOR_TEMPLATE_ROWS);
    expect(r.issues).toEqual([]);
    expect(r.patch.env.energyGj).toBeCloseTo((1850 + 1720) * 3.6 + 96_000, 6);
    expect(r.patch.env.renewableGj).toBeCloseTo(640 * 3.6, 6);
    expect(r.patch.env.waterWithdrawalM3).toBe(223_000);
    expect(r.patch.env.waterStressShare).toBeCloseTo(182_000 / 223_000, 10);
    expect(r.patch.env.wasteHazardousT).toBeCloseTo(35, 10);
    expect(r.patch.safety).toEqual({ hoursWorked: 910_000, lostTimeInjuries: 2 });
    expect(r.patch.workforce).toEqual({ headcountStart: 455, headcountEnd: 580, avgPayMen: 61_500 });
    expect(r.values.find((v) => v.key === "energy")).toMatchObject({ rows: 3, sites: 2 });
  });
  it("takes each site's latest period for year-end stocks and earliest for start-of-year", () => {
    const r = run(["headcount_end", "A", "2026-06", "100"], ["headcount_end", "A", "12.2026", "110"], ["headcount_end", "B", "2026/12", "50"], ["headcount_start", "A", "2026-01", "95"], ["headcount_start", "A", "2026-07", "105"]);
    expect(r.patch.workforce).toEqual({ headcountEnd: 160, headcountStart: 95 });
  });
  it("refuses two values for one site and period, and two values for a single indicator", () => {
    const r = run(["headcount_end", "A", "2026-12", "100"], ["headcount_end", "a", "2026-12", "10"], ["avg_pay_women", "", "", "50000"], ["avg_pay_women", "", "", "52000"]);
    expect(r.issues.map((i) => [i.row, i.key])).toEqual([
      [3, "duplicate"],
      [5, "single"],
    ]);
    expect(r.patch.workforce).toEqual({});
  });
  it("converts units", () => {
    const r = run(["energy", "", "", "1000", "kWh"], ["energy", "", "", "1", "TEP"], ["water_withdrawal", "", "", "2", "ML"], ["waste_total", "", "", "500", "kg"], ["revenue", "", "", "42.000.000.000", "TL"], ["water_stress_share", "", "", "35", "%"]);
    expect(r.issues).toEqual([]);
    expect(r.patch.env.energyGj).toBeCloseTo(3.6 + 41.868, 10);
    expect(r.patch.env).toMatchObject({ waterWithdrawalM3: 2000, wasteTotalT: 0.5, revenueMillionTry: 42_000 });
    expect(r.patch.env.waterStressShare).toBeCloseTo(0.35, 10);
  });
  it("reports unknown indicators, units, values and periods by spreadsheet row", () => {
    const r = run(["co2", "", "", "1"], ["energy", "", "", "-5"], ["energy", "", "", "1", "litre"], ["energy", "", "Mart", "1"]);
    expect(r.issues.map((i) => [i.row, i.key])).toEqual([
      [2, "badIndicator"],
      [3, "badValue"],
      [4, "badUnit"],
      [5, "badPeriod"],
    ]);
    expect(r.issues[2].vars?.allowed).toContain("mwh");
  });
  it("derives the water-stress share only from a withdrawal in the same file", () => {
    expect(run(["water_withdrawal_stressed", "", "", "10"]).issues[0].key).toBe("needWithdrawal");
    expect(run(["water_withdrawal", "", "", "100"], ["water_withdrawal_stressed", "", "", "10"], ["water_stress_share", "", "", "0.5"]).issues[0].key).toBe("stressConflict");
  });
  it("finds the header below title rows and reports a missing one", () => {
    const r = importIndicatorRows([["Gösterge verisi 2026"], [], H, ["fatalities", "", "", "0"]]);
    expect(r.issues).toEqual([]);
    expect(r.patch.safety).toEqual({ fatalities: 0 });
    expect(importIndicatorRows([["a", "b"]]).issues[0].key).toBe("missingColumns");
    expect(importIndicatorRows([]).issues[0].key).toBe("empty");
  });
  it("normalises periods", () => {
    expect(["2026", "2026-3", "2026/12", "03.2026", "3/2026", "", "Mart 2026", "2026-13"].map(normPeriod)).toEqual(["2026", "2026-03", "2026-12", "2026-03", "2026-03", "", null, null]);
  });
  it("property: flows do not depend on row order or on how a value is split", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1e7 }), { minLength: 1, maxLength: 12 }), fc.integer(), (parts, seed) => {
        const rows = parts.map((p, i) => ["water_discharge", `S${i % 3}`, "", String(p)]);
        const shuffled = [...rows].sort((a, b) => ((a[3].length * 31 + seed) % 7) - ((b[3].length * 31 + seed) % 7));
        expect(val(run(...shuffled), "water_discharge")).toBe(parts.reduce((s, p) => s + p, 0));
      }),
    );
  });
  it("property: year-end headcount is the sum of each site's last month", () => {
    fc.assert(
      fc.property(fc.array(fc.array(fc.integer({ min: 0, max: 5000 }), { minLength: 1, maxLength: 12 }), { minLength: 1, maxLength: 5 }), (sites) => {
        const rows = sites.flatMap((months, s) => months.map((v, m) => ["headcount_end", `Tesis ${s}`, `2026-${String(m + 1).padStart(2, "0")}`, String(v)]));
        expect(val(run(...rows), "headcount_end")).toBe(sites.reduce((sum, months) => sum + months.at(-1)!, 0));
      }),
    );
  });
});

describe("file imports and the evidence log", () => {
  it("reads the indicator template from an Excel workbook like from CSV", async () => {
    const buf = await xlsxWorkbook([{ name: "Kapak", rows: [["Isoline"]] }, { name: "Göstergeler", rows: INDICATOR_TEMPLATE_ROWS }]);
    const r = await importIndicatorsFile(buf, "gostergeler.xlsx");
    expect(r.ok && r.sheet).toBe("Göstergeler");
    if (!r.ok) return;
    expect(r.result.issues).toEqual([]);
    expect(r.result.patch).toEqual(importIndicatorRows(INDICATOR_TEMPLATE_ROWS).patch);
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
  it("reads the inventory template from Excel and CSV alike", async () => {
    const x = await importInventoryFile(await xlsxWorkbook([{ name: "Envanter", rows: INVENTORY_TEMPLATE_ROWS }]), "envanter.xlsx");
    const c = await importInventoryFile(new TextEncoder().encode(inventoryTemplateCsv()).buffer as ArrayBuffer, "envanter.csv");
    expect(x.ok && c.ok).toBe(true);
    if (!x.ok || !c.ok) return;
    expect(x.result.issues).toEqual([]);
    expect(x.result.rows).toBe(6);
    const strip = (l: object) => JSON.parse(JSON.stringify(l, (k, v) => (k === "id" ? undefined : v)));
    expect(strip(x.result.lines)).toEqual(strip(c.result.lines));
    expect(c.sheet).toBeUndefined();
  });
  it("refuses oversized and unreadable files", async () => {
    expect(await importIndicatorsFile(new ArrayBuffer(16 * 1024 * 1024), "x.xlsx")).toEqual({ ok: false, error: "tooLarge" });
    // SheetJS may read garbage as an empty sheet; either way nothing is imported and the user sees why.
    const g = await importIndicatorsFile(new Uint8Array([1, 2, 3, 4]).buffer as ArrayBuffer, "x.xlsx");
    if (g.ok) {
      expect(g.result.values).toEqual([]);
      expect(["missingColumns", "empty"]).toContain(g.result.issues[0]?.key);
    } else expect(g.error).toBe("unreadable");
  });
  it("keeps the newest records first and caps the log", () => {
    const rec = (i: number): ImportRecord => ({ tool: i % 2 ? "ghg" : "indicators", fileName: `f${i}`, sha256: "", importedAt: "", rows: 1, applied: 1 });
    let log: ImportRecord[] = [];
    for (let i = 0; i < IMPORT_LOG_LIMIT + 5; i++) log = logImport(log, rec(i));
    expect(log).toHaveLength(IMPORT_LOG_LIMIT);
    expect(log[0].fileName).toBe(`f${IMPORT_LOG_LIMIT + 4}`);
    expect(lastImport(log, "ghg")?.fileName).toBe(`f${IMPORT_LOG_LIMIT + 3}`);
  });
});
