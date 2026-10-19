/**
 * Cross-checks over the cycle's facts (G5-03; the toolkit's reconciliation catalogue U1–U10, docs/HEDEF_MIMARI.md
 * §4.2), so one figure is not reported differently in two places. Same severities as the toolkit: an error is a
 * blocker (a physical or arithmetic contradiction cannot be explained away), a warning needs an explanation.
 *   U1  revenue: the anchor (consolidated revenue, else trial balance net sales) = the revenue the intensities used
 *   U2  energy: total energy (environment) ≥ energy in the GHG inventory
 *   U3  headcount: year-end headcount ≈ employees in the applicability profile (warning)
 *   U4  CBAM: goods exported ≤ production at the facility
 *   U5  TR-ETS: verified installation emissions ≤ the facility's scope 1 (ETS covers part of scope 1)
 *   U6  taxonomy: every material aligned CapEx activity has a matching measure in the transition plan (warning)
 *   U7  annual report: investments reported in the annual report checklist, yet energy and scope 1 hardly moved
 *       against the previous cycle (warning: the investments' effect is explained or the text corrected)
 *   U8, U9 run inside each calculation (year-on-year change, estimated share); U10 (green claims) is checked on
 *   the report text and blocks the release itself (report studio).
 */
import { RULES, sameInvestment, type RuleId } from "@/lib/reconcile";

export const RECONCILE_VERSION = "reconcile-erp-2026.10.19";
/** U1: the same figure written twice, rounding only. */
export const MATCH = 0.005;
/** U3: definitions may differ (year-end vs average headcount). */
export const NEAR = 0.1;
/** U5: ETS monitoring and the corporate inventory use different methods (MRR tiers vs GHG Protocol). */
export const ETS_ROOM = 0.05;
/** U6: an aligned activity counts as a material investment from 5 % of the CapEx denominator (toolkit rule). */
export const INVEST_MATERIAL = 0.05;
/** U7: year-on-year change below this means the reported investments did not show in energy or scope 1. */
export const YOY_MOVE = 0.2;

export type FactIn = { id: string; metricKey: string; facilityId: string | null; boundaryKind: string | null; value: number | null };
export type ReconcileInput = {
  facts: FactIn[];
  /** Revenue the GHG / environment intensities used (accepted net sales observation), TRY. */
  reportedRevenue: number | null;
  /** Applicability profile: employees of the reporting year. */
  profileEmployees: number | null;
  /** Accepted observations per facility: production and CBAM exported goods, tonnes. */
  production: Record<string, number>;
  cbamExports: Record<string, number>;
  /** U6: the approved taxonomy sheet (CapEx denominator and activities) and the transition plan's measure names. */
  taxonomy?: { capexTotal: number; activities: { name: string; capex: number; aligned: boolean }[] } | null;
  measures?: string[] | null;
  /** U7: the approved annual report checklist says the investments item is covered; previous cycle's figures. */
  investmentsReported?: boolean;
  prior?: { energyGj: number | null; scope1: number | null } | null;
};
export type CheckStatus = "pass" | "fail" | "na";
export type CheckOut = { code: string; rule: RuleId; severity: "blocker" | "warning"; status: CheckStatus; target: string; a?: number; b?: number; diff?: number; tolerance?: number; note?: string; items?: string[] };

const sev = (rule: RuleId): "blocker" | "warning" => (RULES.find((r) => r.id === rule)!.severity === "error" ? "blocker" : "warning");
const rel = (a: number, b: number) => (b === 0 ? (a === 0 ? 0 : Infinity) : (a - b) / Math.abs(b));

