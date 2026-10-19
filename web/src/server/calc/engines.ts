/**
 * Non-GHG calculations over accepted observations (G4-04..06), each wrapping the toolkit formula unchanged:
 *   - environment: energy, renewable share, water, waste (GRI 302/303/306, ESRS E1-5/E3/E5), intensity per net sales;
 *   - workforce: headcount, training per employee, women share with small-group suppression (KVKK md. 6: a share
 *     over fewer than 5 people identifies them), LTIFR per 1,000,000 hours (ILO / GRI 403-9);
 *   - finance: net sales from the trial balance (TDHP 600–602 less 610–612) reconciled with the reported figure;
 *   - CBAM: embedded emissions per CN code — verified actual SEE, else the EU default value with the mark-up;
 *   - ETS: TR-ETS category per installation from verified emissions (Climate Law No. 7552 thresholds).
 * Pure: the service supplies observations, the boundary, factors and the parsed trial balance.
 */
import { environment, safetyRates } from "@/lib/calc/indicators";
import { cnCoverage, defaultMarkup, type CbamSector } from "@/lib/calc/cbam";
import { etsCategory } from "@/lib/calc/ets";
import { netSales, tbTotals, type TrialBalance } from "@/lib/trial-balance";
import type { ResolvedFactor } from "./factors";
import type { Obs, Warning } from "./ghg-engine";

/** A result; `valueExact` (a decimal string) carries money and other figures that must not pass through floating point. */
export type FactOut = { metricKey: string; facilityId: string | null; valueNum?: number; valueExact?: string; valueText?: string; unit: string; estimatedShare?: number; suppressed?: boolean };
export type EngineOut = { facts: FactOut[]; used: { observations: string[]; factors: string[] }; warnings: Warning[]; detail?: Record<string, unknown> };

export type Scoped = { facilities: { id: string; pct: number; country: string }[]; observations: Obs[] };

const num = (s: string | null) => (s === null ? 0 : Number(s));

function helpers(input: Scoped) {
  const used = new Set<string>();
  const live = new Map(input.facilities.filter((f) => f.pct > 0).map((f) => [f.id, f]));
  /** Sum of a facility-level metric over the boundary, scaled by each facility's share. */
  const facilitySum = (metric: string) => {
    let total = 0;
    let found = false;
    let estimated = 0;
    for (const o of input.observations.filter((x) => x.metricCode === metric && x.facilityId && live.has(x.facilityId))) {
      used.add(o.versionId);
      found = true;
      const v = num(o.canonical) * (live.get(o.facilityId!)!.pct / 100);
      total += v;
      if (o.quality === "estimated") estimated += v;
    }
    return { total, found, estimatedShare: total > 0 ? estimated / total : 0 };
  };
  const orgValue = (metric: string) => {
    const o = input.observations.filter((x) => x.metricCode === metric && x.facilityId === null);
    o.forEach((x) => used.add(x.versionId));
    return { total: o.reduce((s, x) => s + num(x.canonical), 0), found: o.length > 0, estimatedShare: o.some((x) => x.quality === "estimated") ? 1 : 0 };
  };
  return { used, live, facilitySum, orgValue };
}

// ---------------------------------------------------------------- environment

export function computeEnvironment(input: Scoped): EngineOut {
  const h = helpers(input);
  const warnings: Warning[] = [];
  const energy = h.facilitySum("env_energy");
  const renewable = h.facilitySum("env_renewable");
  const withdrawal = h.facilitySum("env_water_withdrawal");
  const discharge = h.facilitySum("env_water_discharge");
  const waste = h.facilitySum("env_waste");
  const sales = h.orgValue("net_sales");
  if (renewable.total > energy.total + 1e-9) warnings.push({ code: "renewable_exceeds_energy", target: "env_renewable", detail: { renewableGj: renewable.total, energyGj: energy.total } });
  if (discharge.total > withdrawal.total + 1e-9) warnings.push({ code: "discharge_exceeds_withdrawal", target: "env_water_discharge" });
  const r = environment({ energyGj: energy.total, renewableGj: renewable.total, waterWithdrawalM3: withdrawal.total, waterDischargeM3: discharge.total, waterStressShare: 0, wasteTotalT: waste.total, wasteRecoveredT: 0, wasteHazardousT: 0, revenueMillionTry: sales.total / 1_000_000 });
  const facts: FactOut[] = [];
  if (energy.found) {
    facts.push({ metricKey: "env.energy_gj", facilityId: null, valueNum: energy.total, unit: "GJ", estimatedShare: energy.estimatedShare });
    facts.push({ metricKey: "env.energy_mwh", facilityId: null, valueNum: r.energyMwh, unit: "MWh", estimatedShare: energy.estimatedShare });
    if (renewable.found) facts.push({ metricKey: "env.renewable_share", facilityId: null, valueNum: r.renewableShare, unit: "ratio" });
    if (sales.found && sales.total > 0) facts.push({ metricKey: "env.energy_intensity", facilityId: null, valueNum: r.energyIntensity, unit: "GJ/mTRY" });
  }
  if (withdrawal.found) {
    facts.push({ metricKey: "env.water_withdrawal_m3", facilityId: null, valueNum: withdrawal.total, unit: "m3", estimatedShare: withdrawal.estimatedShare });
    if (discharge.found) facts.push({ metricKey: "env.water_consumption_m3", facilityId: null, valueNum: r.waterConsumption, unit: "m3" });
  }
  if (waste.found) facts.push({ metricKey: "env.waste_t", facilityId: null, valueNum: waste.total, unit: "t", estimatedShare: waste.estimatedShare });
  return { facts, used: { observations: [...h.used], factors: [] }, warnings };
}

