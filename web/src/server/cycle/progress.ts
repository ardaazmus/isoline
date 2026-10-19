/**
 * Signals for the seven cycle steps (./steps.ts), gathered for any number of cycles in a fixed number of grouped
 * queries — the home page and a consultant's portfolio of twenty clients cost the same dozen round trips. Runs under
 * the caller's RLS context: a person only ever counts rows they may see.
 */
import { sql } from "kysely";
import { withActor, type Actor, type Tx } from "../db/client";
import { reachableProjectIds, requireProjectAction } from "../tenancy/service";
import { closeChecklistFrom, deriveSteps, STEP_GATES, STEP_IDS, type ChecklistItem, type Signals, type Step, type StepId } from "./steps";

export type CycleRef = { id: string; project_id: string; status: string };
export type StepPlan = { startsOn: string | null; dueOn: string | null; owner: string | null; late: boolean };
export type StepView = Step & StepPlan;
export type CycleProgress = { cycleId: string; projectId: string; signals: Signals; steps: StepView[]; current: StepId | "complete"; checklist: { items: ChecklistItem[]; canFreeze: boolean } };

const today = () => new Date().toISOString().slice(0, 10);
const isoOf = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);

const empty = (status: string): Signals => ({
  cycleStatus: status,
  boundaries: { ghgApproved: false, any: 0, financialMembers: 0 },
  applicability: { total: 0, undecided: 0, unconfirmed: 0 },
  requests: { total: 0, accepted: 0, closed: 0, open: 0, inReview: 0, returned: 0, overdue: 0 },
  facts: { current: 0, notApproved: 0, readyForReview: 0, consolidatedRevenue: false },
  issues: { calcBlockers: 0, calcWarnings: 0, controlBlockers: 0, controlWarnings: 0 },
  runs: { lastCalcAt: null, lastReconciliationAt: null },
  consolidation: { pendingInputs: 0 },
  close: { snapshots: 0 },
  reports: { total: 0, sections: 0, approvedSections: 0, inChain: 0, released: 0 },
  assurance: { status: null, openQuestions: 0, answeredQuestions: 0 },
});

type SignalRow = {
  cycle_id: string;
  req_total: number | null;
  req_accepted: number | null;
  req_closed: number | null;
  req_open: number | null;
  req_in_review: number | null;
  req_returned: number | null;
  req_overdue: number | null;
  bnd_any: number | null;
  ghg_approved: boolean | null;
  fin_members: number | null;
  app_total: number | null;
  app_undecided: number | null;
  app_unconfirmed: number | null;
  facts_current: number | null;
  facts_not_approved: number | null;
  facts_ready: number | null;
  facts_revenue: boolean | null;
  calc_blockers: number | null;
  calc_warnings: number | null;
  control_blockers: number | null;
  control_warnings: number | null;
  last_calc: Date | null;
  last_rec: Date | null;
  pending_inputs: number | null;
  snapshots: number | null;
  rep_total: number | null;
  rep_sections: number | null;
  rep_approved: number | null;
  rep_in_chain: number | null;
  rep_released: number | null;
  assurance_status: string | null;
  q_open: number | null;
  q_answered: number | null;
};

/**
 * Signals per cycle id, in one statement: under load every round trip waits its turn at the database, so the step
 * bar of each project page costs one query instead of fourteen. Each aggregate is filtered by the cycle ids itself
 * (a parameter, so the planner sees the real ids).
 */
