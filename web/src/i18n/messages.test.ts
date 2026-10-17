import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { interpolate } from "./core";

const dir = join(__dirname, "..", "..", "messages");
const load = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8"));

function flatten(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") out.set(key, v);
      else flatten(v, key).forEach((val, kk) => out.set(kk, val));
    }
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("message files", () => {
  const base = flatten(load("tr.json"));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "tr.json")) {
    it(`${file} has the same keys and placeholders as tr.json`, () => {
      const other = flatten(load(file));
      const missing = [...base.keys()].filter((k) => !other.has(k) && !k.startsWith("_meta"));
      const extra = [...other.keys()].filter((k) => !base.has(k) && !k.startsWith("_meta"));
      expect(missing, "missing keys").toEqual([]);
      expect(extra, "extra keys").toEqual([]);
      for (const [k, v] of base) {
        if (other.has(k)) expect(placeholders(other.get(k)!), k).toBe(placeholders(v));
      }
    });
  }

  it("interpolates named placeholders and leaves unknown ones", () => {
    expect(interpolate("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});

describe("keys used by the code exist in tr.json", () => {
  const base = flatten(load("tr.json"));
  const has = (k: string) => base.has(k);

  it("static t(\"…\") keys in src", () => {
    const walk = (d: string): string[] =>
      readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith(".tsx") || e.name.endsWith(".ts") ? [join(d, e.name)] : []));
    const keys = new Set<string>();
    for (const f of walk(join(__dirname, ".."))) {
      if (f.endsWith(".test.ts")) continue;
      for (const m of readFileSync(f, "utf8").matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g)) keys.add(m[1]);
    }
    const missing = [...keys].filter((k) => !has(k));
    expect(missing).toEqual([]);
  });

  it("data-driven keys", async () => {
    const { TEMPLATES } = await import("@/data/templates");
    const { JOURNEYS } = await import("@/data/journey");
    const { AR_ITEMS, AR_GROUPS } = await import("@/data/annual-report");
    const { EVENTS, LANES } = await import("@/data/regulations");
    const { CROSSWALK } = await import("@/data/crosswalk");
    const { NAV } = await import("@/data/nav");
    const { evaluate } = await import("@/lib/calc/applicability");
    const { SAMPLE_CLIENT, emptyClient } = await import("@/data/sample");
    const need: string[] = [];
    TEMPLATES.forEach((tp) => {
      need.push(`tpl.${tp.id}.title`, `tpl.${tp.id}.summary`, `tpl.kinds.${tp.kind}`, `tpl.status.${tp.status}`);
      tp.sections.forEach((s) => need.push(`tpl.${tp.id}.sections.${s.id}.title`, `tpl.${tp.id}.sections.${s.id}.guide`));
    });
    Object.entries(JOURNEYS).forEach(([tr, stages]) => stages.forEach((s) => ["title", "what", "tasks", "outputs"].forEach((f) => need.push(`journey.${tr}.${s.id}.${f}`))));
    AR_ITEMS.forEach((i) => need.push(`ar.items.${i.id}`, `ar.hints.${i.id}`));
    AR_GROUPS.forEach((g) => need.push(`ar.groups.${g}`));
    EVENTS.forEach((e) => need.push(`reg.events.${e.id}`));
    LANES.forEach((l) => need.push(`reg.lanes.${l.id}`));
    CROSSWALK.forEach((r) => need.push(`cw.rows.${r.id}`));
    NAV.forEach((g) => {
      need.push(`nav.group.${g.id}`);
      g.items.forEach((i) => need.push(`nav.${i.id}`));
    });
    for (const c of [SAMPLE_CLIENT, emptyClient("x", "x")]) {
      for (const f of evaluate(c.profile)) {
        need.push(`app.reg.${f.id}`, `app.status.${f.status}`);
        f.notes.forEach((n) => need.push(`app.notes.${n}`));
        f.dates.forEach((d) => need.push(`dates.${d.key}`));
      }
      c.materiality.topics.forEach((t) => need.push(`mat.topics.${t.id}`));
    }
    expect(need.filter((k) => !has(k))).toEqual([]);
  });
});
