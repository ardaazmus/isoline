/**
 * Reconciliation engine v1: cross-checks between the tools of one client, so that one fact is not reported
 * differently in two places (finance ↔ ESG, facility ↔ company, this year ↔ last year). The rules follow the
 * catalogue in docs/HEDEF_MIMARI.md §4.2. U6 reads taxonomy aligned CapEx against pathway measures, U7 the
 * annual-report investments item against energy/emission movement.
 *
 * Every check is a record: the values compared, the tolerance, a status and the user's explanation. A warning
 * with an explanation counts as explained; an error stays an error until the data is corrected, because an
 * explanation cannot make a physical contradiction (exports above production) true.
 */
import type { ClientData } from "@/data/sample";
import { computeInventory } from "./calc/ghg";
import { safetyRates } from "./calc/indicators";
import { countByRule, screenClaims } from "./claims";
import { netSales } from "./trial-balance";

export const ENGINE_VERSION = "reconcile-v1";

export type RuleId = "U1" | "U2" | "U3" | "U4" | "U5" | "U6" | "U7" | "U8" | "U9" | "U10";
export type Severity = "error" | "warning";
export type CheckStatus = "pass" | "explained" | "warn" | "fail" | "na";

/** Where a compared value comes from; the UI turns it into a label. */
export type Src =
  | "tbSales"
  | "anchorSales"
  | "anchorHeadcount"
  | "ghgRevenue"
  | "envRevenue"
  | "taxTurnover"
  | "envEnergy"
  | "invEnergy"
  | "envRenewable"
  | "invRenewable"
  | "profileToe"
  | "envToe"
  | "hrEnd"
  | "hrStart"
  | "profileEmployeesY1"
  | "profileEmployeesGroup"
  | "cbamExports"
  | "profileEuExports"
  | "ghgProduction"
  | "etsActivity"
  | "etsEmissions"
  | "ghgScope1"
  | "profileEmissions"
  | "estimated12"
  | "estimated3"
  | "alignedCapex"
  | "energyChange"
  | "scope1Change"
  | "threshold"
  | "current"
  | "prior"
  | "claimsHigh"
  | "claimsOther"
  | "claimsText";

export type Unit = "mTry" | "gj" | "toe" | "people" | "t" | "tco2e" | "share" | "m3" | "rate" | "count";
/** How a is compared with b: equal within tolerance, at most, at least, year-over-year change, or a count of findings. */
export type Relation = "eq" | "lte" | "gte" | "yoy" | "count";

export type Operand = { src: Src; value: number };

export type Check = {
  /** Stable id, also the key of the user's explanation: "U1.ghgRevenue", "U8.water". */
  id: string;
  rule: RuleId;
  rel: Relation;
  unit: Unit;
  a: Operand;
  b?: Operand;
  /** Relative difference (a − b) / |b|. */
  diff?: number;
  tolerance?: number;
  status: CheckStatus;
  note?: string;
  /** U8: the metric compared; U10: the phrases found. */
  metric?: YoyMetric;
  items?: string[];
};

export type RuleResult = { id: RuleId; severity: Severity; status: CheckStatus; checks: Check[] };

export type RuleDef = {
  id: RuleId;
  severity: Severity;
  /** Source register ids the rule rests on. */
  basis: string[];
  /** Nav ids of the tools whose data the rule reads. */
  tools: string[];
};

