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

// ETKB electricity factors, one edition per calculation year (values transcribed from the official forms and
// checked against their text; see docs/kaynak-veri/etkb/README.md). Decimal commas become numbers.
const et = parseCsv(fs.readFileSync(path.join(src, "etkb", "etkb_grid.csv"), "utf8"));
const th = et[0];
const tcol = (r, n) => r[th.indexOf(n)];
const dec = (s) => Number(String(s).replace(",", "."));
const editions = {};
for (const r of et.slice(1)) {
  const y = tcol(r, "year");
  editions[y] ??= { year: Number(y), published: tcol(r, "published"), revision: tcol(r, "revision"), file: tcol(r, "source_file"), factors: {} };
  editions[y].factors[tcol(r, "key")] = { tco2: dec(tcol(r, "tco2_per_mwh")), tco2e: dec(tcol(r, "tco2e_per_mwh")) };
}
fs.writeFileSync(path.join(outDir, "etkb-grid.json"), JSON.stringify({
  source: "T.C. Enerji ve Tabii Kaynaklar Bakanlığı (EVÇED) — Türkiye Elektrik Üretimi ve Elektrik Tüketim Noktası Emisyon Faktörleri Bilgi Formu (ETKB-EVÇED-FRM-042)",
  url: "https://enerji.gov.tr/evced-cevre-ve-iklim-elektrik-uretim-tuketim-emisyon-faktorleri",
  fetched: "2026-10-18",
  unit: "tCO2/MWh and tCO2e/MWh",
  editions: Object.values(editions),
}));
console.log("etkb editions", Object.keys(editions).join(", "));

// DESNZ 2026 scope 3 subset (OGL v3). Values stay in kg CO2e per unit here; the app divides by 1000.
const dz = parseCsv(fs.readFileSync(path.join(src, "desnz", "desnz_scope3.csv"), "utf8"));
const dh = dz[0];
const dcol = (r, n) => r[dh.indexOf(n)];
const drows = dz.slice(1).map((r) => [dcol(r, "id"), dcol(r, "group"), dcol(r, "activity"), dcol(r, "type"), dcol(r, "size_or_class"), dcol(r, "unit"), Number(dcol(r, "kg_co2e")), dcol(r, "sheet"), Number(dcol(r, "row"))]);
fs.writeFileSync(path.join(outDir, "desnz-2026.json"), JSON.stringify({
  source: "UK Department for Energy Security and Net Zero — Greenhouse gas reporting: conversion factors 2026, full set (published 2026-06-11)",
  url: "https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026",
  licence: "Open Government Licence v3.0 — contains public sector information licensed under the OGL v3.0",
  fetched: "2026-10-18",
  unit: "kg CO2e per unit (unit column as published)",
  columns: ["id", "group", "activity", "type", "sizeOrClass", "unit", "kgCo2e", "sheet", "row"],
  rows: drows,
}));

// Türkiye NID 2026 (TÜİK): 2024 NCVs (Annex 4 'NCV of Fuels') and 2024 CO2 EFs (Table 3.7). NCVs are converted
// to the app's fuel units: TJ/10^6 m3 -> GJ/m3 (x 1/1000), TJ/kt -> GJ/t (x 1), TJ/kt -> GJ/kg (x 1/1000).
// Diesel and gasoline NCVs are per mass while the app counts litres: only their EF is taken (no density assumed).
const tn = parseCsv(fs.readFileSync(path.join(src, "tuik", "tuik_ncv.csv"), "utf8"));
const te = parseCsv(fs.readFileSync(path.join(src, "tuik", "tuik_co2_ef.csv"), "utf8"));
const pick = (rows, fuel, tablePrefix) => {
  const h = rows[0];
  const r = rows.slice(1).find((x) => x[h.indexOf("fuel")] === fuel && x[h.indexOf("inventory_year")] === "2024" && x[h.indexOf("table_or_page")].startsWith(tablePrefix));
  if (!r) throw new Error("TÜİK row missing: " + fuel + " / " + tablePrefix);
  return Number(r[h.indexOf(rows === tn ? "ncv" : "ef")]);
};
const clean = (v) => Math.round(v * 1e9) / 1e9;
const TUIK = [
  ["natural_gas", "Natural gas", "Natural gas", "Sm3", 1 / 1000],
  ["coal", "Hard coal", "Hard coal", "t", 1],
  ["lignite", "Lignite", "Lignite", "t", 1],
  ["fuel_oil", "Fuel oil", "Fuel oil", "kg", 1 / 1000],
  ["lpg", "LPG", "LPG", "kg", 1 / 1000],
  ["diesel", null, "Diesel", "L", null],
  ["gasoline", null, "Gasoline", "L", null],
];
const trows = TUIK.map(([fuel, ncvName, efName, unit, k]) => [fuel, ncvName ?? efName, unit, ncvName ? clean(pick(tn, ncvName, "Annex 4") * k) : null, pick(te, efName, "Table 3.7")]);
fs.writeFileSync(path.join(outDir, "tuik-nir-2026.json"), JSON.stringify({
  source: "Greenhouse Gas Inventory of Türkiye 1990-2024, National Inventory Document (TÜİK, submitted to the UNFCCC 2026-04-14): Annex 4 'NCV of Fuels' (2024) and Table 3.7 'CO2 emission factors of fuels' (2024)",
  url: "https://unfccc.int/sites/default/files/resource/TUR_NID_2026.pdf",
  fetched: "2026-10-18",
  inventoryYear: 2024,
  columns: ["fuel", "nidFuel", "unit", "ncvGjPerUnit", "efTco2PerTj"],
  rows: trows,
}));
console.log("desnz rows", drows.length, "| tuik fuels", trows.length);

