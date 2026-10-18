import { describe, expect, it } from "vitest";
import { TEMPLATES } from "@/data/templates";
import { SAMPLE_CLIENT } from "@/data/sample";
import { makeFormatters } from "@/i18n/core";
import { buildContentIndex } from "./content-index";

const t = ((key: string) => key) as (key: string, vars?: Record<string, string | number>) => string;
const fmt = makeFormatters("tr");

describe("buildContentIndex", () => {
  it("emits one numbered row per section with refs and live figures", () => {
    const tp = TEMPLATES.find((x) => x.id === "tsrs_full")!;
    const rows = buildContentIndex(tp, SAMPLE_CLIENT, t, fmt);
    expect(rows).toHaveLength(tp.sections.length);
    expect(rows[0].section).toMatch(/^1\. /);
    expect(rows[0].refs).toContain("TSRS 1");
    const ghg = rows.find((r) => r.figures.includes("tCO₂e"));
    expect(ghg).toBeDefined();
  });

  it("marks sections without tools or data with an em dash", () => {
    const tp = TEMPLATES.find((x) => x.id === "tsrs_full")!;
    const rows = buildContentIndex(tp, SAMPLE_CLIENT, t, fmt);
    const gov = rows.find((r) => r.section.startsWith("2. "));
    expect(gov?.figures).toBe("—");
  });
});
