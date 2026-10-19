/** Shared helpers of the browser suite: the fixture written by scripts/e2e/prepare.ts, sessions and the axe gate. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { RunOptions } from "axe-core";
import { expect, type APIRequestContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { E2E_ORIGIN, FIXTURE_FILE } from "../scripts/e2e/env";

export type Persona = "ayse" | "mehmet" | "zeynep" | "can" | "deniz" | "elif" | "selin";
export type Fixture = {
  password: string;
  people: Record<Persona, string>;
  ids: {
    companyTenant: string;
    advisoryTenant: string;
    companyProject: string;
    cycleId: string;
    campaignId: string;
    scanTaskId: string;
    keyboardTaskId: string;
    reportId: string;
    factId: string;
    runId: string;
  };
};

let cached: Fixture | null = null;
export function fixture(): Fixture {
  cached ??= JSON.parse(readFileSync(FIXTURE_FILE, "utf8")) as Fixture;
  return cached;
}

/** Workspace each persona works in during the suite. */
export const WORKSPACE: Record<Persona, "companyTenant" | "advisoryTenant"> = {
  ayse: "companyTenant",
  mehmet: "companyTenant",
  zeynep: "companyTenant",
  elif: "companyTenant",
  selin: "companyTenant",
  can: "advisoryTenant",
  deniz: "advisoryTenant",
};

export const storageFile = (p: Persona) => join(FIXTURE_FILE, "..", `${p}.storage.json`);

/** Signs in through Better Auth and chooses the workspace, the way the browser does (same-origin requests). */
export async function signIn(request: APIRequestContext, p: Persona): Promise<void> {
  const f = fixture();
  const headers = { origin: E2E_ORIGIN };
  const r = await request.post("/api/auth/sign-in/email", { data: { email: f.people[p], password: f.password }, headers });
  expect(r.status(), `sign-in ${p}`).toBe(200);
  const t = await request.post("/api/v1/session/tenant", { data: { tenantId: f.ids[WORKSPACE[p]] }, headers });
  expect(t.status(), `workspace ${p}`).toBe(200);
}

/** WCAG 2.0/2.1/2.2 A and AA rules; best-practice rules are reported by axe but not part of the gate. */
export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Violation = { id: string; impact?: string | null; help: string; nodes: { target: unknown[]; failureSummary?: string }[] };
const line = (v: Violation) => `${v.impact ?? "?"} ${v.id}: ${v.help} — ${v.nodes.slice(0, 4).map((n) => n.target.join(" ")).join(" | ")}${v.nodes.length > 4 ? ` (+${v.nodes.length - 4})` : ""}`;

// body::before is a decorative grain (opacity 0.14) painted under the content layer: without ignorePseudo axe gives up
// on every text node ("pseudoContent"). ignoreLength also measures short strings such as a KPI figure "12".
// (per-check run options are supported by axe.run but missing from its RunOptions type)
const CONTRAST_OPTIONS = { checks: { "color-contrast": { options: { ignorePseudo: true, ignoreLength: true } } } } as unknown as RunOptions;

const axe = (page: Page, include?: string) => {
  const b = new AxeBuilder({ page }).options(CONTRAST_OPTIONS);
  return include ? b.include(include) : b;
};

/** Pixel analysis runs in the page: the browser decodes the PNG, no image library needed. */
type Rgb = [number, number, number];
const decodeInPage = `async (b64) => {
  const img = new Image();
  img.src = "data:image/png;base64," + b64;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  window.__px = { w: c.width, h: c.height, d: ctx.getImageData(0, 0, c.width, c.height).data };
}`;

/**
 * The darkest and lightest colours of the page ground (fixed body gradients) as painted at this viewport, measured
 * from a screenshot with the content hidden. Text sits on translucent glass over this ground; axe cannot compose a
 * gradient ("bgGradient"), so the contrast pass is repeated with each extreme as a solid ground.
 */
