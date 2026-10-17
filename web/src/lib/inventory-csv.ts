/**
 * Bulk import of GHG inventory lines from CSV (Excel "CSV UTF-8" or Turkish Excel ";" exports).
 * One row per line; the `type` column decides how the row is read:
 *   fuel        item = fuel id, amount in the fuel's unit, optional ncv/ef override, use = stationary|mobile
 *   process     amount = tCO₂e
 *   refrigerant item = gas (e.g. R-410A), amount = kg leaked
 *   electricity amount = MWh, connection = transmission|distribution, certified_mwh, optional supplier_factor
 *   scope3      item = category 1–15, amount, unit, factor (tCO₂e per unit), factor_source
 */
import { FUELS, GWP_AR6, type FuelId, type Inventory, type Quality } from "./calc/ghg";

export const CSV_COLUMNS = [
  "type",
  "label",
  "item",
  "amount",
  "unit",
  "ncv",
  "ef",
  "use",
  "connection",
  "certified_mwh",
  "supplier_factor",
  "factor",
  "factor_source",
  "quality",
] as const;

export type ImportIssue = { row: number; key: string; vars?: Record<string, string | number> };
export type ImportResult = {
  lines: Pick<Inventory, "fuels" | "process" | "refrigerants" | "electricity" | "scope3">;
  issues: ImportIssue[];
  rows: number;
};

/** Splits CSV text into rows of cells; handles quotes, BOM, CRLF and ";" or "," delimiters. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Reads "1234,5", "1.234,5", "1234.5", "1,234.5" and "42.000.000". Returns NaN for anything else. */
export function parseNumber(raw: string | undefined): number {
  if (raw === undefined) return NaN;
  let s = raw.trim().replace(/\s| /g, "");
  if (s === "") return NaN;
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return /^-?\d*\.?\d+(e-?\d+)?$/i.test(s) ? Number(s) : NaN;
}

const QUALITIES: Quality[] = ["measured", "calculated", "estimated"];
const uid = (n: number) => `csv-${Date.now().toString(36)}-${n}`;

export function importInventoryCsv(text: string): ImportResult {
  const rows = parseCsv(text);
  const result: ImportResult = { lines: { fuels: [], process: [], refrigerants: [], electricity: [], scope3: [] }, issues: [], rows: 0 };
  if (rows.length === 0) {
    result.issues.push({ row: 0, key: "empty" });
    return result;
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = ["type", "amount"].filter((c) => !header.includes(c));
  if (missing.length) {
    result.issues.push({ row: 1, key: "missingColumns", vars: { cols: missing.join(", ") } });
    return result;
  }
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  rows.slice(1).forEach((r, idx) => {
    const n = idx + 2; // spreadsheet row number (header is row 1)
    result.rows++;
    const type = col(r, "type").toLowerCase();
    const label = col(r, "label");
    const item = col(r, "item");
    const amount = parseNumber(col(r, "amount"));
    const q = col(r, "quality").toLowerCase();
    const quality: Quality = QUALITIES.includes(q as Quality) ? (q as Quality) : "calculated";
    if (!Number.isFinite(amount) || amount < 0) {
      result.issues.push({ row: n, key: "badAmount", vars: { value: col(r, "amount") } });
      return;
    }
    switch (type) {
      case "fuel": {
        if (!(item in FUELS)) {
          result.issues.push({ row: n, key: "badFuel", vars: { value: item, allowed: Object.keys(FUELS).join(", ") } });
          return;
        }
        const f = FUELS[item as FuelId];
        const ncv = parseNumber(col(r, "ncv"));
        const ef = parseNumber(col(r, "ef"));
        result.lines.fuels.push({
          id: uid(n),
          fuel: f.id,
          label: label || item,
          amount,
          ncv: Number.isFinite(ncv) && ncv > 0 ? ncv : f.ncv,
          ef: Number.isFinite(ef) && ef > 0 ? ef : f.ef,
          mobile: col(r, "use").toLowerCase() === "mobile",
          quality,
        });
        return;
      }
      case "process":
        result.lines.process.push({ id: uid(n), label: label || "Process", tco2e: amount, quality });
        return;
      case "refrigerant": {
        if (!(item in GWP_AR6)) {
          result.issues.push({ row: n, key: "badGas", vars: { value: item, allowed: Object.keys(GWP_AR6).join(", ") } });
          return;
        }
        result.lines.refrigerants.push({ id: uid(n), gas: item, leakedKg: amount, quality });
        return;
      }
      case "electricity": {
        const conn = col(r, "connection").toLowerCase() || "distribution";
        if (conn !== "transmission" && conn !== "distribution") {
          result.issues.push({ row: n, key: "badConnection", vars: { value: conn } });
          return;
        }
        const cert = parseNumber(col(r, "certified_mwh"));
        const sup = parseNumber(col(r, "supplier_factor"));
        result.lines.electricity.push({
          id: uid(n),
          label,
          mwh: amount,
          connection: conn,
          certifiedMwh: Number.isFinite(cert) ? Math.min(Math.max(0, cert), amount) : 0,
          supplierFactor: Number.isFinite(sup) && sup >= 0 ? sup : null,
          quality,
        });
        return;
      }
      case "scope3": {
        const cat = Number(item);
        const factor = parseNumber(col(r, "factor"));
        if (!Number.isInteger(cat) || cat < 1 || cat > 15) {
          result.issues.push({ row: n, key: "badCategory", vars: { value: item } });
          return;
        }
        if (!Number.isFinite(factor) || factor < 0) {
          result.issues.push({ row: n, key: "badFactor", vars: { value: col(r, "factor") } });
          return;
        }
        result.lines.scope3.push({ id: uid(n), category: cat, label, amount, unit: col(r, "unit") || "unit", factor, factorSource: col(r, "factor_source"), quality: q ? quality : "estimated" });
        return;
      }
      default:
        result.issues.push({ row: n, key: "badType", vars: { value: type } });
    }
  });
  return result;
}

/** Template with one example row per type; ";" so Turkish Excel opens it in columns. */
export function inventoryTemplateCsv(): string {
  const rows = [
    CSV_COLUMNS.join(";"),
    "fuel;Doğal gaz - kazan dairesi;natural_gas;1250000;Sm3;;;stationary;;;;;;measured",
    "fuel;Motorin - saha araçları;diesel;38000;L;;;mobile;;;;;;calculated",
    "process;Kireçtaşı kalsinasyonu;;9000;tCO2e;;;;;;;;;calculated",
    "refrigerant;Klima bakımı;R-410A;12;kg;;;;;;;;;estimated",
    "electricity;Ana tesis;;30000;MWh;;;;distribution;6000;;;;measured",
    "scope3;Satın alınan çelik;1;15000;t;;;;;;;1,9;Tedarikçi beyanı;estimated",
  ];
  return "﻿" + rows.join("\r\n");
}
