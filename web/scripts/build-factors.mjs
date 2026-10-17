/**
 * Builds the official factor sets the app ships (src/data/factors/*.json) from the verified CSV extracts in
 * docs/kaynak-veri. Values are copied, never recalculated; EEA values stay in gCO2e/kWh here and are converted
 * to tCO2e/MWh in src/lib/factors.ts. Run: npm run factors (from web/).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../docs/kaynak-veri");
const outDir = path.resolve(here, "../src/data/factors");
const parseCsv = (t) => {
  const rows = []; let row = [], cell = "", q = false;
  t = t.replace(/^\uFEFF/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true; else if (c === ";") { row.push(cell); cell = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
};
const num = (s) => (/^\d+(,\d+)?$/.test(s.trim()) ? Number(s.trim().replace(",", ".")) : null);

const cb = parseCsv(fs.readFileSync(path.join(src, "cbam_defaults_TR.csv"), "utf8"));
const h = cb[0];
const ix = (n) => h.indexOf(n);
const rows = [];
for (const r of cb.slice(1)) {
  const total = num(r[ix("total")]);
  if (total === null) continue; // "see below" headings and "-" rows carry no value
  const fallback = r[ix("sheet_or_annex")].startsWith("FALLBACK");
  rows.push([r[ix("cn_code")].replace(/\s/g, ""), r[ix("description")], num(r[ix("direct")]), num(r[ix("indirect")]), total, fallback ? 1 : 0, r[ix("row_ref")].replace("xlsx row ", "")]);
}
fs.writeFileSync(path.join(outDir, "eu-cbam-defaults-tr.json"), JSON.stringify({
  source: "European Commission — CBAM default values, Implementing Regulation (EU) 2026/1740 correcting (EU) 2025/2621, Annex I, tables 'Türkiye' and 'Other Countries and Territories' (Excel 'DV correcting act_final update_06.08.xlsx', v2 2026-08-06)",
  url: "https://taxation-customs.ec.europa.eu/document/download/1c05d211-80cb-4aaa-8ef0-e08005a95d7e_en?filename=DV%20correcting%20act_final%20update_06.08.xlsx",
  legal: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=OJ:L_202601740",
  licence: "CC BY 4.0 (Commission Decision 2011/833/EU) — © European Union",
  fetched: "2026-10-17",
  unit: "tCO2e per tonne of good",
  columns: ["cn", "description", "direct", "indirect", "total", "fallbackOtherCountries", "xlsxRow"],
  rows,
}));

const ee = parseCsv(fs.readFileSync(path.join(src, "eea_grid_intensity.csv"), "utf8"));
const eh = ee[0];
const erows = ee.slice(1).map((r) => [r[eh.indexOf("country_code")], r[eh.indexOf("country")], Number(r[eh.indexOf("year")]), Number(r[eh.indexOf("g_co2e_per_kwh")])]);
fs.writeFileSync(path.join(outDir, "eea-grid-intensity.json"), JSON.stringify({
  source: "European Environment Agency — indicator ENER038 'Greenhouse gas emission intensity of electricity generation in Europe', published 2026-07-10; figure 2 (country level), figure 1 (EU-27); 2024 = EEA early estimate",
  url: "https://www.eea.europa.eu/en/analysis/indicators/greenhouse-gas-emission-intensity-of-1",
  licence: "CC BY 4.0 — source: European Environment Agency",
  fetched: "2026-10-17",
  unit: "gCO2e/kWh (generation intensity; imports and exports not counted)",
  columns: ["code", "country", "year", "gPerKwh"],
  rows: erows,
}));
console.log("cbam rows", rows.length, "fallback", rows.filter((r) => r[5]).length, "| eea rows", erows.length);