// ---------------------------------------------------------------- workforce

/** Smallest group whose share may be published (KVKK md. 6; the same k-anonymity floor statistics offices use). */
export const MIN_GROUP = 5;

export function computeWorkforce(input: Scoped): EngineOut {
  const h = helpers(input);
  const warnings: Warning[] = [];
  const facts: FactOut[] = [];
  const headcount = h.orgValue("work_headcount");
  const women = h.orgValue("work_diversity");
  const training = h.orgValue("work_training");
  const hours = h.facilitySum("ohs_hours");
  const lti = h.facilitySum("ohs_incidents");
  if (headcount.found) facts.push({ metricKey: "workforce.headcount", facilityId: null, valueNum: headcount.total, unit: "persons" });
  if (headcount.found && women.found && headcount.total > 0) {
    if (women.total > headcount.total) warnings.push({ code: "women_exceed_headcount", target: "work_diversity" });
    const small = women.total < MIN_GROUP || headcount.total - women.total < MIN_GROUP;
    if (small) warnings.push({ code: "small_group_suppressed", target: "workforce.women_share", detail: { minGroup: MIN_GROUP } });
    facts.push({ metricKey: "workforce.women_share", facilityId: null, valueNum: women.total / headcount.total, unit: "ratio", suppressed: small });
  }
  if (training.found && headcount.found && headcount.total > 0) facts.push({ metricKey: "workforce.training_hours_per_employee", facilityId: null, valueNum: training.total / headcount.total, unit: "h/person" });
  if (hours.found) {
    facts.push({ metricKey: "ohs.hours_worked", facilityId: null, valueNum: hours.total, unit: "h", estimatedShare: hours.estimatedShare });
    if (lti.found) facts.push({ metricKey: "ohs.ltifr", facilityId: null, valueNum: safetyRates({ hoursWorked: hours.total, lostTimeInjuries: lti.total, recordables: 0, lostDays: 0, fatalities: 0 }).ltifr, unit: "per 1,000,000 h" });
  } else if (lti.found) warnings.push({ code: "ltifr_without_hours", target: "ohs_hours" });
  return { facts, used: { observations: [...h.used], factors: [] }, warnings };
}

// ---------------------------------------------------------------- finance (trial balance)

/** Tolerance between the reported net sales and the trial balance (0.5 %, the usual clearly-trivial threshold). */
export const NET_SALES_TOLERANCE = 0.005;

export type FinanceInput = Scoped & { year: number; tb: { evidenceId: string; filename: string; sha256: string; parsed: TrialBalance } | null };

export function computeFinance(input: FinanceInput): EngineOut {
  const h = helpers(input);
  const warnings: Warning[] = [];
  const facts: FactOut[] = [];
  const reported = h.orgValue("net_sales");
  const detail: Record<string, unknown> = {};
  let anchor: number | null = null;
  if (input.tb) {
    const tb = input.tb.parsed;
    const totals = tbTotals(tb);
    const ns = netSales(tb);
    detail.trialBalance = { evidenceId: input.tb.evidenceId, filename: input.tb.filename, sha256: input.tb.sha256, year: tb.year ?? null, rows: tb.rows, balanceSource: tb.balanceSource, totals, netSales: ns };
    if (tb.year !== undefined && tb.year !== input.year) warnings.push({ code: "tb_year_mismatch", target: `evidence:${input.tb.evidenceId}`, detail: { tbYear: tb.year, reportingYear: input.year } });
    if (tb.year === undefined) warnings.push({ code: "tb_year_unknown", target: `evidence:${input.tb.evidenceId}` });
    if (!totals.movementsBalanced) warnings.push({ code: "tb_not_balanced", target: `evidence:${input.tb.evidenceId}`, detail: { debit: totals.debit, credit: totals.credit } });
    if (!ns) warnings.push({ code: "tb_no_sales_accounts", target: `evidence:${input.tb.evidenceId}` });
    else anchor = ns.net;
  } else warnings.push({ code: "tb_missing", target: "tb_export" });
  if (anchor !== null) {
    facts.push({ metricKey: "finance.net_sales", facilityId: null, valueNum: anchor, unit: "TRY" });
    if (reported.found) {
      const diff = anchor !== 0 ? Math.abs(reported.total - anchor) / Math.abs(anchor) : reported.total === 0 ? 0 : 1;
      detail.reconciliation = { reported: reported.total, trialBalance: anchor, difference: reported.total - anchor, relative: diff, tolerance: NET_SALES_TOLERANCE };
      if (diff > NET_SALES_TOLERANCE) warnings.push({ code: "tb_net_sales_mismatch", target: "net_sales", detail: detail.reconciliation as Record<string, unknown> });
    }
  } else if (reported.found) facts.push({ metricKey: "finance.net_sales", facilityId: null, valueNum: reported.total, unit: "TRY", estimatedShare: reported.estimatedShare });
  return { facts, used: { observations: [...h.used], factors: [] }, warnings, detail };
}

