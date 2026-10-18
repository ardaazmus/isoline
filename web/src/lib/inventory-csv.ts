/**
 * Bulk import of GHG inventory lines from CSV (Excel "CSV UTF-8" or Turkish Excel ";" exports).
 * One row per line; the `type` column decides how the row is read:
 *   fuel        item = fuel id, amount in the fuel's unit, optional ncv/ef override, use = stationary|mobile,
 *               optional ch4/n2o in kg/TJ (empty = IPCC 2006 default for the fuel and use)
 *   process     amount = tCO₂e
 *   refrigerant item = gas (e.g. R-410A), amount = kg leaked
 *   electricity amount = MWh, connection = transmission|distribution, certified_mwh, optional supplier_factor
 *   scope3      item = category 1–15, amount, unit, factor (tCO₂e per unit), factor_source
 */
import { defaultNonCo2, FUELS, GWP_AR6, type FuelId, type Inventory, type Quality } from "./calc/ghg";

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
  "ch4",
  "n2o",
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
  return importInventoryRows(parseCsv(text));
}

/** Inventory lines from a grid of cells (a CSV file or a spreadsheet sheet); the header may sit below title rows. */
export function importInventoryRows(rows: string[][]): ImportResult {
  const result: ImportResult = { lines: { fuels: [], process: [], refrigerants: [], electricity: [], scope3: [] }, issues: [], rows: 0 };
  if (rows.length === 0) {
    result.issues.push({ row: 0, key: "empty" });
    return result;
  }
  const h = Math.max(
    0,
    rows.slice(0, 10).findIndex((r) => {
      const hs = r.map((c) => c.trim().toLowerCase());
      return hs.includes("type") && hs.includes("amount");
    }),
  );
  const header = rows[h].map((c) => c.trim().toLowerCase());
  const missing = ["type", "amount"].filter((c) => !header.includes(c));
  if (missing.length) {
    result.issues.push({ row: h + 1, key: "missingColumns", vars: { cols: missing.join(", ") } });
    return result;
  }
  const col = (r: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (r[i] ?? "").trim() : "";
  };
  rows.slice(h + 1).forEach((r, idx) => {
    const n = h + idx + 2; // spreadsheet row number
    if (!r.some((c) => c.trim())) return;
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
        const mobile = col(r, "use").toLowerCase() === "mobile";
        const d = defaultNonCo2(f.id, mobile);
        // ch4/n2o: empty → default; a number ≥ 0 (0 included) → that value; anything else → issue
        const gas = (name: "ch4" | "n2o", fallback: number) => {
          const s = col(r, name);
          if (s === "") return fallback;
          const v = parseNumber(s);
          return Number.isFinite(v) && v >= 0 ? v : null;
        };
        const ch4 = gas("ch4", d.ch4);
        const n2o = gas("n2o", d.n2o);
        if (ch4 === null || n2o === null) {
          result.issues.push({ row: n, key: "badGasFactor", vars: { value: ch4 === null ? col(r, "ch4") : col(r, "n2o") } });
          return;
        }
        result.lines.fuels.push({
          id: uid(n),
          fuel: f.id,
          label: label || item,
          amount,
          ncv: Number.isFinite(ncv) && ncv > 0 ? ncv : f.ncv,
          ef: Number.isFinite(ef) && ef > 0 ? ef : f.ef,
          ch4,
          n2o,
          mobile,
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

/** Header and one example row per type; shared by the CSV and Excel templates. */
export const INVENTORY_TEMPLATE_ROWS: string[][] = [
  [...CSV_COLUMNS],
  "fuel;Doğal gaz - kazan dairesi;natural_gas;1250000;Sm3;;;stationary;;;;;;measured;;".split(";"),
  "fuel;Motorin - saha araçları;diesel;38000;L;;;mobile;;;;;;calculated;;".split(";"),
  "process;Kireçtaşı kalsinasyonu;;9000;tCO2e;;;;;;;;;calculated;;".split(";"),
  "refrigerant;Klima bakımı;R-410A;12;kg;;;;;;;;;estimated;;".split(";"),
  "electricity;Ana tesis;;30000;MWh;;;;distribution;6000;;;;measured;;".split(";"),
  "scope3;Satın alınan çelik;1;15000;t;;;;;;;1,9;Tedarikçi beyanı;estimated;;".split(";"),
];

/** Template with one example row per type; ";" so Turkish Excel opens it in columns. */
export function inventoryTemplateCsv(): string {
  return "﻿" + INVENTORY_TEMPLATE_ROWS.map((r) => r.join(";")).join("\r\n");
}