async function groundExtremes(page: Page): Promise<{ dark: Rgb; light: Rgb }> {
  const hide = await page.addStyleTag({ content: "body > * { visibility: hidden !important; } body::before { display: none !important; }" });
  const png = await page.screenshot({ animations: "disabled" });
  await hide.evaluate((el) => (el as Element).remove());
  await page.evaluate(`(${decodeInPage})(${JSON.stringify(png.toString("base64"))})`);
  return page.evaluate(() => {
    const { d } = (window as unknown as { __px: { d: Uint8ClampedArray } }).__px;
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    let dark: [number, number, number, number] = [2, 0, 0, 0];
    let light: [number, number, number, number] = [-1, 0, 0, 0];
    for (let i = 0; i < d.length; i += 4 * 5) {
      const l = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]);
      if (l < dark[0]) dark = [l, d[i], d[i + 1], d[i + 2]];
      if (l > light[0]) light = [l, d[i], d[i + 1], d[i + 2]];
    }
    return { dark: dark.slice(1) as Rgb, light: light.slice(1) as Rgb };
  });
}

/**
 * Contrast of SVG text (site map labels, Sankey labels) measured on pixels: axe skips text inside graphics
 * ("imgNode"). The text is hidden, the page is captured, and every text box is compared with what is painted behind
 * it; the 10th-percentile pixel must reach 4.5:1 (3:1 for large text).
 */
