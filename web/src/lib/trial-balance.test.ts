import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as XLSX from "xlsx";
import { SAMPLE_CLIENT, SAMPLE_TB_SHA256 } from "@/data/sample";
import { sampleTrialBalanceCsv } from "@/data/sample-trial-balance";
import { aggregate, csvGrid, detectColumns, detectYear, fixedAssets, netSales, parseGrid, sha256Hex, tbTotals, type Grid, type TrialBalance } from "./trial-balance";
import { decodeText, importTrialBalance, MAX_SHEET_BYTES } from "./spreadsheet";

const tbOf = (grid: Grid, fileName = ""): TrialBalance => ({ fileName, sha256: "", importedAt: "", ...parseGrid(grid, fileName).sheet! });
const HEAD = ["Hesap Kodu", "Hesap Adı", "Borç", "Alacak"];
const acc = (tb: TrialBalance, code: string) => tb.accounts.find((a) => a.code === code)!;

describe("header detection", () => {
  it("finds Turkish headers below title rows, with currency suffixes", () => {
    const grid: Grid = [["Firma A.Ş. Mizan"], ["01.01.2026 - 31.12.2026"], [], ["HESAP KODU", "HESAP ADI", "BORÇ (TL)", "ALACAK (TL)", "BORÇ KALAN (TL)", "ALACAK KALAN (TL)"]];
    expect(detectColumns(grid)).toEqual({ headerRow: 3, cols: { code: 0, name: 1, debit: 2, credit: 3, balDebit: 4, balCredit: 5 } });
  });
  it("finds upper-case English headers despite Turkish I/ı casing", () => {
    const grid: Grid = [["ACCOUNT CODE", "ACCOUNT NAME", "DEBIT", "CREDIT", "DEBIT BALANCE", "CREDIT BALANCE"]];
    expect(detectColumns(grid)?.cols).toEqual({ code: 0, name: 1, debit: 2, credit: 3, balDebit: 4, balCredit: 5 });
  });
  it("accepts balance columns without movement columns", () => {
    const tb = tbOf([["Hesap Kodu", "Hesap Adı", "Borç Bakiye", "Alacak Bakiye"], ["100", "Kasa", 50, 0], ["500", "Sermaye", 0, 50]]);
    expect(tb.balanceSource).toBe("columns");
    expect(acc(tb, "500").balance).toBe(-50);
  });
  it("reports a missing header", () => {
    expect(parseGrid([["a", "b"], [1, 2]]).issues).toEqual([{ key: "noHeader" }]);
  });
  it("reads the period end year from the title rows or the file name", () => {
    expect(detectYear([["Mizan 01.01.2025 - 31.12.2025"], ["VKN 1234567890"]], "x.xlsx")).toBe(2025);
    expect(detectYear([], "mizan_2026_aralik.xls")).toBe(2026);
    expect(detectYear([["Mizan"]], "mizan.xlsx")).toBeUndefined();
  });
});

describe("rows and aggregation", () => {
  it("does not count sub-accounts twice when the main row is listed", () => {
    const tb = tbOf([HEAD, ["600", "Yurt İçi Satışlar", 0, 100], ["600.01", "A", 0, 60], ["600.02", "B", 0, 40]]);
    expect(acc(tb, "600")).toMatchObject({ credit: 100, balance: -100 });
  });
  it("sums every branch when only sub-accounts at mixed levels are listed", () => {
    const tb = tbOf([HEAD, ["600.01", "A", 0, 100], ["600.02.001", "B", 0, 50], ["600.02.002", "C", 0, 25]]);
    expect(acc(tb, "600").credit).toBe(175);
  });
  it("treats 600.1 and 600.10 as siblings, not parent and child", () => {
    const tb = tbOf([HEAD, ["600.1", "A", 0, 10], ["600.10", "B", 0, 5], ["600.10.001", "B1", 0, 5]]);
    expect(acc(tb, "600").credit).toBe(15);
  });
  it("skips class and group headings, totals and notes, and reads a name written in the code cell", () => {
    const tb = tbOf([HEAD, ["6", "GELİR TABLOSU", 0, 999], ["60", "BRÜT SATIŞLAR", 0, 999], ["600 YURT İÇİ SATIŞLAR", "", 0, 10], ["", "GENEL TOPLAM", 0, 10], ["Not: ...", "", "", ""]]);
    expect(tb.accounts.map((a) => a.code)).toEqual(["600"]);
    expect(tb.rows).toBe(1);
  });
  it("reads Turkish and English number formats", () => {
    const tb = tbOf([HEAD, ["100", "Kasa", "1.234.567,89", "1,234.56"], ["102", "Banka", 10, "0"]]);
    expect(acc(tb, "100")).toMatchObject({ debit: 1_234_567.89, credit: 1_234.56 });
  });
  it("reads tab-separated and semicolon exports", () => {
    expect(csvGrid("Hesap Kodu\tBorç\tAlacak\n100\t5\t0")).toEqual([["Hesap Kodu", "Borç", "Alacak"], ["100", "5", "0"]]);
    expect(csvGrid("Hesap Kodu;Borç;Alacak\r\n100;5;0")[1]).toEqual(["100", "5", "0"]);
  });
  it("property: splitting an account into sub-accounts never changes the main account", () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 1e9 }), fc.integer({ min: 0, max: 1e9 })), { minLength: 1, maxLength: 8 }), fc.boolean(), (parts, withMain) => {
        const debit = parts.reduce((s, p) => s + p[0], 0);
        const credit = parts.reduce((s, p) => s + p[1], 0);
        const subs = parts.map(([d, k], i) => ({ digits: `253${String(i + 1).padStart(2, "0")}`, name: "", debit: d, credit: k, balance: null }));
        const rows = withMain ? [{ digits: "253", name: "TMC", debit, credit, balance: null }, ...subs] : subs;
        expect(aggregate(rows)).toEqual([{ code: "253", name: withMain ? "TMC" : "Tesis, Makine ve Cihazlar", debit, credit, balance: debit - credit }]);
      }),
    );
  });
});

