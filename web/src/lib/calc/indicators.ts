/** Environmental, social and taxonomy indicator formulas used across GRI / TSRS / ESRS reporting. */

export const GJ_PER_TOE = 41.868;
export const GJ_PER_MWH = 3.6;

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

// --- Health & safety, workforce ---------------------------------------------
export type SafetyInput = { hoursWorked: number; lostTimeInjuries: number; recordables: number; lostDays: number; fatalities: number };

export function safetyRates(s: SafetyInput) {
  return {
    ltifr: safeDiv(s.lostTimeInjuries * 1_000_000, s.hoursWorked),
    trir: safeDiv(s.recordables * 200_000, s.hoursWorked),
    severity: safeDiv(s.lostDays * 1_000_000, s.hoursWorked),
    fatalityRate: safeDiv(s.fatalities * 1_000_000, s.hoursWorked),
  };
}

export type WorkforceInput = {
  headcountStart: number;
  headcountEnd: number;
  leavers: number;
  trainingHours: number;
  avgPayMen: number;
  avgPayWomen: number;
  women: number;
  womenManagers: number;
  managers: number;
};

export function workforce(w: WorkforceInput) {
  const avgHeadcount = (w.headcountStart + w.headcountEnd) / 2;
  return {
    avgHeadcount,
    turnover: safeDiv(w.leavers, avgHeadcount),
    trainingPerEmployee: safeDiv(w.trainingHours, avgHeadcount),
    /** Unadjusted gender pay gap, ESRS S1-16 style: (men − women) / men. */
    payGap: w.avgPayMen > 0 ? (w.avgPayMen - w.avgPayWomen) / w.avgPayMen : 0,
    womenShare: safeDiv(w.women, w.headcountEnd),
    womenManagerShare: safeDiv(w.womenManagers, w.managers),
  };
}

// --- Energy, water, waste ----------------------------------------------------
export type EnvInput = {
  energyGj: number;
  renewableGj: number;
  waterWithdrawalM3: number;
  waterDischargeM3: number;
  waterStressShare: number;
  wasteTotalT: number;
  wasteRecoveredT: number;
  wasteHazardousT: number;
  revenueMillionTry: number;
};

export function environment(e: EnvInput) {
  return {
    energyToe: e.energyGj / GJ_PER_TOE,
    energyMwh: e.energyGj / GJ_PER_MWH,
    renewableShare: safeDiv(e.renewableGj, e.energyGj),
    energyIntensity: safeDiv(e.energyGj, e.revenueMillionTry),
    waterConsumption: Math.max(0, e.waterWithdrawalM3 - e.waterDischargeM3),
    waterIntensity: safeDiv(e.waterWithdrawalM3, e.revenueMillionTry),
    wasteRecoveryRate: safeDiv(e.wasteRecoveredT, e.wasteTotalT),
    hazardousShare: safeDiv(e.wasteHazardousT, e.wasteTotalT),
    energyManagerRequired: e.energyGj / GJ_PER_TOE >= 1000,
  };
}

// --- Taxonomy KPIs -------------------------------------------------------------
export type TaxonomyActivity = {
  id: string;
  name: string;
  code: string;
  turnover: number;
  capex: number;
  opex: number;
  eligible: boolean;
  aligned: boolean;
};

export type TaxonomyTotals = { turnover: number; capex: number; opex: number };
export type KpiKey = keyof TaxonomyTotals;

/**
 * Taxonomy KPIs with the 10 % materiality threshold (EU Del. Reg. 2026/73): eligible activities whose
 * combined share of a KPI is below 10 % may be reported as "not assessed".
 */
export function taxonomyKpis(acts: TaxonomyActivity[], totals: TaxonomyTotals, notAssessedIds: string[] = []) {
  const out = {} as Record<KpiKey, { eligible: number; aligned: number; notAssessed: number; notEligible: number; notAssessedWithinCap: boolean }>;
  for (const k of ["turnover", "capex", "opex"] as KpiKey[]) {
    const total = totals[k];
    const sum = (filter: (a: TaxonomyActivity) => boolean) => acts.filter(filter).reduce((s, a) => s + Math.max(0, a[k]), 0);
    const notAssessed = sum((a) => a.eligible && notAssessedIds.includes(a.id));
    const eligible = sum((a) => a.eligible && !notAssessedIds.includes(a.id));
    const aligned = sum((a) => a.eligible && a.aligned && !notAssessedIds.includes(a.id));
    out[k] = {
      eligible: safeDiv(eligible, total),
      aligned: safeDiv(aligned, total),
      notAssessed: safeDiv(notAssessed, total),
      notEligible: Math.max(0, 1 - safeDiv(eligible + notAssessed, total)),
      notAssessedWithinCap: safeDiv(notAssessed, total) < 0.1,
    };
  }
  return out;
}

// --- Double materiality -------------------------------------------------------
export type MaterialityTopic = {
  id: string;
  /** Impact: scale, scope, irremediability (1–5); likelihood 1–5 (5 = actual impact). */
  scale: number;
  scope: number;
  irremediability: number;
  impactLikelihood: number;
  /** Financial: magnitude 1–5, likelihood 1–5. */
  magnitude: number;
  financialLikelihood: number;
  positive: boolean;
};

export function impactScore(t: MaterialityTopic): number {
  // Positive impacts have no irremediability dimension (ESRS 1 AR).
  const sev = t.positive ? (t.scale + t.scope) / 2 : (t.scale + t.scope + t.irremediability) / 3;
  // Actual impacts (likelihood 5) are scored on severity alone; potential ones are weighted by likelihood.
  return t.impactLikelihood >= 5 ? sev : (sev * t.impactLikelihood) / 5;
}

export function financialScore(t: MaterialityTopic): number {
  return (t.magnitude * t.financialLikelihood) / 5;
}

export function classify(t: MaterialityTopic, threshold: number) {
  const impact = impactScore(t);
  const financial = financialScore(t);
  const im = impact >= threshold;
  const fm = financial >= threshold;
  return { impact, financial, material: im || fm, kind: im && fm ? "double" : im ? "impact" : fm ? "financial" : "none" } as const;
}