async function svgTextContrast(page: Page): Promise<string[]> {
  const items = await page.evaluate(() => {
    const out: { text: string; fill: string; alpha: number; large: boolean; box: [number, number, number, number] }[] = [];
    for (const el of document.querySelectorAll<SVGTextContentElement>("svg text, svg tspan")) {
      if (![...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim())) continue;
      const s = getComputedStyle(el);
      if (s.visibility === "hidden" || s.display === "none" || !s.fill.startsWith("rgb")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const size = parseFloat(s.fontSize);
      const bold = Number(s.fontWeight) >= 700;
      out.push({ text: (el.textContent ?? "").trim().slice(0, 40), fill: s.fill, alpha: Number(s.fillOpacity) * Number(s.opacity), large: size >= 24 || (bold && size >= 18.66), box: [r.left + scrollX, r.top + scrollY, r.width, r.height] });
    }
    return out;
  });
  if (!items.length) return [];
  const hide = await page.addStyleTag({ content: "svg text, svg tspan { fill: transparent !important; }" });
  const png = await page.screenshot({ fullPage: true, animations: "disabled" });
  await hide.evaluate((el) => (el as Element).remove());
  await page.evaluate(`(${decodeInPage})(${JSON.stringify(png.toString("base64"))})`);
  return page.evaluate((list) => {
    const { w, h, d } = (window as unknown as { __px: { w: number; h: number; d: Uint8ClampedArray } }).__px;
    const scale = w / document.documentElement.scrollWidth;
    const lin = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const lum = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const fails: string[] = [];
    for (const it of list) {
      const [fr, fg, fb] = it.fill.match(/\d+(\.\d+)?/g)!.map(Number);
      const ratios: number[] = [];
      const [x0, y0, bw, bh] = it.box.map((v) => Math.round(v * scale));
      for (let y = Math.max(0, y0); y < Math.min(h, y0 + bh); y++)
        for (let x = Math.max(0, x0); x < Math.min(w, x0 + bw); x++) {
          const i = (y * w + x) * 4;
          // the text colour as painted: fill blended over this background pixel
          const t = [fr, fg, fb].map((c, k) => c * it.alpha + d[i + k] * (1 - it.alpha));
          const a = lum(t[0], t[1], t[2]);
          const b = lum(d[i], d[i + 1], d[i + 2]);
          ratios.push((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
        }
      if (!ratios.length) continue;
      ratios.sort((p, q) => p - q);
      const p10 = ratios[Math.floor(ratios.length * 0.1)];
      const need = it.large ? 3 : 4.5;
      if (p10 < need) fails.push(`serious svg-text-contrast: "${it.text}" ${p10.toFixed(2)}:1 < ${need}:1 (fill ${it.fill})`);
    }
    return fails;
  }, items);
}

/**
 * The accessibility gate of a screen, failing on any finding (every impact level: the screens are expected to be
 * clean, not merely free of critical and serious findings):
 *   1. axe with the WCAG 2.0–2.2 A/AA rules, as rendered;
 *   2. axe colour contrast again on the darkest and on the lightest solid ground (see groundExtremes);
 *   3. SVG text contrast on pixels (svgTextContrast).
 * The axe results are attached to the Playwright report.
 */
export async function expectAccessible(page: Page, info: TestInfo, label: string, opts: { include?: string } = {}) {
  const r = await axe(page, opts.include).withTags(WCAG_TAGS).analyze();
  const found = r.violations.map(line);
  const ground = await groundExtremes(page);
  const groundPasses: Record<string, unknown> = {};
  for (const [name, rgb] of Object.entries(ground)) {
    // a select's chevron is a gradient at the right edge, not behind its text: removed so axe measures the text
    const solid = await page.addStyleTag({ content: `body { background: rgb(${rgb.join(",")}) !important; } body::before { display: none !important; } select { background-image: none !important; }` });
    const c = await axe(page, opts.include).withRules(["color-contrast"]).analyze();
    await solid.evaluate((el) => (el as Element).remove());
    groundPasses[name] = { violations: c.violations, measured: c.passes.reduce((n, p) => n + p.nodes.length, 0) + c.violations.reduce((n, v) => n + v.nodes.length, 0), incomplete: c.incomplete.flatMap((i) => i.nodes.map((n) => ({ target: n.target, why: n.any.map((x) => (x.data as { messageKey?: string } | null)?.messageKey ?? x.message) }))) };
    found.push(...c.violations.map((v) => `${line(v)} [${name} ground rgb(${rgb.join(",")})]`));
  }
  found.push(...(await svgTextContrast(page)));
  await info.attach(`axe-${label}.json`, {
    body: JSON.stringify({ url: r.url, ground, violations: r.violations, groundPasses, incomplete: r.incomplete.map((i) => ({ id: i.id, nodes: i.nodes.map((n) => ({ target: n.target, why: [...n.any, ...n.all, ...n.none].map((c) => (c.data as { messageKey?: string } | null)?.messageKey ?? c.message) })) })) }, null, 2),
    contentType: "application/json",
  });
  info.annotations.push({ type: "axe", description: `${label}: ${r.passes.length} rules passed, ${found.length} findings, ${r.incomplete.length} rules need review` });
  expect(found, `WCAG 2.2 AA on ${label}`).toEqual([]);
}

/**
 * Presses Tab until `target` has focus (fails after `max` presses): the element is reachable in tab order.
 * Returns the number of presses, which the keyboard spec records for the documentation.
 */
export async function tabTo(page: Page, target: Locator, max = 60, key: "Tab" | "Shift+Tab" = "Tab"): Promise<number> {
  const handle = await target.elementHandle();
  if (!handle) throw new Error("tabTo: target not in the page");
  for (let i = 0; i < max; i++) {
    if (await handle.evaluate((el) => el === document.activeElement)) return i;
    await page.keyboard.press(key);
  }
  if (await handle.evaluate((el) => el === document.activeElement)) return max;
  throw new Error(`tabTo: not reached with ${max} × ${key}`);
}

/** The element that has focus is visibly marked (WCAG 2.4.7): an outline or a box shadow ring. */
export async function expectVisibleFocus(page: Page): Promise<void> {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return "no focus";
    const s = getComputedStyle(el);
    const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
    return outline || (s.boxShadow && s.boxShadow !== "none") ? "ok" : `no focus indicator on ${el.tagName.toLowerCase()}`;
  });
  expect(ring).toBe("ok");
}