export function reconcile(x: ReconcileInput): CheckOut[] {
  const out: CheckOut[] = [];
  const group = (k: string, boundary?: string) => x.facts.find((f) => f.metricKey === k && f.facilityId === null && (boundary === undefined || f.boundaryKind === boundary))?.value ?? null;
  const at = (k: string, facility: string) => x.facts.find((f) => f.metricKey === k && f.facilityId === facility && (f.boundaryKind === null || f.boundaryKind === "ghg_operational_control"))?.value ?? null;

  // U1
  const anchor = group("finance.consolidated_net_sales") ?? group("finance.net_sales");
  if (anchor === null || x.reportedRevenue === null) out.push({ code: "u1_revenue", rule: "U1", severity: sev("U1"), status: "na", target: "revenue" });
  else {
    const d = rel(x.reportedRevenue, anchor);
    out.push({ code: "u1_revenue", rule: "U1", severity: sev("U1"), status: Math.abs(d) <= MATCH ? "pass" : "fail", target: "revenue", a: x.reportedRevenue, b: anchor, diff: d, tolerance: MATCH });
  }

  // U2
  const env = group("env.energy_gj");
  const ghgEnergy = group("ghg.energy_gj", "ghg_operational_control") ?? group("ghg.energy_gj");
  if (env === null || ghgEnergy === null) out.push({ code: "u2_energy", rule: "U2", severity: sev("U2"), status: "na", target: "energy" });
  else out.push({ code: "u2_energy", rule: "U2", severity: sev("U2"), status: env >= ghgEnergy * (1 - MATCH) ? "pass" : "fail", target: "energy", a: env, b: ghgEnergy, diff: rel(env, ghgEnergy), tolerance: MATCH });

  // U3
  const hc = group("workforce.headcount");
  if (hc === null || x.profileEmployees === null) out.push({ code: "u3_headcount", rule: "U3", severity: sev("U3"), status: "na", target: "headcount" });
  else {
    const d = rel(hc, x.profileEmployees);
    out.push({ code: "u3_headcount", rule: "U3", severity: sev("U3"), status: Math.abs(d) <= NEAR ? "pass" : "fail", target: "headcount", a: hc, b: x.profileEmployees, diff: d, tolerance: NEAR });
  }

  // U4 per facility
  const cbamFacilities = Object.keys(x.cbamExports);
  if (!cbamFacilities.length) out.push({ code: "u4_cbam_exports", rule: "U4", severity: sev("U4"), status: "na", target: "cbam" });
  for (const f of cbamFacilities) {
    const prod = x.production[f];
    if (prod === undefined) out.push({ code: "u4_cbam_exports", rule: "U4", severity: sev("U4"), status: "na", target: `facility:${f}`, note: "no_production" });
    else out.push({ code: "u4_cbam_exports", rule: "U4", severity: sev("U4"), status: x.cbamExports[f] <= prod * (1 + MATCH) ? "pass" : "fail", target: `facility:${f}`, a: x.cbamExports[f], b: prod, diff: rel(x.cbamExports[f], prod), tolerance: MATCH });
  }

  // U5 per installation
  const ets = x.facts.filter((f) => f.metricKey === "ets.verified_emissions" && f.facilityId !== null && f.value !== null);
  if (!ets.length) out.push({ code: "u5_ets_scope1", rule: "U5", severity: sev("U5"), status: "na", target: "ets" });
  for (const e of ets) {
    const s1 = at("ghg.scope1", e.facilityId!);
    if (s1 === null) out.push({ code: "u5_ets_scope1", rule: "U5", severity: sev("U5"), status: "na", target: `facility:${e.facilityId}`, note: "no_scope1" });
    else out.push({ code: "u5_ets_scope1", rule: "U5", severity: sev("U5"), status: e.value! <= s1 * (1 + ETS_ROOM) ? "pass" : "fail", target: `facility:${e.facilityId}`, a: e.value!, b: s1, diff: rel(e.value!, s1), tolerance: ETS_ROOM });
  }

  // U6: material aligned CapEx without a matching measure in the transition plan
  const acts = (x.taxonomy?.activities ?? []).filter((a) => a.aligned && a.capex > 0);
  if (!x.taxonomy || !acts.length) out.push({ code: "u6_taxonomy_capex", rule: "U6", severity: sev("U6"), status: "na", target: "taxonomy" });
  else {
    const base = Math.max(0, x.taxonomy.capexTotal);
    const material = acts.filter((a) => base <= 0 || a.capex / base >= INVEST_MATERIAL);
    const unmatched = material.filter((a) => !(x.measures ?? []).some((m) => sameInvestment(a.name, m))).map((a) => a.name);
    out.push({ code: "u6_taxonomy_capex", rule: "U6", severity: sev("U6"), status: unmatched.length ? "fail" : "pass", target: "taxonomy", a: unmatched.length, b: material.length, items: unmatched });
  }

  // U7: investments reported, but neither energy nor scope 1 moved beyond the year-on-year threshold
  const energy = group("env.energy_gj") ?? group("ghg.energy_gj", "ghg_operational_control") ?? group("ghg.energy_gj");
  const scope1 = group("ghg.scope1", "ghg_operational_control") ?? group("ghg.scope1");
  const moves = [
    { now: energy, prev: x.prior?.energyGj ?? null },
    { now: scope1, prev: x.prior?.scope1 ?? null },
  ].filter((m) => m.now !== null && m.prev !== null && m.prev > 0);
  if (!x.investmentsReported || !moves.length) out.push({ code: "u7_annual_report", rule: "U7", severity: sev("U7"), status: "na", target: "annual_report" });
  else {
    const top = moves.map((m) => rel(m.now!, m.prev!)).sort((a, b) => Math.abs(b) - Math.abs(a))[0];
    out.push({ code: "u7_annual_report", rule: "U7", severity: sev("U7"), status: Math.abs(top) > YOY_MOVE ? "pass" : "fail", target: "annual_report", diff: top, tolerance: YOY_MOVE });
  }

  // covered elsewhere
  for (const [rule, code, note] of [
    ["U8", "u8_yoy", "in_runs"],
    ["U9", "u9_estimated", "in_runs"],
    ["U10", "u10_claims", "in_release"],
  ] as const)
    out.push({ code, rule, severity: sev(rule), status: "na", target: rule, note });
  return out;
}
