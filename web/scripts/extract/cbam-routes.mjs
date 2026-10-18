// Extracts column F "Underlying production route determining CBAM BM" of the Commission's default-value
// workbook (2026/1740, v2) for the Türkiye sheet, and for the 'Other Countries and Territories' sheet (used
// where Türkiye shows "-"). Values are copied verbatim with their sheet and 1-based row.
import fs from "node:fs";
import * as X from "xlsx";

X.set_fs(fs); // the ESM build needs file access handed over
const [xlsx, outCsv] = process.argv.slice(2);
const wb = X.readFile(xlsx);
const out = ["sheet;row;cn;route;total"];
for (const name of wb.SheetNames.filter((n) => /rkiye|Other Countries/.test(n))) {
  const g = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  g.forEach((r, i) => {
    const cn = String(r[0]).trim();
    if (!/^\d{4}/.test(cn)) return;
    out.push([name, i + 1, cn, String(r[5]).trim(), String(r[4]).trim()].join(";"));
  });
}
fs.writeFileSync(outCsv, "\uFEFF" + out.join("\r\n") + "\r\n");
const routes = out.slice(1).map((l) => l.split(";")[3]);
console.log("rows", out.length - 1, "distinct routes", [...new Set(routes)].join(" | "));
