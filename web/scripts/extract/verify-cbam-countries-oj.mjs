// Cross-checks the workbook extract (cbam_defaults_countries.csv) against the legally valid text: the Official
// Journal HTML of Implementing Regulation (EU) 2026/1740, Annex I. For every country table, each CN/TARIC row
// must carry the same direct, indirect and total values and the same production route in both.
// Usage: node verify-cbam-countries-oj.mjs <oj.html> <countries.csv>
import fs from "node:fs";
import { parseCountriesCsv } from "./cbam-country-table.mjs";

const [htmlPath, csvPath] = process.argv.slice(2);
const html = fs.readFileSync(htmlPath, "utf8");
const NAMES = { TR: "Türkiye", CN: "China", IN: "India", UA: "Ukraine", EG: "Egypt", OTHER: "Other countries and territories" };
const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const norm = (s) => String(s).replace(/\s+/g, "").replace(/–|—/g, "-");

function ojTable(name) {
  const at = html.search(new RegExp(`<span class="oj-bold">\\s*${name}\\s*</span>`, "i"));
  if (at < 0) throw new Error("table not found: " + name);
  const end = html.indexOf("</table>", at);
  const rows = new Map();
  for (const tr of html.slice(at, end).match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
    const cells = (tr.match(/<td[\s\S]*?<\/td>/g) ?? []).map(decode);
    if (cells.length !== 6 || !/^\d{4}/.test(cells[0])) continue;
    rows.set(norm(cells[0]), cells.map(norm));
  }
  return rows;
}

const csv = parseCountriesCsv(fs.readFileSync(csvPath, "utf8"));
let total = 0, bad = 0;
for (const [code, name] of Object.entries(NAMES)) {
  const oj = ojTable(name);
  const mine = csv.filter((r) => r.country === code);
  let missing = 0, diffs = 0;
  for (const r of mine) {
    total++;
    const o = oj.get(norm(r.cn));
    if (!o) { missing++; bad++; if (missing <= 3) console.log("NOT IN OJ", code, r.cn); continue; }
    const want = [r.direct, r.indirect, r.total, r.route].map(norm);
    const got = [o[2], o[3], o[4], o[5]];
    if (JSON.stringify(want) !== JSON.stringify(got)) { diffs++; bad++; if (diffs <= 5) console.log("DIFF", code, r.cn, "xlsx", want.join(" "), "oj", got.join(" ")); }
  }
  console.log(code, "rows", mine.length, "oj rows", oj.size, "missing", missing, "differences", diffs);
}
console.log("checked", total, "problems", bad);
