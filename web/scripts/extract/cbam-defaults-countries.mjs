// Extracts country tables of the Commission's CBAM default-value workbook (Implementing Regulation (EU)
// 2026/1740, v2): every CN/TARIC row with its direct, indirect and total values and the production route
// (column F), copied verbatim with sheet and 1-based row. Usage: node cbam-defaults-countries.mjs <xlsx> <out.csv>
import fs from "node:fs";
import * as X from "xlsx";

X.set_fs(fs); // the ESM build needs file access handed over

export const SHEETS = { TR: "Türkiye", CN: "China", IN: "India", UA: "Ukraine", EG: "Egypt", OTHER: "_Other Countries and Territorie" };

const [xlsx, outCsv] = process.argv.slice(2);
const wb = X.readFile(xlsx);
const esc = (v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const out = ["country;sheet;row;cn;description;direct;indirect;total;route"];
for (const [code, name] of Object.entries(SHEETS)) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error("sheet missing: " + name);
  X.utils.sheet_to_json(ws, { header: 1, defval: "" }).forEach((r, i) => {
    const cn = String(r[0]).trim();
    if (!/^\d{4}/.test(cn)) return;
    out.push([code, name, String(i + 1), cn, String(r[1]).trim(), String(r[2]).trim(), String(r[3]).trim(), String(r[4]).trim(), String(r[5]).trim()].map(esc).join(";"));
  });
}
fs.writeFileSync(outCsv, "﻿" + out.join("\r\n") + "\r\n");
const counts = out.slice(1).reduce((m, l) => ((m[l.split(";")[0]] = (m[l.split(";")[0]] ?? 0) + 1), m), {});
console.log("rows", out.length - 1, counts);