// CBAM benchmarks, Implementing Regulation (EU) 2025/2620 Annex point 5.3 (Column A: process benchmark BMg*,
// Column B: default benchmark BMg), and the production route of the default-value tables (2026/1740 workbook,
// column F) for Türkiye, falling back to 'Other Countries and Territories' where Türkiye shows "-".
const bm = parseCsv(fs.readFileSync(path.join(src, "cbam-bm", "cbam_benchmarks.csv"), "utf8"));
const bh = bm[0];
/** "0,666 (A) | 0,859 (B)" -> [[0.666, "A", null], [0.859, "B", null]]; "(F)(1)" -> route F, period 1. */
const entries = (cell) =>
  cell.split(" | ").map((part) => {
    const m = part.trim().match(/^([\d,]+)\s*((?:\([A-Z0-9]+\))*)$/);
    if (!m) throw new Error("benchmark cell: " + part);
    const inds = [...m[2].matchAll(/\(([A-Z0-9]+)\)/g)].map((x) => x[1]);
    return [Number(m[1].replace(",", ".")), inds.find((x) => /^[A-L]$/.test(x)) ?? null, Number(inds.find((x) => /^[12]$/.test(x)) ?? 0) || null];
  });
const bmRows = bm.slice(1).map((r) => [r[bh.indexOf("cn")].replace(/\s/g, ""), r[bh.indexOf("description")], entries(r[bh.indexOf("column_a")]), entries(r[bh.indexOf("column_b")])]);
const rt = parseCsv(fs.readFileSync(path.join(src, "cbam-bm", "cbam_routes.csv"), "utf8"));
const rh = rt[0];
const isNum = (v) => /^\d+(,\d+)?$/.test(String(v).trim());
const other = new Map(rt.slice(1).filter((r) => /Other/.test(r[rh.indexOf("sheet")])).map((r) => [r[rh.indexOf("cn")].replace(/\s/g, ""), r]));
const routes = [];
for (const r of rt.slice(1).filter((x) => /rkiye/.test(x[rh.indexOf("sheet")]))) {
  const cn = r[rh.indexOf("cn")].replace(/\s/g, "");
  if (isNum(r[rh.indexOf("total")])) routes.push([cn, r[rh.indexOf("route")].replace(/[()]/g, ""), 0]);
  else {
    const o = other.get(cn);
    if (o && isNum(o[rh.indexOf("total")])) routes.push([cn, o[rh.indexOf("route")].replace(/[()]/g, ""), 1]);
  }
}
fs.writeFileSync(path.join(outDir, "cbam-benchmarks.json"), JSON.stringify({
  source: "Commission Implementing Regulation (EU) 2025/2620, Annex point 5.3 'CBAM benchmark values' (OJ L, 22.12.2025); routes: default-value workbook (Implementing Regulation (EU) 2026/1740), column 'Underlying production route determining CBAM BM'",
  url: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32025R2620",
  licence: "© European Union, https://eur-lex.europa.eu — reuse authorised (Commission Decision 2011/833/EU)",
  fetched: "2026-10-18",
  unit: "tCO2e per tonne of good",
  columns: ["cn", "description", "columnA [value, route, period]", "columnB [value, route, period]"],
  rows: bmRows,
  routeColumns: ["cn", "route (letters joined by /)", "fromOtherCountries"],
  routesTR: routes,
}));
console.log("benchmarks", bmRows.length, "| TR routes", routes.length);