export const RULES: RuleDef[] = [
  { id: "U1", severity: "error", basis: ["tsrs1", "taxonomy_2026_73"], tools: ["ghg", "environment", "taxonomy"] },
  { id: "U2", severity: "error", basis: ["gri_standards", "ghg_protocol", "energy_eff_reg"], tools: ["environment", "ghg", "applicability"] },
  { id: "U3", severity: "warning", basis: ["gri_standards", "kgk_scope_2026", "csrd_omnibus"], tools: ["workforce", "applicability"] },
  { id: "U4", severity: "error", basis: ["cbam_reg"], tools: ["cbam", "ghg", "ets", "applicability"] },
  { id: "U5", severity: "error", basis: ["tr_ets_reg", "ghg_protocol"], tools: ["ets", "ghg", "applicability"] },
  { id: "U6", severity: "warning", basis: ["taxonomy_2026_73", "tsrs1"], tools: ["taxonomy", "pathway"] },
  { id: "U7", severity: "warning", basis: ["ar_min_content", "kgk_assurance"], tools: ["annualReport", "ghg", "environment"] },
  { id: "U8", severity: "warning", basis: ["kgk_assurance", "tsrs1"], tools: ["ghg", "environment", "workforce"] },
  { id: "U9", severity: "warning", basis: ["kgk_assurance", "ghg_protocol"], tools: ["ghg"] },
  { id: "U10", severity: "error", basis: ["ecgt"], tools: ["claims"] },
];

export type YoyMetric = "scope1" | "scope2Location" | "scope2Market" | "scope3" | "energy" | "water" | "waste" | "revenue" | "headcount" | "ltifr";

export const YOY_METRICS: { id: YoyMetric; unit: Unit }[] = [
  { id: "scope1", unit: "tco2e" },
  { id: "scope2Location", unit: "tco2e" },
  { id: "scope2Market", unit: "tco2e" },
  { id: "scope3", unit: "tco2e" },
  { id: "energy", unit: "gj" },
  { id: "water", unit: "m3" },
  { id: "waste", unit: "t" },
  { id: "revenue", unit: "mTry" },
  { id: "headcount", unit: "people" },
  { id: "ltifr", unit: "rate" },
];

export type Tolerances = {
  /** U1: the same figure written in two places (rounding only). */
  match: number;
  /** U2–U5 consistency checks where definitions may differ slightly (year-end vs average headcount). */
  near: number;
  /** U8: year-over-year change that needs an explanation (default for every metric). */
  yoy: number;
  /** U8 per-metric overrides; a metric without an entry uses `yoy`. Volatile rates (LTIFR) usually need more room than Scope 1. */
  yoyByMetric?: Partial<Record<YoyMetric, number>>;
  /** U9: share of emissions from estimated data that triggers a warning (internal threshold). */
  estimated: number;
};

/** Effective year-over-year threshold for one metric: its override, else the global U8 threshold. */
export function yoyTolerance(rec: Reconciliation, m: YoyMetric): number {
  const o = rec.tolerances.yoyByMetric?.[m];
  return typeof o === "number" && Number.isFinite(o) && o >= 0 ? o : rec.tolerances.yoy;
}

export const DEFAULT_TOLERANCES: Tolerances = { match: 0.005, near: 0.05, yoy: 0.2, estimated: 0.2 };

export type Reconciliation = {
  /** Finance-side anchors from the audited financial statements / annual report (later: trial-balance import). */
  anchors: { netSalesMillionTry: number | null; headcount: number | null };
  /** Prior-year values for U8; revenue and headcount fall back to the scope test and HR data. */
  prior: Partial<Record<YoyMetric, number>>;
  /** Explanations keyed by check id. */
  notes: Record<string, string>;
  tolerances: Tolerances;
};

export function emptyReconciliation(): Reconciliation {
  return { anchors: { netSalesMillionTry: null, headcount: null }, prior: {}, notes: {}, tolerances: { ...DEFAULT_TOLERANCES } };
}

/** Rounding allowance where a rule is a hard inequality (energy, facility ≤ company). */
const ROUNDING = 0.005;
const GJ_PER_TOE = 41.868;

const RANK: Record<CheckStatus, number> = { na: 0, pass: 1, explained: 2, warn: 3, fail: 4 };

/** Worst status of a set of checks; "na" only when nothing could be checked. */
export function worstStatus(statuses: CheckStatus[]): CheckStatus {
  return statuses.reduce<CheckStatus>((w, s) => (RANK[s] > RANK[w] ? s : w), "na");
}

export function relDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return (a - b) / Math.abs(b);
}

