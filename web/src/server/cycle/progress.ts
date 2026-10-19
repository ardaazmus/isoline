/**
 * Signals for the seven cycle steps (./steps.ts), gathered for any number of cycles in a fixed number of grouped
 * queries — the home page and a consultant's portfolio of twenty clients cost the same dozen round trips. Runs under
 * the caller's RLS context: a person only ever counts rows they may see.
 */
import { sql } from "kysely";
import { withActor, type Actor, type Tx } from "../db/client";
import { requireProjectAction } from "../tenancy/service";
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

/** Signals per cycle id. */
export async function signalsFor(tx: Tx, cycles: CycleRef[]): Promise<Map<string, Signals>> {
  const out = new Map(cycles.map((c) => [c.id, empty(c.status)]));
  if (!cycles.length) return out;
  const ids = cycles.map((c) => c.id);
  const day = today();
  const get = (id: string) => out.get(id)!;

  const req = await tx
    .selectFrom("core.data_requests")
    .select([
      "cycle_id",
      sql<number>`count(*)::int`.as("total"),
      sql<number>`count(*) filter (where status = 'accepted')::int`.as("accepted"),
      sql<number>`count(*) filter (where status in ('not_applicable','withdrawn'))::int`.as("closed"),
      sql<number>`count(*) filter (where status not in ('accepted','withdrawn','not_applicable'))::int`.as("open"),
      sql<number>`count(*) filter (where status in ('submitted','reviewing'))::int`.as("in_review"),
      sql<number>`count(*) filter (where status = 'revision_required')::int`.as("returned"),
      sql<number>`count(*) filter (where status not in ('accepted','withdrawn','not_applicable') and due_on < ${day}::date)::int`.as("overdue"),
    ])
    .where("cycle_id", "in", ids)
    .groupBy("cycle_id")
    .execute();
  for (const r of req) get(r.cycle_id).requests = { total: r.total, accepted: r.accepted, closed: r.closed, open: r.open, inReview: r.in_review, returned: r.returned, overdue: r.overdue };

  const bnd = await tx.selectFrom("core.reporting_boundaries").select(["cycle_id", "kind", "status"]).where("cycle_id", "in", ids).execute();
  for (const b of bnd) {
    const s = get(b.cycle_id);
    s.boundaries.any += 1;
    if (b.status === "approved" && b.kind.startsWith("ghg_")) s.boundaries.ghgApproved = true;
  }
  const fin = await tx
    .selectFrom("core.reporting_boundaries as b")
    .innerJoin("core.boundary_members as m", "m.boundary_id", "b.id")
    .select(["b.cycle_id", sql<number>`count(*)::int`.as("n")])
    .where("b.cycle_id", "in", ids)
    .where("b.kind", "=", "financial_reporting")
    .where("b.status", "=", "approved")
    .where("m.legal_entity_id", "is not", null)
    .where("m.inclusion_pct", ">", "0")
    .groupBy("b.cycle_id")
    .execute();
  for (const f of fin) get(f.cycle_id).boundaries.financialMembers = f.n;

  const app = await tx
    .selectFrom("core.applicability_assessments")
    .select([
      "cycle_id",
      sql<number>`count(*)::int`.as("total"),
      sql<number>`count(*) filter (where decision is null)::int`.as("undecided"),
      sql<number>`count(*) filter (where decision is not null and confirmed_at is null)::int`.as("unconfirmed"),
    ])
    .where("cycle_id", "in", ids)
    .where("superseded_at", "is", null)
    .groupBy("cycle_id")
    .execute();
  for (const a of app) get(a.cycle_id).applicability = { total: a.total, undecided: a.undecided, unconfirmed: a.unconfirmed };

  // current facts: the newest revision per key that is not superseded or rejected (same rule as the close)
  const facts = await tx
    .selectFrom("core.metric_fact_versions")
    .select(["cycle_id", "metric_key", "facility_id", "boundary_kind", "status"])
    .where("cycle_id", "in", ids)
    .where("status", "not in", ["superseded", "rejected"])
    .orderBy("revision", "desc")
    .execute();
  const seen = new Set<string>();
  for (const f of facts) {
    const k = `${f.cycle_id}|${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const s = get(f.cycle_id).facts;
    s.current += 1;
    if (f.status !== "approved" && f.status !== "locked") s.notApproved += 1;
    if (f.status === "ready_for_review") s.readyForReview += 1;
    if (f.metric_key === "finance.consolidated_net_sales") s.consolidatedRevenue = true;
  }

  const issues = await tx
    .selectFrom("core.quality_issues as i")
    .leftJoin("core.calculation_runs as r", "r.id", "i.run_id")
    .select(["i.cycle_id", "i.severity", sql<boolean>`coalesce(r.kind = 'reconciliation', false)`.as("control"), sql<number>`count(*)::int`.as("n")])
    .where("i.cycle_id", "in", ids)
    .where("i.status", "=", "open")
    .groupBy(["i.cycle_id", "i.severity", sql`coalesce(r.kind = 'reconciliation', false)`])
    .execute();
  for (const i of issues) {
    const s = get(i.cycle_id).issues;
    const blocker = i.severity === "blocker";
    if (i.control && blocker) s.controlBlockers += i.n;
    else if (i.control) s.controlWarnings += i.n;
    else if (blocker) s.calcBlockers += i.n;
    else s.calcWarnings += i.n;
  }

  const runs = await tx
    .selectFrom("core.calculation_runs")
    .select(["cycle_id", sql<Date | null>`max(performed_at) filter (where kind <> 'reconciliation' and mode = 'final')`.as("last_calc"), sql<Date | null>`max(performed_at) filter (where kind = 'reconciliation')`.as("last_rec")])
    .where("cycle_id", "in", ids)
    .groupBy("cycle_id")
    .execute();
  for (const r of runs) get(r.cycle_id).runs = { lastCalcAt: isoOf(r.last_calc), lastReconciliationAt: isoOf(r.last_rec) };

  const fins = await tx.selectFrom("core.entity_financials").select(["cycle_id", sql<number>`count(*)::int`.as("n")]).where("cycle_id", "in", ids).where("status", "=", "submitted").groupBy("cycle_id").execute();
  const elim = await tx.selectFrom("core.intercompany_eliminations").select(["cycle_id", sql<number>`count(*)::int`.as("n")]).where("cycle_id", "in", ids).where("status", "=", "submitted").groupBy("cycle_id").execute();
  for (const r of [...fins, ...elim]) get(r.cycle_id).consolidation.pendingInputs += r.n;

  const snaps = await tx.selectFrom("core.cycle_snapshots").select(["cycle_id", sql<number>`count(*)::int`.as("n")]).where("cycle_id", "in", ids).groupBy("cycle_id").execute();
  for (const r of snaps) get(r.cycle_id).close.snapshots = r.n;

  const reports = await tx
    .selectFrom("core.reports as r")
    .select([
      "r.cycle_id",
      "r.status",
      sql<number>`(select count(*)::int from core.report_sections s where s.report_id = r.id)`.as("sections"),
      sql<number>`(select count(*)::int from core.report_sections s where s.report_id = r.id and s.status = 'approved')`.as("approved"),
      sql<boolean>`exists (select 1 from core.report_releases x where x.report_id = r.id)`.as("released"),
    ])
    .where("r.cycle_id", "in", ids)
    .execute();
  for (const r of reports) {
    const s = get(r.cycle_id).reports;
    s.total += 1;
    s.sections += r.sections;
    s.approvedSections += r.approved;
    if (["tech_review", "customer_review", "management_signoff"].includes(r.status)) s.inChain += 1;
    if (r.released || r.status === "released") s.released += 1;
  }

  const eng = await tx.selectFrom("core.assurance_engagements").select(["cycle_id", "status", "created_at"]).where("cycle_id", "in", ids).orderBy("created_at", "desc").execute();
  for (const e of eng) if (get(e.cycle_id).assurance.status === null) get(e.cycle_id).assurance.status = e.status;
  const qs = await tx
    .selectFrom("core.assurance_questions")
    .select(["cycle_id", sql<number>`count(*) filter (where status = 'open')::int`.as("open"), sql<number>`count(*) filter (where status = 'answered')::int`.as("answered")])
    .where("cycle_id", "in", ids)
    .groupBy("cycle_id")
    .execute();
  for (const q of qs) Object.assign(get(q.cycle_id).assurance, { openQuestions: q.open, answeredQuestions: q.answered });

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
    const cycles = await tx
      .selectFrom("core.reporting_cycles as c")
      .select(["c.id", "c.project_id", "c.status", "c.label", "c.period_end", "c.publish_due"])
      .where(sql<boolean>`c.period_end = (select max(x.period_end) from core.reporting_cycles x where x.project_id = c.project_id)`)
      .execute();
    const prog = await progressFor(tx, cycles);
    return new Map(cycles.map((c) => [c.project_id, { projectId: c.project_id, cycle: { id: c.id, label: c.label, status: c.status, period_end: c.period_end, publish_due: c.publish_due }, progress: prog.get(c.id)! }]));
  });
}
