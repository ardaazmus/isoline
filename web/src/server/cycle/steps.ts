/**
 * The reporting cycle as seven steps (UX review 19.10.2026, ADR-011 update): scope → data collection → calculation
 * and approval → controls and consolidation → period close → report → assurance. Each step's state is derived from
 * what is actually recorded — nobody marks a step done by hand — so the home page, the portfolio, the project
 * stepper and the close checklist cannot disagree. Pure: the signals are gathered by ./progress.ts.
 *
 * The order is shown, not forced (NN/g on wizards): only real gates stop work — the close needs its checklist, and a
 * step with nothing to work on yet is "waiting". Report writing may run alongside data collection.
 */

export const STEP_IDS = ["scope", "collect", "calculate", "controls", "close", "report", "assurance"] as const;
export type StepId = (typeof STEP_IDS)[number];

/**
 * done: finished by the record · active: work in progress · blocked: a blocker stops it · ready: nothing in the way,
 * the next action can start · waiting: depends on an earlier step · not_started: nothing yet · optional: not part of
 * this cycle unless someone sets it up (assurance).
 */
export type StepState = "done" | "active" | "blocked" | "ready" | "waiting" | "not_started" | "optional";

export type Signals = {
  cycleStatus: string;
  boundaries: { ghgApproved: boolean; any: number; financialMembers: number };
  applicability: { total: number; undecided: number; unconfirmed: number };
  requests: { total: number; accepted: number; closed: number; open: number; inReview: number; returned: number; overdue: number };
  facts: { current: number; notApproved: number; readyForReview: number; consolidatedRevenue: boolean };
  issues: { calcBlockers: number; calcWarnings: number; controlBlockers: number; controlWarnings: number };
  runs: { lastCalcAt: string | null; lastReconciliationAt: string | null };
  consolidation: { pendingInputs: number };
  close: { snapshots: number };
  reports: { total: number; sections: number; approvedSections: number; inChain: number; released: number };
  assurance: { status: string | null; openQuestions: number; answeredQuestions: number };
};

export type Step = { id: StepId; state: StepState; summary: string; vars: Record<string, number> };

export type ChecklistItem = { id: string; ok: boolean; required: boolean; count?: number };

const FROZEN = ["frozen", "released"];

/** The consolidation run is needed once more than one legal entity is in the approved financial boundary. */
const needsConsolidation = (s: Signals) => s.boundaries.financialMembers > 1;
const reconciliationCurrent = (s: Signals) => Boolean(s.runs.lastReconciliationAt) && (!s.runs.lastCalcAt || s.runs.lastReconciliationAt! >= s.runs.lastCalcAt);

/**
 * The period-close checklist (G5-04) from the same signals as the steps: one definition for "may this cycle be
 * frozen", used by the close screen, the freeze itself and the stepper.
 */
export function closeChecklistFrom(s: Signals): { items: ChecklistItem[]; canFreeze: boolean } {
  const items: ChecklistItem[] = [
    { id: "requests_closed", ok: s.requests.open === 0, required: true, count: s.requests.open },
    { id: "boundary_approved", ok: s.boundaries.ghgApproved, required: true },
    { id: "facts_exist", ok: s.facts.current > 0, required: true, count: s.facts.current },
    { id: "facts_approved", ok: s.facts.current > 0 && s.facts.notApproved === 0, required: true, count: s.facts.notApproved },
    { id: "no_open_blockers", ok: s.issues.calcBlockers + s.issues.controlBlockers === 0, required: true, count: s.issues.calcBlockers + s.issues.controlBlockers },
    { id: "warnings_dispositioned", ok: s.issues.calcWarnings + s.issues.controlWarnings === 0, required: true, count: s.issues.calcWarnings + s.issues.controlWarnings },
    { id: "reconciliation_current", ok: reconciliationCurrent(s), required: true },
  ];
  if (needsConsolidation(s)) items.push({ id: "consolidation_done", ok: s.facts.consolidatedRevenue, required: true });
  items.push({ id: "scope_confirmed", ok: s.applicability.unconfirmed === 0, required: false, count: s.applicability.unconfirmed });
  return { items, canFreeze: items.every((i) => !i.required || i.ok) };
}

function scope(s: Signals): Step {
  const vars = { unconfirmed: s.applicability.unconfirmed, undecided: s.applicability.undecided };
  if (s.boundaries.ghgApproved) return { id: "scope", state: "done", summary: s.applicability.unconfirmed ? "done_unconfirmed" : "done", vars };
  if (s.boundaries.any > 0 || s.applicability.total > 0) return { id: "scope", state: "active", summary: "boundary_pending", vars };
  return { id: "scope", state: "not_started", summary: "not_started", vars };
}

function collect(s: Signals, scopeDone: boolean): Step {
  const r = s.requests;
  const vars = { done: r.accepted + r.closed, total: r.total, inReview: r.inReview, returned: r.returned, overdue: r.overdue };
  if (r.total === 0) return { id: "collect", state: scopeDone ? "ready" : "not_started", summary: "no_requests", vars };
  if (r.open === 0) return { id: "collect", state: "done", summary: "done", vars };
  return { id: "collect", state: "active", summary: r.overdue ? "active_overdue" : "active", vars };
}