export async function signalsFor(tx: Tx, cycles: CycleRef[]): Promise<Map<string, Signals>> {
  const out = new Map(cycles.map((c) => [c.id, empty(c.status)]));
  if (!cycles.length) return out;
  const ids = cycles.map((c) => c.id);
  const idArray = sql`${ids}::uuid[]`;
  const { rows } = await sql<SignalRow>`
    with req as (
      select cycle_id,
        count(*)::int as total,
        count(*) filter (where status = 'accepted')::int as accepted,
        count(*) filter (where status in ('not_applicable','withdrawn'))::int as closed,
        count(*) filter (where status not in ('accepted','withdrawn','not_applicable'))::int as open,
        count(*) filter (where status in ('submitted','reviewing'))::int as in_review,
        count(*) filter (where status = 'revision_required')::int as returned,
        count(*) filter (where status not in ('accepted','withdrawn','not_applicable') and due_on < ${today()}::date)::int as overdue
      from core.data_requests where cycle_id = any(${idArray}) group by cycle_id
    ), bnd as (
      select cycle_id, count(*)::int as n, bool_or(status = 'approved' and left(kind, 4) = 'ghg_') as ghg_approved
      from core.reporting_boundaries where cycle_id = any(${idArray}) group by cycle_id
    ), fin as (
      select b.cycle_id, count(*)::int as n
      from core.reporting_boundaries b join core.boundary_members m on m.boundary_id = b.id
      where b.cycle_id = any(${idArray}) and b.kind = 'financial_reporting' and b.status = 'approved' and m.legal_entity_id is not null and m.inclusion_pct > 0
      group by b.cycle_id
    ), app as (
      select cycle_id,
        count(*)::int as total,
        count(*) filter (where decision is null)::int as undecided,
        count(*) filter (where decision is not null and confirmed_at is null)::int as unconfirmed
      from core.applicability_assessments where cycle_id = any(${idArray}) and superseded_at is null group by cycle_id
    ), cur as (
      -- current facts: the newest revision per key that is not superseded or rejected (same rule as the close)
      select distinct on (cycle_id, metric_key, facility_id, boundary_kind) cycle_id, metric_key, status
      from core.metric_fact_versions where cycle_id = any(${idArray}) and status not in ('superseded','rejected')
      order by cycle_id, metric_key, facility_id, boundary_kind, revision desc
    ), facts as (
      select cycle_id,
        count(*)::int as current,
        count(*) filter (where status not in ('approved','locked'))::int as not_approved,
        count(*) filter (where status = 'ready_for_review')::int as ready,
        bool_or(metric_key = 'finance.consolidated_net_sales') as revenue
      from cur group by cycle_id
    ), iss as (
      select i.cycle_id,
        count(*) filter (where r.kind = 'reconciliation' and i.severity = 'blocker')::int as control_blockers,
        count(*) filter (where r.kind = 'reconciliation' and i.severity <> 'blocker')::int as control_warnings,
        count(*) filter (where r.kind is distinct from 'reconciliation' and i.severity = 'blocker')::int as calc_blockers,
        count(*) filter (where r.kind is distinct from 'reconciliation' and i.severity <> 'blocker')::int as calc_warnings
      from core.quality_issues i left join core.calculation_runs r on r.id = i.run_id
      where i.cycle_id = any(${idArray}) and i.status = 'open' group by i.cycle_id
    ), runs as (
      select cycle_id,
        max(performed_at) filter (where kind <> 'reconciliation' and mode = 'final') as last_calc,
        max(performed_at) filter (where kind = 'reconciliation') as last_rec
      from core.calculation_runs where cycle_id = any(${idArray}) group by cycle_id
    ), pend as (
      select cycle_id, count(*)::int as n from (
        select cycle_id from core.entity_financials where cycle_id = any(${idArray}) and status = 'submitted'
        union all
        select cycle_id from core.intercompany_eliminations where cycle_id = any(${idArray}) and status = 'submitted'
      ) x group by cycle_id
    ), snaps as (
      select cycle_id, count(*)::int as n from core.cycle_snapshots where cycle_id = any(${idArray}) group by cycle_id
    ), rep as (
      select r.cycle_id,
        count(*)::int as total,
        sum(s.n)::int as sections,
        sum(s.approved)::int as approved,
        count(*) filter (where r.status in ('tech_review','customer_review','management_signoff'))::int as in_chain,
        count(*) filter (where r.status = 'released' or x.released)::int as released
      from core.reports r
      cross join lateral (select count(*) as n, count(*) filter (where status = 'approved') as approved from core.report_sections where report_id = r.id) s
      cross join lateral (select exists (select 1 from core.report_releases where report_id = r.id) as released) x
      where r.cycle_id = any(${idArray}) group by r.cycle_id
    ), eng as (
      select distinct on (cycle_id) cycle_id, status from core.assurance_engagements where cycle_id = any(${idArray}) order by cycle_id, created_at desc
    ), qs as (
      select cycle_id, count(*) filter (where status = 'open')::int as open, count(*) filter (where status = 'answered')::int as answered
      from core.assurance_questions where cycle_id = any(${idArray}) group by cycle_id
    )
    select c.id as cycle_id,
      req.total as req_total, req.accepted as req_accepted, req.closed as req_closed, req.open as req_open,
      req.in_review as req_in_review, req.returned as req_returned, req.overdue as req_overdue,
      bnd.n as bnd_any, bnd.ghg_approved, fin.n as fin_members,
      app.total as app_total, app.undecided as app_undecided, app.unconfirmed as app_unconfirmed,
      facts.current as facts_current, facts.not_approved as facts_not_approved, facts.ready as facts_ready, facts.revenue as facts_revenue,
      iss.calc_blockers, iss.calc_warnings, iss.control_blockers, iss.control_warnings,
      runs.last_calc, runs.last_rec, pend.n as pending_inputs, snaps.n as snapshots,
      rep.total as rep_total, rep.sections as rep_sections, rep.approved as rep_approved, rep.in_chain as rep_in_chain, rep.released as rep_released,
      eng.status as assurance_status, qs.open as q_open, qs.answered as q_answered
    from unnest(${idArray}) as c(id)
    left join req on req.cycle_id = c.id left join bnd on bnd.cycle_id = c.id left join fin on fin.cycle_id = c.id
    left join app on app.cycle_id = c.id left join facts on facts.cycle_id = c.id left join iss on iss.cycle_id = c.id
    left join runs on runs.cycle_id = c.id left join pend on pend.cycle_id = c.id left join snaps on snaps.cycle_id = c.id
    left join rep on rep.cycle_id = c.id left join eng on eng.cycle_id = c.id left join qs on qs.cycle_id = c.id
  `.execute(tx);
  const n = (v: number | null) => v ?? 0;
  for (const r of rows) {
    const s = out.get(r.cycle_id);
    if (!s) continue;
    s.requests = { total: n(r.req_total), accepted: n(r.req_accepted), closed: n(r.req_closed), open: n(r.req_open), inReview: n(r.req_in_review), returned: n(r.req_returned), overdue: n(r.req_overdue) };
    s.boundaries = { ghgApproved: r.ghg_approved === true, any: n(r.bnd_any), financialMembers: n(r.fin_members) };
    s.applicability = { total: n(r.app_total), undecided: n(r.app_undecided), unconfirmed: n(r.app_unconfirmed) };
    s.facts = { current: n(r.facts_current), notApproved: n(r.facts_not_approved), readyForReview: n(r.facts_ready), consolidatedRevenue: r.facts_revenue === true };
    s.issues = { calcBlockers: n(r.calc_blockers), calcWarnings: n(r.calc_warnings), controlBlockers: n(r.control_blockers), controlWarnings: n(r.control_warnings) };
    s.runs = { lastCalcAt: isoOf(r.last_calc), lastReconciliationAt: isoOf(r.last_rec) };
    s.consolidation = { pendingInputs: n(r.pending_inputs) };
    s.close = { snapshots: n(r.snapshots) };
    s.reports = { total: n(r.rep_total), sections: n(r.rep_sections), approvedSections: n(r.rep_approved), inChain: n(r.rep_in_chain), released: n(r.rep_released) };
    s.assurance = { status: r.assurance_status, openQuestions: n(r.q_open), answeredQuestions: n(r.q_answered) };
  }
  return out;
}

