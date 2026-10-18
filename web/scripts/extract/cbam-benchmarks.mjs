// Extracts point 5.3 "CBAM benchmark values" of Implementing Regulation (EU) 2025/2620 from the EUR-Lex HTML.
// Rows with 4 cells (CN code, description, Column A, Column B) are taken; sector heading rows set the sector.
// Each value cell may hold several <p> values, each "0,666 (A)" style: value plus indicators kept verbatim.
import fs from "node:fs";
const [htmlPath, outCsv] = process.argv.slice(2);
const h = fs.readFileSync(htmlPath, "utf8");
const start = h.indexOf("CBAM benchmark values");
if (start < 0) throw new Error("section not found");
const body = h.slice(start);
const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#160;/g, " ").replace(/\s+/g, " ").trim();
const rows = [];
let sector = "";
for (const tr of body.match(/<tr[\s\S]*?<\/tr>/g) ?? []) {
  const tds = tr.match(/<td[\s\S]*?<\/td>/g) ?? [];
  const cells = tds.map((td) => (td.match(/<p[\s\S]*?<\/p>/g) ?? [td]).map(decode).filter(Boolean));
  if (cells.length === 1 && cells[0].length === 1) {
    sector = cells[0][0];
    continue;
  }
  if (cells.length !== 4) continue;
  const [cn, desc, a, b] = cells;
  if (!cn.length || !/^\d/.test(cn[0])) continue; // header rows
  rows.push({ sector, cn: cn.join(" ").replace(/\s+/g, " ").trim(), desc: desc.join(" "), a: a.join(" | "), b: b.join(" | ") });
}
const esc = (v) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
fs.writeFileSync(outCsv, "﻿" + ["sector;cn;description;column_a;column_b", ...rows.map((r) => [r.sector, r.cn, r.desc, r.a, r.b].map(esc).join(";"))].join("\r\n") + "\r\n");
const bySector = rows.reduce((m, r) => ((m[r.sector] = (m[r.sector] ?? 0) + 1), m), {});
console.log("rows", rows.length, bySector);
const indicators = new Set(rows.flatMap((r) => [r.a, r.b]).flatMap((v) => [...v.matchAll(/\(([A-Z0-9]+)\)/g)].map((m) => m[1])));
console.log("indicators", [...indicators].sort().join(" "));