const judge = (ok: boolean, severity: Severity): CheckStatus => (ok ? "pass" : severity === "error" ? "fail" : "warn");

/** Adds the user's explanation: a warning with an explanation is explained, an error stays an error. */
export function applyNote(c: Check, note: string | undefined): Check {
  const n = note?.trim();
  if (!n) return c;
  return { ...c, note: n, status: c.status === "warn" ? "explained" : c.status };
}

const pos = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

function eqCheck(rule: RuleId, a: Operand, b: Operand, unit: Unit, tolerance: number, severity: Severity): Check {
  const diff = relDiff(a.value, b.value);
  return { id: `${rule}.${a.src}`, rule, rel: "eq", unit, a, b, diff, tolerance, status: judge(Math.abs(diff) <= tolerance, severity) };
}

const naCheck = (rule: RuleId, src: Src, unit: Unit, rel: Relation = "eq"): Check => ({ id: `${rule}.${src}`, rule, rel, unit, a: { src, value: 0 }, status: "na" });

type Ctx = { c: ClientData; rec: Reconciliation; inv: ReturnType<typeof computeInventory> };

/** Net sales from the imported trial balance, m TRY; the ledger is the most authoritative revenue figure. */
export function ledgerSalesMillionTry(c: ClientData): number | undefined {
  const ns = c.trialBalance ? netSales(c.trialBalance) : null;
  return ns && ns.net > 0 ? ns.net / 1e6 : undefined;
}

function u1({ c, rec }: Ctx): Check[] {
  // The first figure present is the reference: trial balance, then the financial-statement anchor, then the inventory.
  const vals: Operand[] = [
    { src: "tbSales" as const, value: ledgerSalesMillionTry(c) ?? 0 },
    { src: "anchorSales" as const, value: rec.anchors.netSalesMillionTry ?? 0 },
    { src: "ghgRevenue" as const, value: c.ghg.revenueMillionTry },
    { src: "envRevenue" as const, value: c.indicators.env.revenueMillionTry },
    { src: "taxTurnover" as const, value: c.taxonomy.totals.turnover },
  ].filter((o) => pos(o.value));
  if (vals.length < 2) return [naCheck("U1", "anchorSales", "mTry")];
  const [ref, ...rest] = vals;
  return rest.map((o) => eqCheck("U1", o, ref, "mTry", rec.tolerances.match, "error"));
}

function u2({ c, rec, inv }: Ctx): Check[] {
  const env = c.indicators.env;
  const out: Check[] = [];
  if (pos(inv.energyGj) || pos(env.energyGj)) {
    const a = { src: "envEnergy" as const, value: env.energyGj };
    const b = { src: "invEnergy" as const, value: inv.energyGj };
    out.push({ id: "U2.envEnergy", rule: "U2", rel: "gte", unit: "gj", a, b, diff: relDiff(a.value, b.value), tolerance: ROUNDING, status: judge(a.value >= b.value * (1 - ROUNDING), "error") });
  } else out.push(naCheck("U2", "envEnergy", "gj", "gte"));
  const certifiedGj = inv.renewableShare * inv.electricityMwh * 3.6;
  if (pos(certifiedGj)) {
    const a = { src: "envRenewable" as const, value: env.renewableGj };
    const b = { src: "invRenewable" as const, value: certifiedGj };
    out.push({ id: "U2.envRenewable", rule: "U2", rel: "gte", unit: "gj", a, b, diff: relDiff(a.value, b.value), tolerance: ROUNDING, status: judge(a.value >= b.value * (1 - ROUNDING), "warning") });
  }
  if (pos(c.profile.energyToe) && pos(env.energyGj)) {
    out.push(eqCheck("U2", { src: "profileToe", value: c.profile.energyToe }, { src: "envToe", value: env.energyGj / GJ_PER_TOE }, "toe", rec.tolerances.near, "warning"));
  }
  return out;
}

