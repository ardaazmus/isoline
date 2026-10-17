/**
 * Trial balance (mizan) import. Reads the grid of a spreadsheet exported from accounting software, finds the
 * header row, aggregates detail accounts into Turkish uniform chart of accounts (Tekdüzen Hesap Planı, 1 Sıra
 * No'lu Muhasebe Sistemi Uygulama Genel Tebliği) main accounts, checks that the trial balance balances and
 * derives net sales: gross sales 600 + 601 + 602 minus sales deductions 610 + 611 + 612.
 *
 * Amounts are TRY. Balances are debit-positive (credit-nature accounts carry negative balances).
 */
import { parseCsv, parseNumber } from "./inventory-csv";

export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];

export type TbAccount = {
  /** Three-digit main account (600). */
  code: string;
  name: string;
  /** Period debit and credit totals (turnover). */
  debit: number;
  credit: number;
  /** Closing balance, debit-positive. */
  balance: number;
};

export type TrialBalance = {
  fileName: string;
  /** SHA-256 of the uploaded file, hex: identifies the evidence the figures come from. */
  sha256: string;
  importedAt: string;
  sheet?: string;
  /** Period end year found in the file's title rows or name. */
  year?: number;
  /** Detail rows read from the file. */
  rows: number;
  /** Whether closing balances came from balance columns or were derived as debit − credit. */
  balanceSource: "columns" | "movements";
  accounts: TbAccount[];
};

export type TbIssue = { key: string; vars?: Record<string, string | number> };

/** Main accounts the product reads, with their names in the uniform chart (TDHP). */
export const TDHP: Record<string, string> = {
  "250": "Arazi ve Arsalar",
  "251": "Yeraltı ve Yerüstü Düzenleri",
  "252": "Binalar",
  "253": "Tesis, Makine ve Cihazlar",
  "254": "Taşıtlar",
  "255": "Demirbaşlar",
  "256": "Diğer Maddi Duran Varlıklar",
  "257": "Birikmiş Amortismanlar (-)",
  "258": "Yapılmakta Olan Yatırımlar",
  "259": "Verilen Avanslar",
  "260": "Haklar",
  "261": "Şerefiye",
  "262": "Kuruluş ve Örgütlenme Giderleri",
  "263": "Araştırma ve Geliştirme Giderleri",
  "264": "Özel Maliyetler",
  "267": "Diğer Maddi Olmayan Duran Varlıklar",
  "268": "Birikmiş Amortismanlar (-)",
  "269": "Verilen Avanslar",
  "600": "Yurt İçi Satışlar",
  "601": "Yurt Dışı Satışlar",
  "602": "Diğer Gelirler",
  "610": "Satıştan İadeler (-)",
  "611": "Satış İskontoları (-)",
  "612": "Diğer İndirimler (-)",
  "690": "Dönem Kârı veya Zararı",
};

export const GROSS_SALES = ["600", "601", "602"];
export const SALES_DEDUCTIONS = ["610", "611", "612"];
/** Tangible (25x) and intangible (26x) fixed assets at cost; 257 and 268 are accumulated depreciation. */
export const FIXED_ASSETS = ["250", "251", "252", "253", "254", "255", "256", "258", "259", "260", "261", "262", "263", "264", "267", "269"];
export const ACCUMULATED_DEPRECIATION = ["257", "268"];

// ------------------------------------------------------------------ header detection

/** Header text in a comparable form; Turkish and English lower-casing differ on I, so both are produced. */
const norms = (v: Cell): string[] => {
  const base = String(v ?? "")
    .replace(/[._:/()\-]+/g, " ")
    .replace(/(^|\s)(TL|TRY|₺)(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [base.toLocaleLowerCase("tr"), base.toLowerCase()];
};

type Cols = { code: number; name: number; debit: number; credit: number; balDebit: number; balCredit: number };

const IS = {
  code: (h: string) => /^(hesap )?(kodu?|no|numarası)$|^account (code|no|number)$|^hesap kodu$|^code$/.test(h),
  name: (h: string) => /^(hesap )?(adı|ismi|açıklama(sı)?)$|^account( name)?$|^description$|^name$/.test(h),
  balDebit: (h: string) => /^(borç|borc) (bakiye(si)?|kalan(ı)?)$|^bakiye borç$|^kalan borç$|^debit balance$/.test(h),
  balCredit: (h: string) => /^(alacak) (bakiye(si)?|kalan(ı)?)$|^bakiye alacak$|^kalan alacak$|^credit balance$/.test(h),
  debit: (h: string) => /^(dönem )?(borç|borc)( toplam(ı)?| tutar(ı)?| hareket(i)?)?$|^toplam borç$|^debit( total)?$|^total debit$/.test(h),
  credit: (h: string) => /^(dönem )?alacak( toplam(ı)?| tutar(ı)?| hareket(i)?)?$|^toplam alacak$|^credit( total)?$|^total credit$/.test(h),
};

/** Finds the header row (within the first 40 rows) and the column of each field. */
export function detectColumns(grid: Grid): { headerRow: number; cols: Cols } | null {
  for (let r = 0; r < Math.min(grid.length, 40); r++) {
    const hs = (grid[r] ?? []).map(norms);
    const find = (test: (h: string) => boolean) => hs.findIndex((vs) => vs.some((h) => h !== "" && test(h)));
    const cols: Cols = { code: find(IS.code), name: find(IS.name), debit: find(IS.debit), credit: find(IS.credit), balDebit: find(IS.balDebit), balCredit: find(IS.balCredit) };
    const hasMovements = cols.debit >= 0 && cols.credit >= 0;
    const hasBalances = cols.balDebit >= 0 && cols.balCredit >= 0;
    if (cols.code >= 0 && (hasMovements || hasBalances)) return { headerRow: r, cols };
  }
  return null;
}

/** Period end year from the title rows above the header ("01.01.2026 - 31.12.2026") or the file name. */
export function detectYear(titleRows: Grid, fileName: string): number | undefined {
  const text = [...titleRows.flat().map((c) => String(c ?? "")), fileName].join(" ");
  const years = [...text.matchAll(/(?:^|[^0-9])((?:19|20)\d{2})(?![0-9])/g)].map((m) => Number(m[1]));
  return years.length ? Math.max(...years) : undefined;
}

const num = (v: Cell): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === "") return 0;
  const n = parseNumber(String(v));
  return Number.isFinite(n) ? n : 0;
};