function calculate(s: Signals, collectDone: boolean): Step {
  const vars = { facts: s.facts.current, waiting: s.facts.notApproved, warnings: s.issues.calcWarnings, blockers: s.issues.calcBlockers };
  if (s.facts.current === 0) return { id: "calculate", state: collectDone ? "ready" : "waiting", summary: "no_facts", vars };
  if (s.issues.calcBlockers > 0) return { id: "calculate", state: "blocked", summary: "blocked", vars };
  if (s.facts.notApproved === 0 && s.issues.calcWarnings === 0) return { id: "calculate", state: "done", summary: "done", vars };
  return { id: "calculate", state: "active", summary: "active", vars };
}

function controls(s: Signals): Step {
  const consolidate = needsConsolidation(s);
  const vars = { pending: s.consolidation.pendingInputs, blockers: s.issues.controlBlockers, warnings: s.issues.controlWarnings };
  if (s.facts.current === 0) return { id: "controls", state: "waiting", summary: "waiting", vars };
  if (s.issues.controlBlockers > 0) return { id: "controls", state: "blocked", summary: "blocked", vars };
  const consolidated = !consolidate || s.facts.consolidatedRevenue;
  if (reconciliationCurrent(s) && consolidated && s.issues.controlWarnings === 0) return { id: "controls", state: "done", summary: "done", vars };
  return { id: "controls", state: "active", summary: !consolidated ? (s.consolidation.pendingInputs ? "todo_inputs" : "todo_consolidate") : !reconciliationCurrent(s) ? "todo_reconcile" : "warnings", vars };
}

function close(s: Signals): Step {
  const c = closeChecklistFrom(s);
  const missing = c.items.filter((i) => i.required && !i.ok).length;
  const vars = { missing, snapshots: s.close.snapshots };
  if (FROZEN.includes(s.cycleStatus)) return { id: "close", state: "done", summary: "done", vars };
  if (c.canFreeze) return { id: "close", state: "ready", summary: s.cycleStatus === "reopened" ? "reopened_ready" : "ready", vars };
  return { id: "close", state: s.cycleStatus === "reopened" ? "active" : "waiting", summary: s.cycleStatus === "reopened" ? "reopened" : "waiting", vars };
}

function report(s: Signals, scopeDone: boolean): Step {
  const r = s.reports;
  const vars = { reports: r.total, sections: r.sections, approved: r.approvedSections, inChain: r.inChain, released: r.released };
  if (r.total === 0) return { id: "report", state: scopeDone ? "ready" : "not_started", summary: "no_reports", vars };
  if (r.released >= r.total) return { id: "report", state: "done", summary: "done", vars };
  return { id: "report", state: "active", summary: r.inChain ? "in_chain" : "drafting", vars };
}

function assurance(s: Signals): Step {
  const a = s.assurance;
  const vars = { open: a.openQuestions, answered: a.answeredQuestions };
  if (!a.status || a.status === "withdrawn") return { id: "assurance", state: "optional", summary: "optional", vars };
  if (a.status === "opinion_received") return { id: "assurance", state: "done", summary: "done", vars };
  return { id: "assurance", state: "active", summary: a.openQuestions ? "open_questions" : "active", vars };
}

/** Every step's state and the step to look at now: the first one in order that is not done. */
export function deriveSteps(s: Signals): { steps: Step[]; current: StepId | "complete" } {
  const sc = scope(s);
  const co = collect(s, sc.state === "done");
  const ca = calculate(s, co.state === "done");
  const steps = [sc, co, ca, controls(s), close(s), report(s, sc.state === "done"), assurance(s)];
  const main = steps.filter((x) => x.id !== "assurance");
  const first = main.find((x) => x.state !== "done");
  const as = steps[6];
  const current: StepId | "complete" = first ? first.id : as.state === "active" ? "assurance" : "complete";
  return { steps, current };
}

/** Which plan gates (G2-08 work packages) carry each step's dates and owner. */
export const STEP_GATES: Record<StepId, string[]> = {
  scope: ["G0", "G1", "G2", "G3", "G4"],
  collect: ["G5", "G6"],
  calculate: ["G7"],
  controls: ["G8"],
  close: ["G9"],
  report: ["G10", "G12"],
  assurance: ["G11"],
};

export const stepOfGate = (gate: string): StepId | null => (Object.entries(STEP_GATES).find(([, g]) => g.includes(gate))?.[0] as StepId | undefined) ?? null;

/** The project pages that belong to each step (the first one is the step's own page). */
export const STEP_PAGES: Record<StepId, string[]> = {
  scope: ["scope"],
  collect: ["data", "evidence"],
  calculate: ["calculations"],
  controls: ["consolidation", "controls"],
  close: ["close"],
  report: ["reports"],
  assurance: ["assurance"],
};

export const SETUP_PAGES = ["setup", "plan", "participants", "industry", "connectors"] as const;