function u3({ c, rec }: Ctx): Check[] {
  const w = c.indicators.workforce;
  const out: Check[] = [];
  const tol = rec.tolerances.near;
  if (pos(w.headcountEnd) && pos(rec.anchors.headcount)) out.push(eqCheck("U3", { src: "hrEnd", value: w.headcountEnd }, { src: "anchorHeadcount", value: rec.anchors.headcount }, "people", tol, "warning"));
  const y1 = c.profile.history[1]?.employees;
  if (pos(w.headcountStart) && pos(y1)) out.push(eqCheck("U3", { src: "hrStart", value: w.headcountStart }, { src: "profileEmployeesY1", value: y1 }, "people", tol, "warning"));
  if (pos(w.headcountEnd) && pos(c.profile.employeesGroup)) {
    const a = { src: "profileEmployeesGroup" as const, value: c.profile.employeesGroup };
    const b = { src: "hrEnd" as const, value: w.headcountEnd };
    out.push({ id: "U3.profileEmployeesGroup", rule: "U3", rel: "gte", unit: "people", a, b, diff: relDiff(a.value, b.value), status: judge(a.value >= b.value, "warning") });
  }
  return out.length ? out : [naCheck("U3", "hrEnd", "people")];
}

function u4({ c, rec }: Ctx): Check[] {
  const exports = c.cbam.products.reduce((s, p) => s + Math.max(0, p.tonnes), 0);
  if (!pos(exports)) return [naCheck("U4", "cbamExports", "t", "lte")];
  const a = { src: "cbamExports" as const, value: exports };
  const out: Check[] = [];
  for (const b of [
    { src: "ghgProduction" as const, value: c.ghg.productionTonnes },
    { src: "etsActivity" as const, value: c.ets.activity },
  ]) {
    if (pos(b.value)) out.push({ id: `U4.${b.src}`, rule: "U4", rel: "lte", unit: "t", a, b, diff: relDiff(a.value, b.value), status: judge(a.value <= b.value, "error") });
  }
  if (!out.length) out.push(naCheck("U4", "ghgProduction", "t", "lte"));
  if (pos(c.profile.euExportTonnes)) out.push(eqCheck("U4", { src: "profileEuExports", value: c.profile.euExportTonnes }, a, "t", rec.tolerances.near, "warning"));
  return out;
}

function u5({ c, rec, inv }: Ctx): Check[] {
  const ets = c.ets.emissions;
  if (!pos(ets)) return [naCheck("U5", "etsEmissions", "tco2e", "lte")];
  const a = { src: "etsEmissions" as const, value: ets };
  const out: Check[] = [];
  if (pos(inv.scope1)) {
    const b = { src: "ghgScope1" as const, value: inv.scope1 };
    out.push({ id: "U5.etsEmissions", rule: "U5", rel: "lte", unit: "tco2e", a, b, diff: relDiff(a.value, b.value), tolerance: ROUNDING, status: judge(a.value <= b.value * (1 + ROUNDING), "error") });
  } else out.push(naCheck("U5", "etsEmissions", "tco2e", "lte"));
  if (pos(c.profile.annualEmissionsTco2e)) out.push(eqCheck("U5", { src: "profileEmissions", value: c.profile.annualEmissionsTco2e }, a, "tco2e", rec.tolerances.near, "warning"));
  return out;
}

/** Current value of a year-over-year metric and, where the app already holds it, its prior-year value. */
export function yoyValues(c: ClientData, inv: ReturnType<typeof computeInventory>, rec: Reconciliation, m: YoyMetric): { current: number; prior: number | undefined; auto: boolean } {
  const env = c.indicators.env;
  const w = c.indicators.workforce;
  const auto: Partial<Record<YoyMetric, number>> = {
    revenue: c.profile.history[1]?.revenueTry ? c.profile.history[1].revenueTry / 1e6 : undefined,
    headcount: w.headcountStart || undefined,
  };
  const current: Record<YoyMetric, number> = {
    scope1: inv.scope1,
    scope2Location: inv.scope2Location,
    scope2Market: inv.scope2Market,
    scope3: inv.scope3,
    energy: env.energyGj,
    water: env.waterWithdrawalM3,
    waste: env.wasteTotalT,
    revenue: ledgerSalesMillionTry(c) ?? rec.anchors.netSalesMillionTry ?? c.ghg.revenueMillionTry,
    headcount: w.headcountEnd,
    ltifr: safetyRates(c.indicators.safety).ltifr,
  };
  const own = rec.prior[m];
  return { current: current[m], prior: own ?? auto[m], auto: own === undefined && auto[m] !== undefined };
}

