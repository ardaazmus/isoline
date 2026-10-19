/** G6: section markup and tokens, one number format for every output, the hand-off ZIP. */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parse, prose, render, tokens } from "./body";
import { barChartSvg, csv, formatValue, withUnit } from "./render";
import { crc32, unzipStored, zip } from "./zip";

describe("section markup", () => {
  const body = "# İklim\n\nKapsam 1 emisyonumuz {{ghg.scope1}} oldu; operasyonel kontrolle {{ghg.scope2.location|ghg_operational_control}}.\n\n- ilk madde\n- ikinci\n\n[[table:ghg]]\n[[chart:ghg_scopes]]\n> Kaynak: ETKB 2023";
  it("parses headings, paragraphs, bullets, directives and source notes", () => {
    expect(parse(body).map((b) => b.type)).toEqual(["h1", "p", "ul", "table", "chart", "source"]);
  });

  it("lists each token once with its boundary", () => {
    expect(tokens(body + " {{ghg.scope1}}").map((t) => [t.key, t.boundary])).toEqual([
      ["ghg.scope1", null],
      ["ghg.scope2.location", "ghg_operational_control"],
    ]);
  });

  it("renders bound tokens and leaves unbound ones visibly open", () => {
    const out = render("A {{ghg.scope1}} B {{env.waste_t}}", new Map([["{{ghg.scope1}}", "3.660 tCO₂e"]]));
    expect(out).toBe("A 3.660 tCO₂e B [? env.waste_t]");
  });

  it("prose drops tokens and directives (what the claim screen reads)", () => {
    expect(prose(body)).not.toMatch(/\{\{|\[\[/);
    expect(prose(body)).toContain("ilk madde");
  });

  it("property: parsing never loses a token", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("metin", "{{ghg.scope1}}", "\n", "\n\n", "- ", "# ", "{{env.energy_gj}}"), { maxLength: 30 }), (parts) => {
        const b = parts.join("");
        const kept = parse(b)
          .flatMap((x) => (x.type === "ul" ? x.items : "text" in x ? [x.text] : []))
          .join(" ");
        expect(tokens(kept).map((t) => t.raw).sort()).toEqual(tokens(b).map((t) => t.raw).sort());
      }),
    );
  });
});

describe("one number format for every output", () => {
  it("Turkish and English grouping and decimals", () => {
    expect(formatValue("tr", { value: "3660.123", text: null, unit: "tCO2e" })).toBe("3.660");
    expect(formatValue("en", { value: "3660.123", text: null, unit: "tCO2e" })).toBe("3,660");
    expect(formatValue("tr", { value: "967.0989", text: null, unit: "tCO2e" })).toBe("967,1");
    expect(formatValue("tr", { value: "1382500000.00", text: null, unit: "TRY" })).toBe("1.382.500.000,00");
    expect(formatValue("en", { value: "0.25", text: null, unit: "ratio" })).toBe("25%");
    expect(formatValue("tr", { value: "0.25", text: null, unit: "ratio", suppressed: true })).toBe("gizli (küçük grup)");
  });

  it("the chart and the CSV print exactly the text the document prints", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e9, noNaN: true }), fc.constantFrom("tr", "en"), (v, lang) => {
        const fact = { metricKey: "ghg.scope1", value: String(v), text: null, unit: "tCO2e" };
        const shown = withUnit(lang, fact);
        expect(barChartSvg(lang, "t", [{ label: "Kapsam 1", fact }])).toContain(shown.replace(/&/g, "&amp;"));
        expect(csv(lang, ["v"], [[shown]])).toContain(shown);
      }),
    );
  });

  it("CSV guards formula injection and quotes separators", () => {
    const out = csv("tr", ["a", "b"], [["=HYPERLINK(1)", "x;y"]]);
    expect(out).toContain("'=HYPERLINK(1)");
    expect(out).toContain('"x;y"');
    expect(out.startsWith("﻿")).toBe(true);
  });
});

describe("hand-off ZIP", () => {
  it("round-trips entries with valid CRC-32", () => {
    const files = [
      { path: "content.docx", data: new Uint8Array([1, 2, 3]) },
      { path: "charts/ghg_scopes.svg", data: new TextEncoder().encode("<svg/>") },
      { path: "asset-manifest.json", data: new TextEncoder().encode('{"ok":true}') },
    ];
    const back = unzipStored(zip(files));
    expect(back.map((f) => [f.path, f.crcOk, f.data.length])).toEqual(files.map((f) => [f.path, true, f.data.length]));
  });

  it("CRC-32 of a known value", () => {
    expect(crc32(new TextEncoder().encode("123456789")).toString(16)).toBe("cbf43926");
  });
});