describe("figures and checks", () => {
  const sample = SAMPLE_CLIENT.trialBalance!;
  it("derives net sales from 600–602 minus 610–612", () => {
    expect(netSales(sample)).toEqual({ gross: 42_750_000_000, deductions: 750_000_000, net: 42_000_000_000, closed: false });
  });
  it("recognises a trial balance after closing entries and falls back to movements", () => {
    const tb = tbOf([HEAD, ["600", "Yurt İçi Satışlar", 1000, 1000], ["610", "İadeler", 30, 30], ["690", "Dönem Kârı", 970, 970]]);
    expect(netSales(tb)).toEqual({ gross: 1000, deductions: 30, net: 970, closed: true });
  });
  it("has no net sales without sales accounts", () => {
    expect(netSales(tbOf([HEAD, ["100", "Kasa", 5, 5]]))).toBeNull();
  });
  it("checks that debits equal credits", () => {
    expect(tbTotals(sample)).toMatchObject({ movementsBalanced: true, balancesBalanced: true });
    const off = tbOf([HEAD, ["100", "Kasa", 100, 0], ["500", "Sermaye", 0, 90]]);
    expect(tbTotals(off)).toMatchObject({ debit: 100, credit: 90, movementsBalanced: false, balancesBalanced: false });
  });
  it("property: a generated balanced trial balance always balances and net sales scale with the amounts", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 1e8 }), { minLength: 1, maxLength: 10 }), fc.integer({ min: 1, max: 1000 }), (sales, k) => {
        const total = sales.reduce((s, v) => s + v, 0);
        const grid: Grid = [HEAD, ...sales.map((v, i) => [`600.${i + 1}`, "Satış", 0, v * k]), ["120", "Alıcılar", total * k, 0]];
        const tb = tbOf(grid);
        expect(tbTotals(tb).movementsBalanced).toBe(true);
        expect(netSales(tb)!.net).toBe(total * k);
      }),
    );
  });
  it("splits fixed assets into cost, accumulated depreciation and net book value", () => {
    expect(fixedAssets(sample)).toMatchObject({ cost: 49_080_000_000, accumulated: 19_890_000_000, net: 29_190_000_000, construction: 2_750_000_000 });
  });
  it("reads the sample's period year", () => {
    expect(sample.year).toBe(2026);
    expect(sample.accounts).toHaveLength(29);
  });
});

describe("files", () => {
  const bytes = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
  it("hashes with SHA-256", async () => {
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("records the sample's evidence hash, equal to the hash of the downloadable sample file", async () => {
    expect(await sha256Hex(new TextEncoder().encode(sampleTrialBalanceCsv()))).toBe(SAMPLE_TB_SHA256);
    const { tb } = await importTrialBalance(bytes(sampleTrialBalanceCsv()), "ornek-mizan-2026.csv", new Date("2026-10-18T09:00:00Z"));
    expect(tb).toEqual(SAMPLE_CLIENT.trialBalance);
  });
  it("reads xlsx and legacy xls workbooks and picks the first sheet with a trial balance", async () => {
    for (const bookType of ["xlsx", "biff8"] as const) {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Kapak"], ["Bu sayfada tablo yok"]]), "Kapak");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mizan 31.12.2026"], HEAD, ["600", "Yurt İçi Satışlar", 0, 5_000], ["610", "İadeler", 200, 0], ["120", "Alıcılar", 4_800, 0]]), "Mizan");
      const buf = XLSX.write(wb, { type: "array", bookType }) as ArrayBuffer;
      const { tb, issues } = await importTrialBalance(buf, `mizan.${bookType === "biff8" ? "xls" : "xlsx"}`);
      expect(issues).toEqual([]);
      expect(tb).toMatchObject({ sheet: "Mizan", year: 2026, rows: 3 });
      expect(netSales(tb!)!.net).toBe(4_800);
    }
  });
  it("decodes Windows-1254 text exports", () => {
    // "Hesap Adı;Borç" in Windows-1254: ı = 0xFD, ç = 0xE7.
    const raw = Uint8Array.from([..."Hesap Ad"].map((c) => c.charCodeAt(0)).concat([0xfd, 0x3b], [..."Bor"].map((c) => c.charCodeAt(0)), [0xe7]));
    expect(decodeText(raw.buffer)).toBe("Hesap Adı;Borç");
  });
  it("rejects unreadable, headerless and oversized files", async () => {
    expect((await importTrialBalance(bytes("merhaba;dünya"), "x.csv")).issues).toEqual([{ key: "noHeader" }]);
    expect((await importTrialBalance(new ArrayBuffer(MAX_SHEET_BYTES + 1), "x.xlsx")).issues[0].key).toBe("tooLarge");
  });
});