/** Share of total CapEx from which an aligned activity counts as material (internal threshold, like U9). */
const INVEST_MATERIAL = 0.05;

const TR_STOP = new Set(["ve", "ile", "için", "bir", "bu", "da", "de", "ki", "veya", "göre", "kadar", "olarak", "olan", "daha", "çok", "the", "and", "for"]);

/** Significant lower-cased tokens of a Turkish measure/activity name. */
export function nameTokens(s: string): string[] {
  return (s.toLocaleLowerCase("tr").match(/[a-zçğıöşüâîû]+/g) ?? []).filter((w) => w.length >= 3 && !TR_STOP.has(w));
}

/** Two names name the same investment when they share at least two significant tokens. */
export function sameInvestment(a: string, b: string): boolean {
  const sa = new Set(nameTokens(a));
  let shared = 0;
  for (const w of new Set(nameTokens(b))) if (sa.has(w) && ++shared >= 2) return true;
  return false;
}

/** Biggest year-over-year move of energy/scope 1 with its threshold and whether it stands unexplained. */
function impactMove({ c, rec, inv }: Ctx): { diff: number; src: "energyChange" | "scope1Change"; tolerance: number; explained: boolean } | null {
  const rows = (["energy", "scope1"] as const).map((m) => {
    const { current, prior } = yoyValues(c, inv, rec, m);
    return { m, current, prior };
  });
  if (rows.some(({ current, prior }) => !pos(prior) || !(current >= 0))) return null;
  const moves = rows.map(({ m, current, prior }) => ({ m, diff: relDiff(current, prior!), tolerance: yoyTolerance(rec, m) }));
  moves.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  const top = moves[0];
  const id = `U8.${top.m}`;
  return { diff: top.diff, src: top.m === "energy" ? "energyChange" : "scope1Change", tolerance: top.tolerance, explained: !!rec.notes[id]?.trim() };
}

function u6({ c }: Ctx): Check[] {
  const acts = c.taxonomy.activities.filter((a) => a.aligned && a.capex > 0);
  if (!acts.length) return [naCheck("U6", "alignedCapex", "count", "count")];
  const base = Math.max(0, c.taxonomy.totals.capex);
  const material = acts.filter((a) => base <= 0 || a.capex / base >= INVEST_MATERIAL);
  const unmatched = material.filter((a) => !c.pathway.measures.some((m) => sameInvestment(a.name, m.name))).map((a) => a.name);
  return [
    {
      id: "U6.investments",
      rule: "U6",
      rel: "count",
      unit: "count",
      a: { src: "alignedCapex", value: unmatched.length },
      status: judge(unmatched.length === 0, "warning"),
      items: unmatched,
    },
  ];
}

function u7(x: Ctx): Check[] {
  const reported = ["review", "approved"].includes(x.c.annualReport.status.investments);
  if (!reported) return [naCheck("U7", "energyChange", "share", "gte")];
  const move = impactMove(x);
  if (!move) return [naCheck("U7", "energyChange", "share", "gte")];
  const moved = Math.abs(move.diff) > move.tolerance;
  return [
    {
      id: "U7.investments",
      rule: "U7",
      rel: "gte",
      unit: "share",
      a: { src: move.src, value: move.diff },
      b: { src: "threshold", value: move.tolerance },
      diff: move.diff,
      tolerance: move.tolerance,
      status: judge(moved || move.explained, "warning"),
    },
  ];
}

