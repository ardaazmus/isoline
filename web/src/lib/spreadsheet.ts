/**
 * Reads spreadsheet files in the browser. Excel and OpenDocument files go through SheetJS (loaded on demand,
 * so it stays out of the main bundle); CSV and TXT exports go through the app's own parser, which knows
 * Turkish number formats. Nothing is uploaded anywhere.
 */
import { csvGrid, parseGrid, sha256Hex, type Grid, type TbIssue, type TrialBalance } from "./trial-balance";

export const SHEET_ACCEPT = ".xlsx,.xls,.xlsm,.ods,.csv,.txt";
export const MAX_SHEET_BYTES = 15 * 1024 * 1024;

const isText = (fileName: string) => /\.(csv|txt)$/i.test(fileName);

/** UTF-8 when the bytes are valid UTF-8, otherwise Windows-1254 (Turkish), which older exports use. */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1254").decode(buf);
  }
}

export async function readSheets(buf: ArrayBuffer, fileName: string): Promise<{ name: string; grid: Grid }[]> {
  if (isText(fileName)) return [{ name: fileName, grid: csvGrid(decodeText(buf)) }];
  const XLSX = await import("xlsx");
  const wb = XLSX.read(new Uint8Array(buf), { type: "array", dense: true, cellFormula: false, cellHTML: false, cellStyles: false });
  return wb.SheetNames.map((name) => ({
    name,
    grid: XLSX.utils.sheet_to_json<Grid[number]>(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }),
  }));
}

/** Reads a trial balance file: the first sheet that parses wins. */
export async function importTrialBalance(buf: ArrayBuffer, fileName: string, now = new Date()): Promise<{ tb: TrialBalance | null; issues: TbIssue[] }> {
  if (buf.byteLength > MAX_SHEET_BYTES) return { tb: null, issues: [{ key: "tooLarge", vars: { mb: Math.round(MAX_SHEET_BYTES / 1024 / 1024) } }] };
  let sheets: { name: string; grid: Grid }[];
  try {
    sheets = await readSheets(buf, fileName);
  } catch {
    return { tb: null, issues: [{ key: "unreadable" }] };
  }
  let issues: TbIssue[] = [{ key: "noHeader" }];
  for (const s of sheets) {
    const r = parseGrid(s.grid, fileName);
    if (r.sheet) {
      return {
        tb: { fileName, sha256: await sha256Hex(buf), importedAt: now.toISOString(), sheet: isText(fileName) ? undefined : s.name, ...r.sheet },
        issues: [],
      };
    }
    issues = r.issues;
  }
  return { tb: null, issues };
}