// ------------------------------------------------------------------ parsing and aggregation

type Detail = {
  digits: string;
  /** Code segments as written (600.02.001 → 600, 02, 001); a code without separators is one segment. */
  segs?: string[];
  name: string;
  debit: number;
  credit: number;
  balance: number | null;
};

/**
 * o is an ancestor of r. With separators the comparison is per segment, so 600.1 and 600.10 are siblings;
 * between two unseparated codes (600, 60001) it falls back to the digit prefix.
 */
function isAncestor(o: Detail, r: Detail): boolean {
  const os = o.segs ?? [o.digits];
  const rs = r.segs ?? [r.digits];
  if (os.length === 1 && rs.length === 1) return o.digits.length < r.digits.length && r.digits.startsWith(o.digits);
  return os.length < rs.length && os.every((s, i) => s === rs[i]);
}

/**
 * Aggregates detail rows into main accounts. Only rows without an ancestor in the file are summed: a main
 * row (600) stands for its sub-accounts, and a sub-account (600.02) for its own children, so a file listing
 * several levels is neither counted twice nor missing a branch.
 */
export function aggregate(details: Detail[]): TbAccount[] {
  const byMain = new Map<string, Detail[]>();
  for (const d of details) {
    const main = d.digits.slice(0, 3);
    byMain.set(main, [...(byMain.get(main) ?? []), d]);
  }
  const out: TbAccount[] = [];
  for (const [code, rows] of byMain) {
    const picked = rows.filter((r) => !rows.some((o) => o !== r && isAncestor(o, r)));
    const level = Math.min(...picked.map((r) => r.digits.length));
    const debit = picked.reduce((s, r) => s + r.debit, 0);
    const credit = picked.reduce((s, r) => s + r.credit, 0);
    const balance = picked.every((r) => r.balance !== null) ? picked.reduce((s, r) => s + (r.balance ?? 0), 0) : debit - credit;
    const name = (level === 3 ? picked[0].name : "") || TDHP[code] || picked[0].name;
    out.push({ code, name, debit: round2(debit), credit: round2(credit), balance: round2(balance) });
  }
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export type ParsedSheet = { accounts: TbAccount[]; rows: number; balanceSource: TrialBalance["balanceSource"]; year?: number };

/** Parses one sheet's grid. Returns null with issues when the header or any account row is missing. */
export function parseGrid(grid: Grid, fileName = ""): { sheet: ParsedSheet | null; issues: TbIssue[] } {
  const det = detectColumns(grid);
  if (!det) return { sheet: null, issues: [{ key: "noHeader" }] };
  const { headerRow, cols } = det;
  const hasBal = cols.balDebit >= 0 && cols.balCredit >= 0;
  const details: Detail[] = [];
  for (const row of grid.slice(headerRow + 1)) {
    const raw = String(row?.[cols.code] ?? "").trim();
    const lead = raw.match(/^\d[\d.\-\s]*/)?.[0]; // the code, without a name written in the same cell
    if (!lead) continue; // totals, blank and note rows
    const digits = lead.replace(/\D/g, "");
    if (digits.length < 3) continue; // class and group headings (1, 60)
    const debit = cols.debit >= 0 ? num(row[cols.debit]) : 0;
    const credit = cols.credit >= 0 ? num(row[cols.credit]) : 0;
    const balance = hasBal ? num(row[cols.balDebit]) - num(row[cols.balCredit]) : null;
    const segs = lead.trim().split(/[.\-\s]+/).filter(Boolean);
    details.push({ digits, segs, name: cols.name >= 0 ? String(row[cols.name] ?? "").trim() : "", debit, credit, balance });
  }
  if (!details.length) return { sheet: null, issues: [{ key: "noRows" }] };
  return {
    sheet: { accounts: aggregate(details), rows: details.length, balanceSource: hasBal ? "columns" : "movements", year: detectYear(grid.slice(0, headerRow), fileName) },
    issues: [],
  };
}

/** Grid of a CSV/TXT export (semicolon, comma or tab separated; Turkish or English numbers). */
export function csvGrid(text: string): Grid {
  const first = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  if (first.includes("\t") && !first.includes(";")) return text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.split("\t"));
  return parseCsv(text);
}