function u8({ c, rec, inv }: Ctx): Check[] {
  return YOY_METRICS.map(({ id, unit }) => {
    const { current, prior } = yoyValues(c, inv, rec, id);
    const base = { id: `U8.${id}`, rule: "U8" as const, rel: "yoy" as const, unit, metric: id, a: { src: "current" as const, value: current } };
    if (!pos(prior) || !(current >= 0)) return { ...base, status: "na" as const };
    const diff = relDiff(current, prior);
    const tol = yoyTolerance(rec, id);
    return { ...base, b: { src: "prior" as const, value: prior }, diff, tolerance: tol, status: judge(Math.abs(diff) <= tol, "warning") };
  });
}

function u9({ rec, inv }: Ctx): Check[] {
  const t = { src: "threshold" as const, value: rec.tolerances.estimated };
  const one = (src: "estimated12" | "estimated3", share: number, has: boolean): Check =>
    has ? { id: `U9.${src}`, rule: "U9", rel: "lte", unit: "share", a: { src, value: share }, b: t, status: judge(share <= t.value, "warning") } : naCheck("U9", src, "share", "lte");
  return [one("estimated12", inv.estimatedShareScope12, pos(inv.scope1 + inv.scope2Location)), one("estimated3", inv.estimatedShareScope3, pos(inv.scope3))];
}

function u10({ c }: Ctx): Check[] {
  const text = c.claims?.text ?? "";
  if (!text.trim()) return [naCheck("U10", "claimsText", "count", "count")];
  const hits = screenClaims(text, c.claims?.lang ?? "tr");
  const n = countByRule(hits);
  const phrases = (rules: string[]) => [...new Set(hits.filter((h) => rules.includes(h.rule)).map((h) => h.text))];
  return [
    { id: "U10.claimsHigh", rule: "U10", rel: "count", unit: "count", a: { src: "claimsHigh", value: n.offset + n.future }, status: judge(n.offset + n.future === 0, "error"), items: phrases(["offset", "future"]) },
    { id: "U10.claimsOther", rule: "U10", rel: "count", unit: "count", a: { src: "claimsOther", value: n.absolute + n.generic }, status: judge(n.absolute + n.generic === 0, "warning"), items: phrases(["absolute", "generic"]) },
  ];
}

const RUN: Record<RuleId, (x: Ctx) => Check[]> = { U1: u1, U2: u2, U3: u3, U4: u4, U5: u5, U6: u6, U7: u7, U8: u8, U9: u9, U10: u10 };

export type ReconcileResult = { rules: RuleResult[]; counts: Record<CheckStatus, number> };

/** Runs every rule for one client. Pure: same data, same result. */
export function reconcile(c: ClientData): ReconcileResult {
  const rec = c.reconciliation ?? emptyReconciliation();
  const ctx: Ctx = { c, rec, inv: computeInventory(c.ghg) };
  const rules = RULES.map((def) => {
    const checks = RUN[def.id](ctx).map((k) => applyNote(k, rec.notes[k.id]));
    return { id: def.id, severity: def.severity, status: worstStatus(checks.map((k) => k.status)), checks };
  });
  const counts: Record<CheckStatus, number> = { pass: 0, explained: 0, warn: 0, fail: 0, na: 0 };
  rules.forEach((r) => counts[r.status]++);
  return { rules, counts };
}

/** Flat records for the auditor file (CSV/JSON): one row per check. */
export function reconcileRecords(r: ReconcileResult) {
  return r.rules.flatMap((rule) =>
    rule.checks.map((k) => ({
      rule: rule.id,
      severity: rule.severity,
      check: k.id,
      status: k.status,
      relation: k.rel,
      unit: k.unit,
      a: k.a.src,
      aValue: k.a.value,
      b: k.b?.src ?? "",
      bValue: k.b?.value ?? null,
      diff: k.diff ?? null,
      tolerance: k.tolerance ?? null,
      note: k.note ?? "",
      items: k.items?.join(" | ") ?? "",
    })),
  );
}