// ---------------------------------------------------------------- CBAM

/** Factor targets for CBAM: one default-value lookup per (origin, CN) exported without a verified actual value. */
export function cbamTargets(input: Scoped): string[] {
  const t = new Set<string>();
  const live = new Map(input.facilities.filter((f) => f.pct > 0).map((f) => [f.id, f]));
  for (const o of input.observations.filter((x) => x.metricCode === "cbam_goods" && x.facilityId && live.has(x.facilityId))) {
    const actual = input.observations.find((x) => x.metricCode === "cbam_see" && x.facilityId === o.facilityId);
    for (const l of o.lines ?? []) {
      const cn = l.key.replace(/\D/g, "");
      if (!actual?.lines?.some((a) => a.key.replace(/\D/g, "") === cn)) t.add(`cbam:${live.get(o.facilityId!)!.country.toLowerCase()}:${cn}`);
    }
  }
  return [...t].sort();
}

export function computeCbam(input: Scoped & { year: number; factors: Record<string, ResolvedFactor> }): EngineOut {
  const h = helpers(input);
  const warnings: Warning[] = [];
  const facts: FactOut[] = [];
  const usedFactors = new Set<string>();
  let total = 0;
  for (const o of input.observations.filter((x) => x.metricCode === "cbam_goods" && x.facilityId && h.live.has(x.facilityId))) {
    const fac = h.live.get(o.facilityId!)!;
    const actualObs = input.observations.find((x) => x.metricCode === "cbam_see" && x.facilityId === o.facilityId);
    for (const l of o.lines ?? []) {
      const cn = l.key.replace(/\D/g, "");
      const cover = cnCoverage(cn);
      if (cover.status === "not_covered" || cover.status === "invalid") {
        warnings.push({ code: "cbam_cn_not_covered", target: `${o.versionId}:${cn}` });
        continue;
      }
      if (cover.status === "partial") warnings.push({ code: "cbam_cn_partial", target: `${o.versionId}:${cn}` });
      const sector: CbamSector = cover.sector;
      const tonnes = Math.max(0, Number(l.canonical));
      const actual = actualObs?.lines?.find((a) => a.key.replace(/\D/g, "") === cn);
      let see: number;
      let estimated = 0;
      if (actual) {
        h.used.add(actualObs!.versionId);
        see = Math.max(0, Number(actual.canonical));
        if (actualObs!.quality === "estimated") estimated = 1;
      } else {
        const target = `cbam:${fac.country.toLowerCase()}:${cn}`;
        const f = input.factors[target];
        if (!f) {
          warnings.push({ code: "factor_missing", target });
          continue;
        }
        usedFactors.add(target);
        see = f.value * (1 + defaultMarkup(input.year, sector));
        estimated = 1;
        warnings.push({ code: "cbam_default_value_used", target, detail: { cn, markup: defaultMarkup(input.year, sector) } });
      }
      h.used.add(o.versionId);
      const embedded = tonnes * see;
      total += embedded;
      facts.push({ metricKey: `cbam.see.${cn}`, facilityId: fac.id, valueNum: see, unit: "tCO2e/t", estimatedShare: estimated });
      facts.push({ metricKey: `cbam.embedded.${cn}`, facilityId: fac.id, valueNum: embedded, unit: "tCO2e", estimatedShare: estimated });
    }
  }
  if (facts.length) facts.push({ metricKey: "cbam.embedded_total", facilityId: null, valueNum: total, unit: "tCO2e" });
  return { facts, used: { observations: [...h.used], factors: [...usedFactors] }, warnings };
}

// ---------------------------------------------------------------- TR-ETS

export function computeEts(input: Scoped): EngineOut {
  const h = helpers(input);
  const facts: FactOut[] = [];
  for (const f of h.live.values()) {
    const e = input.observations.filter((o) => o.metricCode === "ets_emissions" && o.facilityId === f.id);
    if (!e.length) continue;
    e.forEach((o) => h.used.add(o.versionId));
    const t = e.reduce((s, o) => s + num(o.canonical), 0);
    facts.push({ metricKey: "ets.verified_emissions", facilityId: f.id, valueNum: t, unit: "tCO2e" });
    facts.push({ metricKey: "ets.category", facilityId: f.id, valueText: etsCategory(t), unit: "" });
  }
  return { facts, used: { observations: [...h.used], factors: [] }, warnings: [] };
}
