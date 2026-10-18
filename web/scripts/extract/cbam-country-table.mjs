// Builds the default-value table that applies to goods from one country of origin (Implementing Regulation
// (EU) 2026/1740, Annex I): the country's own rows where they carry a value; where the country shows "-", gives
// no value or does not list the code, the 'Other Countries and Territories' row ("Where a country or territory
// is explicitly listed but no value is provided or the relevant field shows '–', the default value … from the
// table 'Other countries and territories' needs to be selected"). Rows without a value in either are left out.

const num = (v) => (/^\d+(,\d+)?$/.test(String(v).trim()) ? Number(String(v).trim().replace(",", ".")) : null);
const key = (cn) => String(cn).replace(/\s/g, "");

/**
 * rows: objects with country, row, cn, description, direct, indirect, total, route (strings, as extracted).
 * Returns [cn, description, direct, indirect, total, fallbackOtherCountries (0|1), xlsxRow, route].
 */
export function deriveTable(rows, country) {
  const other = rows.filter((r) => r.country === "OTHER");
  const own = rows.filter((r) => r.country === country);
  const otherBy = new Map(other.map((r) => [key(r.cn), r]));
  const out = [];
  const seen = new Set();
  const push = (r, fallback) => {
    out.push([key(r.cn), r.description, num(r.direct), num(r.indirect), num(r.total), fallback ? 1 : 0, r.row, r.route.replace(/[()]/g, "")]);
  };
  for (const r of own) {
    seen.add(key(r.cn));
    if (num(r.total) !== null) push(r, false);
    else if (country !== "OTHER") {
      const o = otherBy.get(key(r.cn));
      if (o && num(o.total) !== null) push(o, true);
    }
  }
  if (country !== "OTHER") for (const o of other) if (!seen.has(key(o.cn)) && num(o.total) !== null) push(o, true);
  return out;
}

/** Parses the semicolon CSV written by cbam-defaults-countries.mjs into row objects. */
export function parseCountriesCsv(text) {
  const lines = [];
  let row = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
      continue;
    }
    if (c === '"') q = true;
    else if (c === ";") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); lines.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); lines.push(row); }
  const [head, ...rest] = lines.filter((l) => l.some((x) => x.trim()));
  return rest.map((l) => Object.fromEntries(head.map((h, i) => [h, l[i] ?? ""])));
}