// ------------------------------------------------------------------ figures and checks

const sum = (tb: TrialBalance, codes: string[], f: (a: TbAccount) => number) => tb.accounts.filter((a) => codes.includes(a.code)).reduce((s, a) => s + f(a), 0);

export type NetSales = {
  gross: number;
  deductions: number;
  net: number;
  /** Closing entries already moved the income statement accounts into 690: figures come from movements. */
  closed: boolean;
};

export function netSales(tb: TrialBalance): NetSales | null {
  const present = tb.accounts.some((a) => GROSS_SALES.includes(a.code));
  if (!present) return null;
  const grossBalance = -sum(tb, GROSS_SALES, (a) => a.balance);
  const grossMovement = sum(tb, GROSS_SALES, (a) => a.credit);
  // After closing, 600–602 carry equal debit and credit totals and a zero balance.
  const closed = Math.abs(grossBalance) < 0.005 * Math.max(1, grossMovement) && grossMovement > 0;
  const gross = closed ? grossMovement : grossBalance;
  const deductions = closed ? sum(tb, SALES_DEDUCTIONS, (a) => a.debit) : sum(tb, SALES_DEDUCTIONS, (a) => a.balance);
  return { gross: round2(gross), deductions: round2(deductions), net: round2(gross - deductions), closed };
}

export type TbTotals = { debit: number; credit: number; balanceDebit: number; balanceCredit: number; movementsBalanced: boolean; balancesBalanced: boolean };

/** A trial balance balances: total debits = total credits, and debit balances = credit balances. */
export function tbTotals(tb: TrialBalance): TbTotals {
  const debit = tb.accounts.reduce((s, a) => s + a.debit, 0);
  const credit = tb.accounts.reduce((s, a) => s + a.credit, 0);
  const balanceDebit = tb.accounts.reduce((s, a) => s + Math.max(0, a.balance), 0);
  const balanceCredit = tb.accounts.reduce((s, a) => s + Math.max(0, -a.balance), 0);
  const ok = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, 1e-7 * Math.max(a, b));
  return { debit: round2(debit), credit: round2(credit), balanceDebit: round2(balanceDebit), balanceCredit: round2(balanceCredit), movementsBalanced: ok(debit, credit), balancesBalanced: ok(balanceDebit, balanceCredit) };
}

export type FixedAssets = { cost: number; accumulated: number; net: number; construction: number; byAccount: TbAccount[] };

/** Fixed assets at closing: cost (25x/26x), accumulated depreciation (257, 268) and the net book value. */
export function fixedAssets(tb: TrialBalance): FixedAssets {
  const cost = sum(tb, FIXED_ASSETS, (a) => a.balance);
  const accumulated = -sum(tb, ACCUMULATED_DEPRECIATION, (a) => a.balance);
  return {
    cost: round2(cost),
    accumulated: round2(accumulated),
    net: round2(cost - accumulated),
    construction: round2(sum(tb, ["258"], (a) => a.balance)),
    byAccount: tb.accounts.filter((a) => FIXED_ASSETS.includes(a.code) || ACCUMULATED_DEPRECIATION.includes(a.code)),
  };
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Template with the columns the importer recognises. */
export const TB_COLUMNS = ["Hesap Kodu", "Hesap Adı", "Borç", "Alacak", "Borç Bakiye", "Alacak Bakiye"];

export function trialBalanceCsv(rows: [code: string, name: string, debit: number, credit: number][], title?: string): string {
  const fmt = (v: number) => (v ? String(v).replace(".", ",") : "0");
  const lines = rows.map(([c, n, d, k]) => [c, n, fmt(d), fmt(k), fmt(Math.max(0, d - k)), fmt(Math.max(0, k - d))].join(";"));
  return "﻿" + [...(title ? [title, ""] : []), TB_COLUMNS.join(";"), ...lines].join("\r\n");
}

/** Empty template: the recognised columns and the sales accounts the product reads. */
export function trialBalanceTemplateCsv(): string {
  return trialBalanceCsv([...GROSS_SALES, ...SALES_DEDUCTIONS].map((c) => [c, TDHP[c], 0, 0]));
}
