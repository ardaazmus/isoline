/** Client-side file exports: CSV tables, JSON state, SVG charts. Nothing leaves the browser. */

export function download(filename: string, content: BlobPart, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Semicolon-separated with BOM so Turkish Excel opens it with correct columns and characters. */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(";"));
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  download(filename, toCsv(header, rows), "text/csv;charset=utf-8");
}

export function downloadSvg(filename: string, svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  // Resolve CSS variables so the exported file renders outside the app.
  const styles = getComputedStyle(document.documentElement);
  const walk = (el: Element) => {
    for (const attr of ["fill", "stroke", "color"]) {
      const v = el.getAttribute(attr);
      if (v && v.includes("var(")) {
        const name = v.match(/var\((--[\w-]+)\)/)?.[1];
        if (name) el.setAttribute(attr, styles.getPropertyValue(name).trim() || "#000");
      }
    }
    Array.from(el.children).forEach(walk);
  };
  walk(clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("font-family", "Libre Franklin, Arial, sans-serif");
  download(filename, new XMLSerializer().serializeToString(clone), "image/svg+xml");
}

export function slug(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
