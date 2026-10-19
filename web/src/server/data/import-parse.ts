/**
 * Spreadsheet → observation rows (G3-05, plan 09 §2). Pure: finds the header row, maps columns (Turkish or English
 * headings), validates each row against the campaign's requests and the metric catalogue, and reports every
 * problem with its row and column. Nothing is written here; preview and commit happen in imports.ts.
 */
import { METRIC } from "./catalog";
import { dimensionOf, normalizeUnit, plainDecimal } from "./units";

export type Field = "metric" | "facility" | "line" | "value" | "unit" | "quality" | "note";
export type Mapping = Partial<Record<Field, number>>;

const HEADERS: Record<Field, string[]> = {
  metric: ["metric", "metrik", "kod", "code", "veri noktası", "data point"],
  facility: ["facility", "tesis", "site", "lokasyon"],
  line: ["line", "kalem", "yakıt", "fuel", "gaz", "gas", "alt kalem"],
  value: ["value", "değer", "deger", "miktar", "amount", "quantity"],
  unit: ["unit", "birim"],
  quality: ["quality", "kalite", "veri kalitesi", "yöntem", "method"],
  note: ["note", "not", "açıklama", "aciklama", "kaynak", "source"],
};

const norm = (s: string) => s.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");

/** The first row (of the first 20) that names at least the metric and value columns. */
export function detectMapping(grid: string[][]): { headerRow: number; mapping: Mapping } | null {
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const mapping: Mapping = {};
    grid[i].forEach((cell, j) => {
      const c = norm(cell ?? "");
      for (const [f, names] of Object.entries(HEADERS) as [Field, string[]][]) if (mapping[f] === undefined && names.includes(c)) mapping[f] = j;
    });
    if (mapping.metric !== undefined && mapping.value !== undefined) return { headerRow: i, mapping };
  }
  return null;
}

export type Target = { requestId: string; metricCode: string; facilityId: string | null; facilityName: string | null; status: string; reviewerUserId: string | null };

export type RowError = { row: number; column: Field | null; code: string };
export type ParsedRow = { row: number; requestId: string; metricCode: string; facilityId: string | null; line: string | null; value: string | null; unit: string | null; text: string | null; quality: "measured" | "calculated" | "estimated"; note: string | null; prevStatus: string };

const QUALITY: Record<string, ParsedRow["quality"]> = { measured: "measured", ölçüm: "measured", olcum: "measured", ölçülen: "measured", calculated: "calculated", hesap: "calculated", hesaplanan: "calculated", estimated: "estimated", tahmin: "estimated", tahmini: "estimated" };
const EDITABLE = ["assigned", "sent", "revision_required", "created"];

export function parseRows(grid: string[][], headerRow: number, mapping: Mapping, targets: Target[]): { rows: ParsedRow[]; errors: RowError[]; total: number } {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const byKey = new Map(targets.map((t) => [`${t.metricCode}|${norm(t.facilityName ?? "")}`, t]));
  const seen = new Set<string>();
  const cell = (r: string[], f: Field) => (mapping[f] === undefined ? "" : (r[mapping[f]!] ?? "").trim());
  let total = 0;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r || r.every((c) => !String(c ?? "").trim())) continue;
    total++;
    const rowNo = i + 1;
    const code = cell(r, "metric").toLowerCase();
    const m = METRIC.get(code);
    if (!m) {
      errors.push({ row: rowNo, column: "metric", code: "unknown_metric" });
      continue;
    }
    const facility = cell(r, "facility");
    const t = byKey.get(`${code}|${norm(facility)}`);
    if (!t) {
      errors.push({ row: rowNo, column: facility ? "facility" : "metric", code: facility ? "unknown_facility" : "no_request" });
      continue;
    }
    if (!EDITABLE.includes(t.status)) {
      errors.push({ row: rowNo, column: null, code: `request_${t.status}` });
      continue;
    }
    const line = m.multiline ? cell(r, "line").toLowerCase() || null : null;
    if (m.multiline && !line) {
      errors.push({ row: rowNo, column: "line", code: "line_required" });
      continue;
    }
    if (m.multiline && m.lineKeys.length && !m.lineKeys.includes(line!)) {
      errors.push({ row: rowNo, column: "line", code: "unknown_line" });
      continue;
    }
    const numeric = !m.dimensions.includes("none");
    const rawValue = cell(r, "value");
    let value: string | null = null;
    let unit: string | null = null;
    let text: string | null = null;
    if (numeric) {
      value = plainDecimal(rawValue);
      if (value === null) {
        errors.push({ row: rowNo, column: "value", code: "invalid_number" });
        continue;
      }
      unit = normalizeUnit(cell(r, "unit"));
      if (!unit) {
        errors.push({ row: rowNo, column: "unit", code: "unknown_unit" });
        continue;
      }
      if (!m.dimensions.includes(dimensionOf(unit)!)) {
        errors.push({ row: rowNo, column: "unit", code: "unit_not_allowed" });
        continue;
      }
      if (value.startsWith("-") && dimensionOf(unit) !== "money") {
        errors.push({ row: rowNo, column: "value", code: "negative_value" });
        continue;
      }
    } else {
      text = rawValue || null;
      if (!text) {
        errors.push({ row: rowNo, column: "value", code: "text_required" });
        continue;
      }
    }
    const q = QUALITY[norm(cell(r, "quality"))] ?? "measured";
    // the same request (and line) twice in one file: the second row is refused, not silently summed
    const dup = `${t.requestId}|${line ?? ""}`;
    if (seen.has(dup)) {
      errors.push({ row: rowNo, column: null, code: "duplicate_row" });
      continue;
    }
    seen.add(dup);
    rows.push({ row: rowNo, requestId: t.requestId, metricCode: code, facilityId: t.facilityId, line, value, unit, text, quality: q, note: cell(r, "note") || null, prevStatus: t.status });
  }
  return { rows, errors, total };
}