/** Dates and owner of each step from the plan's work packages; a step is late when its due date passed undone. */
async function plansFor(tx: Tx, ids: string[]): Promise<Map<string, Map<StepId, Omit<StepPlan, "late">>>> {
  const out = new Map<string, Map<StepId, Omit<StepPlan, "late">>>();
  if (!ids.length) return out;
  const wps = await tx
    .selectFrom("core.work_packages as w")
    .leftJoin("user as u", "u.id", "w.responsible_user_id")
    .select(["w.cycle_id", "w.gate", "w.starts_on", "w.due_on", "u.name as responsible"])
    .where("w.cycle_id", "in", ids)
    .execute();
  for (const id of ids) {
    const mine = wps.filter((w) => w.cycle_id === id);
    const m = new Map<StepId, Omit<StepPlan, "late">>();
    for (const step of STEP_IDS) {
      const g = mine.filter((w) => STEP_GATES[step].includes(w.gate));
      if (!g.length) {
        m.set(step, { startsOn: null, dueOn: null, owner: null });
        continue;
      }
      const owners = STEP_GATES[step]
        .slice()
        .reverse()
        .map((gate) => g.find((w) => w.gate === gate)?.responsible)
        .filter(Boolean) as string[];
      m.set(step, { startsOn: g.map((w) => w.starts_on).sort()[0], dueOn: g.map((w) => w.due_on).sort().at(-1)!, owner: owners[0] ?? null });
    }
    out.set(id, m);
  }
  return out;
}

