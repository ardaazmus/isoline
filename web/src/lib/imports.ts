/**
 * File-level imports for the tools: read the file (Excel, OpenDocument or CSV), take the first sheet the
 * row importer recognises, and hash the file so every import leaves an evidence record (file, SHA-256,
 * time, rows) in the client's import log.
 */
import { importIndicatorRows, type IndicatorImport } from "./indicators-import";
import { importInventoryRows, type ImportResult } from "./inventory-csv";
import { gridToStrings, MAX_SHEET_BYTES, readSheets } from "./spreadsheet";
import { sha256Hex } from "./trial-balance";

export type ImportTool = "ghg" | "indicators" | "trialBalance";

export type ImportRecord = {
  tool: ImportTool;
  fileName: string;
  sha256: string;
  importedAt: string;
  sheet?: string;
  /** Data rows read from the file. */
  rows: number;
  /** Lines, indicators or accounts taken into the tool. */
  applied: number;
  mode?: "append" | "replace";
};

export const IMPORT_LOG_LIMIT = 50;

export type FileRead<T> = { ok: true; result: T; sheet?: string; sha256: string } | { ok: false; error: "tooLarge" | "unreadable" };

const isText = (fileName: string) => /\.(csv|txt)$/i.test(fileName);

/** Runs `parse` on each sheet and returns the first one `recognised` accepts, else the first sheet's result. */
export async function readFirstSheet<T>(buf: ArrayBuffer, fileName: string, parse: (rows: string[][]) => T, recognised: (r: T) => boolean): Promise<FileRead<T>> {
  if (buf.byteLength > MAX_SHEET_BYTES) return { ok: false, error: "tooLarge" };
  let sheets: Awaited<ReturnType<typeof readSheets>>;
  try {
    sheets = await readSheets(buf, fileName);
  } catch {
    return { ok: false, error: "unreadable" };
  }
  if (!sheets.length) return { ok: false, error: "unreadable" };
  const sha256 = await sha256Hex(buf);
  let first: { result: T; sheet?: string } | null = null;
  for (const s of sheets) {
    const result = parse(gridToStrings(s.grid));
    const sheet = isText(fileName) ? undefined : s.name;
    if (recognised(result)) return { ok: true, result, sheet, sha256 };
    first ??= { result, sheet };
  }
  return { ok: true, ...first!, sha256 };
}

const headerFound = (issues: { key: string }[]) => !issues.some((i) => i.key === "missingColumns" || i.key === "empty");

export function importInventoryFile(buf: ArrayBuffer, fileName: string): Promise<FileRead<ImportResult>> {
  return readFirstSheet(buf, fileName, importInventoryRows, (r) => headerFound(r.issues));
}

export function importIndicatorsFile(buf: ArrayBuffer, fileName: string): Promise<FileRead<IndicatorImport>> {
  return readFirstSheet(buf, fileName, importIndicatorRows, (r) => headerFound(r.issues));
}

/** Newest first, capped. */
export function logImport(log: ImportRecord[] | undefined, rec: ImportRecord): ImportRecord[] {
  return [rec, ...(log ?? [])].slice(0, IMPORT_LOG_LIMIT);
}

export function lastImport(log: ImportRecord[] | undefined, tool: ImportTool): ImportRecord | undefined {
  return log?.find((r) => r.tool === tool);
}
