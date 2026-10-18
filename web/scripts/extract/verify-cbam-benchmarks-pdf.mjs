// Cross-checks the benchmark table extracted from the EUR-Lex HTML against the OJ PDF text (pdftotext -raw):
// for each CN code, the sequence of "value (indicators)" tokens between that code and the next code in the PDF
// must equal Column A followed by Column B of the CSV.
import fs from "node:fs";
const [csvPath, pdfTxt] = process.argv.slice(2);
const csv = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/).slice(1);
const parseLine = (l) => {
  const cells = [];
  let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; continue; }
    if (c === '"') q = true; else if (c === ";") { cells.push(cur); cur = ""; } else cur += c;
  }
  cells.push(cur);
  return cells;
};
const text = fs.readFileSync(pdfTxt, "utf8");
const start = text.indexOf("5.3.");
const body = text.slice(start).replace(/[ \t]+/g, " ");
// Positions of every benchmark CN code in the PDF section (8 digits as "nnnn nn nn"). Codes open a line;
// references to other codes inside a description ("subheading 7224 90 05") do not.
const codeRe = /^(\d{4} \d{2} \d{2})(?= )/gm;
const positions = [];
for (let m; (m = codeRe.exec(body)); ) positions.push([m[1], m.index]);
// A value has exactly three decimals: "0,0008 %" in a description is not a value.
const tokenRe = /(?<![\d,])(\d+,\d{3})(?!\d|\s?(?:mm|%|kg))((?:\s?\([A-Z0-9]\))*)/g;
let bad = 0, checked = 0;
for (const line of csv) {
  const [, cn, , a, b] = parseLine(line);
  const want = [...a.split(" | "), ...b.split(" | ")].map((s) => s.replace(/\s+/g, ""));
  const idx = positions.findIndex(([c]) => c === cn);
  if (idx < 0) { bad++; console.log("NOT IN PDF", cn); continue; }
  const seg = body.slice(positions[idx][1] + cn.length, positions[idx + 1]?.[1] ?? body.length);
  const got = [...seg.matchAll(tokenRe)].map((m) => (m[1] + m[2]).replace(/\s+/g, ""));
  checked++;
  if (JSON.stringify(got.slice(0, want.length)) !== JSON.stringify(want) || got.length < want.length) {
    bad++;
    if (bad <= 10) console.log("DIFF", cn, "csv", want.join(" "), "pdf", got.join(" "));
  }
}
console.log("rows", csv.length, "checked", checked, "differences", bad);