export async function progressFor(tx: Tx, cycles: CycleRef[]): Promise<Map<string, CycleProgress>> {
  // one connection per transaction: run the two lookups one after the other
  const signals = await signalsFor(tx, cycles);
  const plans = await plansFor(tx, cycles.map((c) => c.id));
  const day = today();
  const out = new Map<string, CycleProgress>();
  for (const c of cycles) {
    const s = signals.get(c.id)!;
    const d = deriveSteps(s);
    const plan = plans.get(c.id);
    const steps = d.steps.map((step) => {
      const p = plan?.get(step.id) ?? { startsOn: null, dueOn: null, owner: null };
      return { ...step, ...p, late: Boolean(p.dueOn && p.dueOn < day && step.state !== "done" && step.state !== "optional") };
    });
    out.set(c.id, { cycleId: c.id, projectId: c.project_id, signals: s, steps, current: d.current, checklist: closeChecklistFrom(s) });
  }
  return out;
}

/** One cycle's progress, for anyone who may read the project. */
export async function cycleProgress(actor: Actor, cycleId: string): Promise<CycleProgress | null> {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "status"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) return null;
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    return (await progressFor(tx, [c])).get(c.id) ?? null;
  });
}

export type ProjectCycle = { projectId: string; cycle: { id: string; label: string; status: string; period_end: string; publish_due: string | null }; progress: CycleProgress };

/** The newest cycle of every project this workspace can see, with its progress (home page and portfolio). */
export async function latestCycles(actor: Actor): Promise<Map<string, ProjectCycle>> {
  return withActor(actor, async (tx) => {
    // only the projects this workspace can reach: RLS would hide the rest anyway, but would still evaluate them
    const reachable = await reachableProjectIds(tx, actor);
    if (!reachable.length) return new Map();
    const cycles = await tx
      .selectFrom("core.reporting_cycles as c")
      .select(["c.id", "c.project_id", "c.status", "c.label", "c.period_end", "c.publish_due"])
      .where("c.project_id", "in", reachable)
      .where(sql<boolean>`c.period_end = (select max(x.period_end) from core.reporting_cycles x where x.project_id = c.project_id)`)
      .execute();
    const prog = await progressFor(tx, cycles);
    return new Map(cycles.map((c) => [c.project_id, { projectId: c.project_id, cycle: { id: c.id, label: c.label, status: c.status, period_end: c.period_end, publish_due: c.publish_due }, progress: prog.get(c.id)! }]));
  });
}
