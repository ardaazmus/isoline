/**
 * Consolidation, controls and period close (G5; plan 05 G9, plan 09 §8–9).
 *
 *   - Financial consolidation inputs: revenue per legal entity and intercompany sales, each entered by one person and
 *     approved by another; the consolidation run applies IFRS 10 on the approved financial reporting boundary.
 *   - Reconciliation run: the U1–U5 cross-checks over the cycle's facts; failures become quality findings.
 *   - Close checklist: every condition for freezing with its reason; the server checks it again on freeze.
 *   - Freeze: the approved facts are copied into an immutable snapshot (content digest) and locked; the cycle stops
 *     accepting data, runs and approvals. Reopen needs a reason; corrections become new revisions and a new
 *     snapshot that lists what was restated — the earlier snapshot never changes.
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { audit, canonicalJson } from "../audit/audit";
import { withActor, type Actor, type Tx } from "../db/client";
import { plainDecimal } from "../data/units";
import { forbidden, HttpError, notFound, type Action } from "../policy/policy";
import { projectsAllowing, reachableProjectIds, requireProjectAction } from "../tenancy/service";
import { issueCounts, recordIssues, supersedeOpenIssues, writeFacts, type RunRef } from "../calc/service";
import { consolidateRevenue } from "./consolidation";
import { reconcile, RECONCILE_VERSION } from "./reconcile";
import { signalsFor } from "../cycle/progress";
import { SHEETS } from "../worksheets/schemas";
import { approvedFacts } from "../worksheets/service";
import { closeChecklistFrom } from "../cycle/steps";

export const CONSOLIDATION_VERSION = "consolidation-ifrs10-2026.10.19";
const NO_FACTORS = createHash("sha256").update("[]").digest("hex");
const sha = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");

const FROZEN = ["frozen", "released"];

async function cycleFor(tx: Tx, actor: Actor, cycleId: string, action: Action) {
  const c = await tx.selectFrom("core.reporting_cycles").selectAll().where("id", "=", cycleId).executeTakeFirst();
  if (!c) throw notFound("cycle_not_found");
  const access = await requireProjectAction(tx, actor, c.project_id, action);
  return { cycle: c, access };
}

const assertOpen = (status: string) => {
  if (FROZEN.includes(status)) throw new HttpError(409, "cycle_frozen");
};

/** numeric(38,2) string from what a person typed ("1.250.000,50", 1250000.5); more than two decimals is refused. */
function amount(v: string | number): string {
  const d = plainDecimal(v);
  if (d === null || d.startsWith("-")) throw new HttpError(422, "invalid_amount");
  if (!/^\d+(\.\d{1,2})?$/.test(d)) throw new HttpError(422, "invalid_amount");
  return d;
}

// ---------------------------------------------------------------- consolidation inputs (G5-02)

export async function submitEntityFinancial(actor: Actor, cycleId: string, input: { legalEntityId: string; netSales: string | number; evidenceId?: string | null; note?: string | null }): Promise<{ id: string }> {
  const netSales = amount(input.netSales);
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "data.submit");
    assertOpen(cycle.status);
    const ent = await tx.selectFrom("core.legal_entities").select("id").where("id", "=", input.legalEntityId).where("owner_tenant_id", "=", cycle.owner_tenant_id).executeTakeFirst();
    if (!ent) throw notFound("entity_not_found");
    await tx.updateTable("core.entity_financials").set({ status: "superseded" }).where("cycle_id", "=", cycleId).where("legal_entity_id", "=", input.legalEntityId).where("status", "in", ["submitted", "approved"]).execute();
    const r = await tx
      .insertInto("core.entity_financials")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, legal_entity_id: input.legalEntityId, net_sales: netSales, evidence_id: input.evidenceId ?? null, note: input.note?.trim() || null, entered_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "consolidation.financial_submit", objectType: "entity_financial", objectId: r.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { entity: input.legalEntityId, netSales } });
    return { id: r.id };
  });
}

export async function submitElimination(actor: Actor, cycleId: string, input: { sellerEntityId: string; buyerEntityId: string; amount: string | number; description: string; evidenceId?: string | null }): Promise<{ id: string }> {
  const a = amount(input.amount);
  if (input.sellerEntityId === input.buyerEntityId) throw new HttpError(422, "same_entity");
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "data.submit");
    assertOpen(cycle.status);
    const r = await tx
      .insertInto("core.intercompany_eliminations")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, seller_entity_id: input.sellerEntityId, buyer_entity_id: input.buyerEntityId, amount: a, description: input.description.trim(), evidence_id: input.evidenceId ?? null, entered_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch((e: { code?: string }) => {
        if (e.code === "23503") throw notFound("entity_not_found");
        if (e.code === "23514") throw new HttpError(422, "invalid_input");
        throw e;
      });
    await audit(tx, actor, { action: "consolidation.elimination_submit", objectType: "intercompany_elimination", objectId: r.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { seller: input.sellerEntityId, buyer: input.buyerEntityId, amount: a } });
    return { id: r.id };
  });
}

/** Approves (or withdraws) an entity figure or an elimination; never the person who entered it. */
export async function decideConsolidationInput(actor: Actor, kind: "financial" | "elimination", id: string, decision: "approve" | "withdraw"): Promise<void> {
  await withActor(actor, async (tx) => {
    const table = kind === "financial" ? "core.entity_financials" : "core.intercompany_eliminations";
    const row = await tx.selectFrom(table).select(["id", "project_id", "owner_tenant_id", "cycle_id", "status", "entered_by"]).where("id", "=", id).forUpdate().executeTakeFirst();
    if (!row) throw notFound();
    const { cycle } = await cycleFor(tx, actor, row.cycle_id, decision === "approve" ? "data.review" : "data.request");
    assertOpen(cycle.status);
    if (row.status !== "submitted") throw new HttpError(409, "invalid_transition");
    if (decision === "approve") {
      if (row.entered_by === actor.userId) throw forbidden("own_work");
      await tx.updateTable(table).set({ status: "approved", approved_by: actor.userId, approved_at: new Date() }).where("id", "=", id).execute();
    } else {
      if (kind === "financial") throw new HttpError(422, "replace_instead");
      await tx.updateTable("core.intercompany_eliminations").set({ status: "withdrawn" }).where("id", "=", id).execute();
    }
    await audit(tx, actor, { action: `consolidation.${kind}_${decision}`, objectType: kind === "financial" ? "entity_financial" : "intercompany_elimination", objectId: id, ownerTenantId: row.owner_tenant_id, projectId: row.project_id });
  });
}

export async function consolidationInputs(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "project.read");
    const boundary = await tx.selectFrom("core.reporting_boundaries").select(["id", "revision", "status"]).where("cycle_id", "=", cycleId).where("kind", "=", "financial_reporting").where("status", "=", "approved").executeTakeFirst();
    const members = boundary
      ? await tx.selectFrom("core.boundary_members as m").innerJoin("core.legal_entities as e", "e.id", "m.legal_entity_id").select(["m.legal_entity_id", "m.inclusion_pct", "m.reason", "e.name"]).where("m.boundary_id", "=", boundary.id).orderBy("e.name").execute()
      : [];
    const entities = await tx.selectFrom("core.legal_entities").select(["id", "name"]).where("owner_tenant_id", "=", cycle.owner_tenant_id).orderBy("name").execute();
    const financials = await tx
      .selectFrom("core.entity_financials as f")
      .innerJoin("core.legal_entities as e", "e.id", "f.legal_entity_id")
      .leftJoin("user as u", "u.id", "f.entered_by")
      .leftJoin("user as a", "a.id", "f.approved_by")
      .select(["f.id", "f.legal_entity_id", "e.name as entity_name", "f.net_sales", "f.currency", "f.status", "f.note", "f.evidence_id", "f.entered_by", "u.name as entered_by_name", "a.name as approved_by_name", "f.created_at"])
      .where("f.cycle_id", "=", cycleId)
      .where("f.status", "!=", "superseded")
      .orderBy("e.name")
      .execute();
    const eliminations = await tx
      .selectFrom("core.intercompany_eliminations as x")
      .innerJoin("core.legal_entities as s", "s.id", "x.seller_entity_id")
      .innerJoin("core.legal_entities as b", "b.id", "x.buyer_entity_id")
      .leftJoin("user as u", "u.id", "x.entered_by")
      .leftJoin("user as a", "a.id", "x.approved_by")
      .select(["x.id", "x.seller_entity_id", "x.buyer_entity_id", "s.name as seller_name", "b.name as buyer_name", "x.amount", "x.description", "x.status", "x.entered_by", "u.name as entered_by_name", "a.name as approved_by_name"])
      .where("x.cycle_id", "=", cycleId)
      .where("x.status", "!=", "withdrawn")
      .orderBy("x.created_at")
      .execute();
    return { cycle: { id: cycle.id, label: cycle.label, status: cycle.status }, boundary: boundary ?? null, members, entities, financials, eliminations };
  });
}

// ---------------------------------------------------------------- runs (G5-02, G5-03)

type RunOutcome = { runId: string; reused: boolean; blockers: number; warnings: number };

async function idempotentRun(tx: Tx, projectId: string, kind: string, boundaryId: string | null, inputDigest: string, engine: string): Promise<string | null> {
  const r = await tx
    .selectFrom("core.calculation_runs")
    .select("id")
    .where("project_id", "=", projectId)
    .where("kind", "=", kind)
    .where(sql<boolean>`coalesce(boundary_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(${boundaryId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`)
    .where("input_digest", "=", inputDigest)
    .where("engine_version", "=", engine)
    .where("factor_digest", "=", NO_FACTORS)
    .where("mode", "=", "final")
    .executeTakeFirst();
  return r?.id ?? null;
}

/** IFRS 10 revenue consolidation on the approved financial reporting boundary; the result is a metric fact. */
export async function runFinancialConsolidation(actor: Actor, cycleId: string): Promise<RunOutcome & { consolidatedRevenue: string }> {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "calc.run");
    assertOpen(cycle.status);
    const b = await tx.selectFrom("core.reporting_boundaries").select(["id", "revision"]).where("cycle_id", "=", cycleId).where("kind", "=", "financial_reporting").where("status", "=", "approved").executeTakeFirst();
    if (!b) throw new HttpError(422, "boundary_not_approved");
    const members = (await tx.selectFrom("core.boundary_members").select(["legal_entity_id", "inclusion_pct", "reason"]).where("boundary_id", "=", b.id).where("legal_entity_id", "is not", null).execute()).map((m) => ({ entityId: m.legal_entity_id!, pct: Number(m.inclusion_pct), reason: m.reason ?? "" }));
    const financials = (await tx.selectFrom("core.entity_financials").select(["id", "legal_entity_id", "net_sales", "status", "evidence_id"]).where("cycle_id", "=", cycleId).where("status", "in", ["submitted", "approved"]).execute()).map((f) => ({ id: f.id, entityId: f.legal_entity_id, netSales: f.net_sales, status: f.status, evidenceId: f.evidence_id }));
    const eliminations = (await tx.selectFrom("core.intercompany_eliminations").select(["id", "seller_entity_id", "buyer_entity_id", "amount", "status"]).where("cycle_id", "=", cycleId).where("status", "in", ["submitted", "approved"]).execute()).map((e) => ({ id: e.id, seller: e.seller_entity_id, buyer: e.buyer_entity_id, amount: e.amount, status: e.status }));
    const input = { boundary: { id: b.id, revision: b.revision }, members: [...members].sort((x, y) => x.entityId.localeCompare(y.entityId)), financials: [...financials].sort((x, y) => x.id.localeCompare(y.id)), eliminations: [...eliminations].sort((x, y) => x.id.localeCompare(y.id)) };
    const iDigest = sha(input);
    const existing = await idempotentRun(tx, cycle.project_id, "consolidation", b.id, iDigest, CONSOLIDATION_VERSION);
    const r = consolidateRevenue(members, financials, eliminations);
    if (existing) return { runId: existing, reused: true, ...(await issueCounts(tx, existing)), consolidatedRevenue: r.consolidatedRevenue };
    const facts = r.warnings.some((w) => w.code === "entity_financials_missing" || w.code === "entity_financials_not_approved") && r.included.length === 0 ? [] : [{ metricKey: "finance.consolidated_net_sales", facilityId: null, valueExact: r.consolidatedRevenue, unit: "TRY" }];
    const run = await tx
      .insertInto("core.calculation_runs")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, boundary_id: b.id, kind: "consolidation", mode: "final", engine_version: CONSOLIDATION_VERSION, rule_version: CONSOLIDATION_VERSION, factor_digest: NO_FACTORS, input_digest: iDigest, output_digest: sha({ consolidated: r.consolidatedRevenue, included: r.included, eliminated: r.eliminated }), inputs: JSON.stringify(input), factors: JSON.stringify({ factors: {}, warnings: [] }), result: JSON.stringify(r), performed_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    const evidence = [...new Set(financials.filter((f) => r.usedFinancials.includes(f.id) && f.evidenceId).map((f) => f.evidenceId!))];
    if (evidence.length) await tx.insertInto("core.run_inputs").values(evidence.map((id) => ({ run_id: run.id, owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, evidence_id: id, role: "evidence" }))).execute();
    const ref: RunRef = { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycleId, boundaryKind: "financial_reporting" };
    await supersedeOpenIssues(tx, cycleId, "consolidation");
    const counts = await recordIssues(tx, actor, ref, r.warnings.map((w) => ({ code: w.code, target: w.target, severity: w.severity, detail: w.detail })));
    await writeFacts(tx, ref, facts, counts.blockers > 0);
    await audit(tx, actor, { action: "consolidation.run", objectType: "calculation_run", objectId: run.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { consolidated: r.consolidatedRevenue, gross: r.grossRevenue, eliminations: r.eliminations, ...counts } });
    return { runId: run.id, reused: false, ...counts, consolidatedRevenue: r.consolidatedRevenue };
  });
}

/** Current facts of a cycle: newest revision per key that is not superseded or rejected. */
async function currentFacts(tx: Tx, cycleId: string) {
  const rows = await tx
    .selectFrom("core.metric_fact_versions")
    .select(["id", "metric_key", "facility_id", "boundary_kind", "revision", "value_num", "value_text", "unit", "status", "suppressed", "run_id"])
    .where("cycle_id", "=", cycleId)
    .where("status", "not in", ["superseded", "rejected"])
    .orderBy("revision", "desc")
    .execute();
  const seen = new Set<string>();
  return rows.filter((f) => {
    const k = `${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function acceptedOrgValue(tx: Tx, cycleId: string, metric: string): Promise<number | null> {
  const r = await tx
    .selectFrom("core.observation_versions as o")
    .innerJoin("core.data_requests as r", "r.id", "o.request_id")
    .select(["o.canonical_value"])
    .where("r.cycle_id", "=", cycleId)
    .where("r.metric_code", "=", metric)
    .where("r.facility_id", "is", null)
    .where("o.status", "=", "accepted")
    .orderBy("o.decided_at", "desc")
    .executeTakeFirst();
  return r?.canonical_value == null ? null : Number(r.canonical_value);
}

async function acceptedByFacility(tx: Tx, cycleId: string, metric: string): Promise<Record<string, number>> {
  const rows = await tx
    .selectFrom("core.observation_versions as o")
    .innerJoin("core.data_requests as r", "r.id", "o.request_id")
    .select(["r.facility_id", "o.canonical_value", "o.lines"])
    .where("r.cycle_id", "=", cycleId)
    .where("r.metric_code", "=", metric)
    .where("r.facility_id", "is not", null)
    .where("o.status", "=", "accepted")
    .execute();
  const out: Record<string, number> = {};
  for (const r of rows) {
    const v = r.canonical_value !== null ? Number(r.canonical_value) : ((r.lines as { canonical: string }[] | null) ?? []).reduce((s, l) => s + Number(l.canonical), 0);
    out[r.facility_id!] = (out[r.facility_id!] ?? 0) + v;
  }
  return out;
}

/** G5-03: the U1–U5 cross-checks over the cycle's current facts; failures are findings of this run. */
/** U6/U7 inputs: the approved taxonomy sheet, the transition plan, the annual report checklists, last year's figures. */
async function worksheetInputs(tx: Tx, cycle: { id: string; project_id: string; reporting_year: number }) {
  const sheet = async (kind: string, approvedOnly: boolean) =>
    tx
      .selectFrom("core.cycle_worksheets")
      .select(["payload"])
      .where("cycle_id", "=", cycle.id)
      .where("kind", "=", kind)
      .where("report_id", "is", null)
      .where("status", approvedOnly ? "=" : "!=", approvedOnly ? "approved" : "superseded")
      .orderBy("version", "desc")
      .executeTakeFirst();
  const tax = await sheet("taxonomy", true);
  const taxonomy = tax ? SHEETS.taxonomy.safeParse(tax.payload) : null;
  const plan = await sheet("pathway", false);
  const pathway = plan ? SHEETS.pathway.safeParse(plan.payload) : null;
  const checklists = await tx.selectFrom("core.cycle_worksheets").select(["payload"]).where("cycle_id", "=", cycle.id).where("kind", "=", "annual_report").where("status", "=", "approved").execute();
  const investmentsReported = checklists.some((c) => {
    const p = SHEETS.annual_report.safeParse(c.payload);
    return p.success && p.data.items.investments?.status === "met";
  });
  const prev = await tx.selectFrom("core.reporting_cycles").select("id").where("project_id", "=", cycle.project_id).where("reporting_year", "=", cycle.reporting_year - 1).executeTakeFirst();
  let prior: { energyGj: number | null; scope1: number | null } | null = null;
  if (prev) {
    const facts = await approvedFacts(tx, prev.id);
    const g = (k: string) => facts.find((f) => f.metricKey === k && f.facilityId === null && (f.boundaryKind === null || f.boundaryKind === "ghg_operational_control"))?.value ?? null;
    prior = { energyGj: g("env.energy_gj") ?? g("ghg.energy_gj"), scope1: g("ghg.scope1") };
  }
  return {
    taxonomy: taxonomy?.success ? { capexTotal: taxonomy.data.totals.capex, activities: taxonomy.data.activities.map((a) => ({ name: a.name, capex: a.capex, aligned: a.aligned })) } : null,
    measures: pathway?.success ? pathway.data.measures.map((m) => m.name) : null,
    investmentsReported,
    prior,
  };
}

export async function runReconciliation(actor: Actor, cycleId: string): Promise<RunOutcome & { checks: ReturnType<typeof reconcile> }> {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "calc.run");
    assertOpen(cycle.status);
    const facts = (await currentFacts(tx, cycleId)).filter((f) => f.status !== "validating");
    const profile = await tx.selectFrom("core.applicability_assessments").select("inputs").where("cycle_id", "=", cycleId).where("superseded_at", "is", null).orderBy("created_at", "desc").executeTakeFirst();
    const history = (profile?.inputs as { history?: { employees?: number }[] } | undefined)?.history;
    const input = {
      facts: facts.map((f) => ({ id: f.id, metricKey: f.metric_key, facilityId: f.facility_id, boundaryKind: f.boundary_kind, value: f.value_num === null ? null : Number(f.value_num) })).sort((a, b) => a.id.localeCompare(b.id)),
      reportedRevenue: await acceptedOrgValue(tx, cycleId, "net_sales"),
      profileEmployees: history?.[1]?.employees ?? null,
      production: await acceptedByFacility(tx, cycleId, "ghg_production"),
      cbamExports: await acceptedByFacility(tx, cycleId, "cbam_goods"),
      ...(await worksheetInputs(tx, cycle)),
    };
    const iDigest = sha(input);
    const checks = reconcile(input);
    const existing = await idempotentRun(tx, cycle.project_id, "reconciliation", null, iDigest, RECONCILE_VERSION);
    if (existing) return { runId: existing, reused: true, ...(await issueCounts(tx, existing)), checks };
    const run = await tx
      .insertInto("core.calculation_runs")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, boundary_id: null, kind: "reconciliation", mode: "final", engine_version: RECONCILE_VERSION, rule_version: RECONCILE_VERSION, factor_digest: NO_FACTORS, input_digest: iDigest, output_digest: sha(checks), inputs: JSON.stringify(input), factors: JSON.stringify({ factors: {}, warnings: [] }), result: JSON.stringify({ checks }), performed_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    const ref: RunRef = { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycleId, boundaryKind: null };
    await supersedeOpenIssues(tx, cycleId, "reconciliation");
    const failed = checks.filter((c) => c.status === "fail");
    const counts = await recordIssues(
      tx,
      actor,
      ref,
      failed.map((c) => ({ code: c.code, target: c.target, severity: c.severity, detail: { rule: c.rule, a: c.a, b: c.b, diff: c.diff }, expected: { tolerance: c.tolerance }, tolerance: c.tolerance === undefined ? undefined : `${c.tolerance * 100}%` })),
    );
    await audit(tx, actor, { action: "reconciliation.run", objectType: "calculation_run", objectId: run.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { checks: checks.length, failed: failed.length, ...counts } });
    return { runId: run.id, reused: false, ...counts, checks };
  });
}

export async function latestReconciliation(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    await cycleFor(tx, actor, cycleId, "project.read");
    const run = await tx.selectFrom("core.calculation_runs as r").leftJoin("user as u", "u.id", "r.performed_by").select(["r.id", "r.result", "r.performed_at", "r.input_digest", "u.name as performed_by_name"]).where("r.cycle_id", "=", cycleId).where("r.kind", "=", "reconciliation").orderBy("r.performed_at", "desc").executeTakeFirst();
    const consolidation = await tx.selectFrom("core.calculation_runs as r").leftJoin("user as u", "u.id", "r.performed_by").select(["r.id", "r.result", "r.performed_at", "u.name as performed_by_name"]).where("r.cycle_id", "=", cycleId).where("r.kind", "=", "consolidation").orderBy("r.performed_at", "desc").executeTakeFirst();
    return { reconciliation: run ?? null, consolidation: consolidation ?? null };
  });
}

/** G5-01: GHG results side by side per boundary approach (operational control, financial control, equity share). */
export async function ghgByBoundary(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    await cycleFor(tx, actor, cycleId, "project.read");
    const facts = (await currentFacts(tx, cycleId)).filter((f) => f.metric_key.startsWith("ghg.") && f.boundary_kind);
    const facilities = await tx.selectFrom("core.facilities").select(["id", "name"]).where("id", "in", [...new Set(facts.map((f) => f.facility_id).filter(Boolean) as string[]), "00000000-0000-0000-0000-000000000000"]).execute();
    const boundaries = await tx
      .selectFrom("core.reporting_boundaries as b")
      .select(["b.id", "b.kind", "b.revision", "b.as_of"])
      .where("b.cycle_id", "=", cycleId)
      .where("b.status", "=", "approved")
      .where("b.kind", "like", "ghg_%")
      .execute();
    const members = boundaries.length
      ? await tx.selectFrom("core.boundary_members as m").leftJoin("core.facilities as f", "f.id", "m.facility_id").select(["m.boundary_id", "m.facility_id", "m.inclusion_pct", "m.reason", "f.name"]).where("m.boundary_id", "in", boundaries.map((b) => b.id)).where("m.facility_id", "is not", null).execute()
      : [];
    return { facts: facts.map((f) => ({ ...f, facility_name: facilities.find((x) => x.id === f.facility_id)?.name ?? null })), boundaries, members };
  });
}

// ---------------------------------------------------------------- close (G5-06, G5-07)

export type { ChecklistItem } from "../cycle/steps";

/** The close checklist from the same signals as the cycle steps (cycle/steps.ts), plus the facts a freeze copies. */
async function checklist(tx: Tx, cycle: { id: string; project_id: string; status: string }) {
  const signals = (await signalsFor(tx, [cycle])).get(cycle.id)!;
  const { items, canFreeze } = closeChecklistFrom(signals);
  return { items, facts: await currentFacts(tx, cycle.id), canFreeze };
}

export async function closeChecklist(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "project.read");
    const c = await checklist(tx, cycle);
    const events = await tx.selectFrom("core.cycle_events as e").leftJoin("user as u", "u.id", "e.actor_user_id").select(["e.id", "e.action", "e.reason", "e.snapshot_id", "e.created_at", "u.name as actor_name"]).where("e.cycle_id", "=", cycleId).orderBy("e.created_at", "desc").execute();
    const snapshots = await tx.selectFrom("core.cycle_snapshots as s").leftJoin("user as u", "u.id", "s.frozen_by").select(["s.id", "s.version", "s.status", "s.content_sha256", "s.facts", "s.restated", "s.frozen_at", "u.name as frozen_by_name"]).where("s.cycle_id", "=", cycleId).orderBy("s.version", "desc").execute();
    return { cycle: { id: cycle.id, label: cycle.label, status: cycle.status, row_version: cycle.row_version }, items: c.items, canFreeze: c.canFreeze && !FROZEN.includes(cycle.status), events, snapshots };
  });
}

const factKey = (f: { metric_key: string; facility_id: string | null; boundary_kind: string | null }) => `${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;

/** Freezes the cycle: the approved facts become an immutable, digested snapshot and are locked. */
export async function freezeCycle(actor: Actor, cycleId: string): Promise<{ snapshotId: string; version: number; digest: string; restated: number }> {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "cycle.close");
    await tx.selectFrom("core.reporting_cycles").select("id").where("id", "=", cycleId).forUpdate().execute();
    assertOpen(cycle.status);
    const c = await checklist(tx, cycle);
    if (!c.canFreeze) throw new HttpError(409, "close_checklist_incomplete", `close_checklist_incomplete: ${c.items.filter((i) => i.required && !i.ok).map((i) => i.id).join(", ")}`);
    const content = c.facts
      .map((f) => ({ fact: f.id, k: f.metric_key, f: f.facility_id, b: f.boundary_kind, r: f.revision, v: f.value_num, t: f.value_text, u: f.unit, s: f.suppressed }))
      .sort((a, b) => `${a.k}|${a.f ?? ""}|${a.b ?? ""}`.localeCompare(`${b.k}|${b.f ?? ""}|${b.b ?? ""}`));
    const digest = sha(content);
    const prev = await tx.selectFrom("core.cycle_snapshots").select(["id", "version"]).where("cycle_id", "=", cycleId).where("status", "=", "frozen").orderBy("version", "desc").executeTakeFirst();
    // restatement: what changed against the snapshot in force (GHG Protocol ch. 5; IAS 8 for figures)
    let restated: { metric: string; facility: string | null; boundary: string | null; from: string | null; to: string | null }[] = [];
    if (prev) {
      const old = await tx.selectFrom("core.snapshot_facts").select(["metric_key", "facility_id", "boundary_kind", "value_num", "value_text"]).where("snapshot_id", "=", prev.id).execute();
      const byKey = new Map(old.map((o) => [factKey(o), o]));
      restated = c.facts
        .filter((f) => {
          const o = byKey.get(factKey(f));
          return !o || o.value_num !== f.value_num || o.value_text !== f.value_text;
        })
        .map((f) => {
          const o = byKey.get(factKey(f));
          return { metric: f.metric_key, facility: f.facility_id, boundary: f.boundary_kind, from: o ? (o.value_num ?? o.value_text) : null, to: f.value_num ?? f.value_text };
        });
      await tx.updateTable("core.cycle_snapshots").set({ status: "superseded" }).where("id", "=", prev.id).execute();
    }
    const snap = await tx
      .insertInto("core.cycle_snapshots")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, version: (prev?.version ?? 0) + 1, content_sha256: digest, facts: content.length, checklist: JSON.stringify(c.items), restated: prev ? JSON.stringify(restated) : null, frozen_by: actor.userId })
      .returning(["id", "version"])
      .executeTakeFirstOrThrow();
    for (const f of c.facts)
      await tx
        .insertInto("core.snapshot_facts")
        .values({ snapshot_id: snap.id, owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, fact_id: f.id, metric_key: f.metric_key, facility_id: f.facility_id, boundary_kind: f.boundary_kind, revision: f.revision, value_num: f.value_num, value_text: f.value_text, unit: f.unit, suppressed: f.suppressed })
        .execute();
    await tx.updateTable("core.metric_fact_versions").set({ status: "locked", locked_at: new Date() }).where("id", "in", c.facts.filter((f) => f.status === "approved").map((f) => f.id).concat(["00000000-0000-0000-0000-000000000000"])).execute();
    await tx.updateTable("core.reporting_cycles").set({ status: "frozen" }).where("id", "=", cycleId).execute();
    await tx.insertInto("core.cycle_events").values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, action: "freeze", snapshot_id: snap.id, actor_user_id: actor.userId }).execute();
    await audit(tx, actor, { action: "cycle.freeze", objectType: "reporting_cycle", objectId: cycleId, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { snapshot: snap.id, version: snap.version, digest, facts: content.length, restated: restated.length } });
    return { snapshotId: snap.id, version: snap.version, digest, restated: restated.length };
  });
}

/** Reopens a frozen cycle with a written reason; the snapshot stays as it is. */
export async function reopenCycle(actor: Actor, cycleId: string, reason: string): Promise<void> {
  if (reason.trim().length < 20) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const { cycle } = await cycleFor(tx, actor, cycleId, "cycle.close");
    if (cycle.status !== "frozen") throw new HttpError(409, "cycle_not_frozen");
    await tx.updateTable("core.reporting_cycles").set({ status: "reopened" }).where("id", "=", cycleId).execute();
    const snap = await tx.selectFrom("core.cycle_snapshots").select("id").where("cycle_id", "=", cycleId).where("status", "=", "frozen").executeTakeFirst();
    await tx.insertInto("core.cycle_events").values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, action: "reopen", reason: reason.trim(), snapshot_id: snap?.id ?? null, actor_user_id: actor.userId }).execute();
    await audit(tx, actor, { action: "cycle.reopen", objectType: "reporting_cycle", objectId: cycleId, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, payload: { reason: reason.trim() } });
  });
}

export async function getSnapshot(actor: Actor, snapshotId: string) {
  return withActor(actor, async (tx) => {
    const s = await tx.selectFrom("core.cycle_snapshots as s").leftJoin("user as u", "u.id", "s.frozen_by").selectAll("s").select("u.name as frozen_by_name").where("s.id", "=", snapshotId).executeTakeFirst();
    if (!s) throw notFound();
    await requireProjectAction(tx, actor, s.project_id, "project.read");
    const facts = await tx.selectFrom("core.snapshot_facts as f").leftJoin("core.facilities as fa", "fa.id", "f.facility_id").selectAll("f").select("fa.name as facility_name").where("f.snapshot_id", "=", snapshotId).orderBy("f.metric_key").execute();
    const content = facts
      .map((f) => ({ fact: f.fact_id, k: f.metric_key, f: f.facility_id, b: f.boundary_kind, r: f.revision, v: f.value_num, t: f.value_text, u: f.unit, s: f.suppressed }))
      .sort((a, b) => `${a.k}|${a.f ?? ""}|${a.b ?? ""}`.localeCompare(`${b.k}|${b.f ?? ""}|${b.b ?? ""}`));
    return { snapshot: s, facts, intact: sha(content) === s.content_sha256 };
  });
}

// ---------------------------------------------------------------- reopening an accepted request after reopen (restatement)

/** Sends an accepted data request back to its contributor (a correction after the period was reopened). */
export async function reopenRequest(actor: Actor, requestId: string, reason: string): Promise<void> {
  if (reason.trim().length < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.data_requests").selectAll().where("id", "=", requestId).forUpdate().executeTakeFirst();
    if (!r) throw notFound("request_not_found");
    const { cycle } = await cycleFor(tx, actor, r.cycle_id, "data.request");
    assertOpen(cycle.status);
    if (r.status !== "accepted") throw new HttpError(409, "invalid_transition");
    await tx.updateTable("core.data_requests").set({ status: "revision_required", returns: r.returns + 1 }).where("id", "=", requestId).execute();
    await tx.insertInto("core.request_comments").values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, request_id: r.id, author_user_id: actor.userId, kind: "return", body: reason.trim() }).execute();
    await audit(tx, actor, { action: "request.reopen", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, before: { status: "accepted" }, after: { status: "revision_required" }, payload: { reason: reason.trim() } });
  });
}

// ---------------------------------------------------------------- reviewer queue (G5-05)

/**
 * Everything waiting for this person's decision — never their own work. Facility-level metrics are included: the
 * close needs every current metric approved, so a queue without them would hide part of the work.
 */
export async function reviewQueue(actor: Actor) {
  return withActor(actor, async (tx) => {
    // metrics, warnings and revenue inputs are listed per project the workspace can reach, not across the database
    const reachable = await reachableProjectIds(tx, actor);
    const requests = await tx
      .selectFrom("core.data_requests as r")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .leftJoin("core.facilities as f", "f.id", "r.facility_id")
      .leftJoin("user as a", "a.id", "r.assignee_user_id")
      .select(["r.id", "r.metric_code", "r.status", "r.due_on", "r.critical", "p.name as project_name", "p.id as project_id", "f.name as facility_name", "a.name as assignee_name", "r.submitted_at"])
      .where("r.reviewer_user_id", "=", actor.userId)
      .where("r.status", "in", ["submitted", "reviewing"])
      .orderBy("r.submitted_at")
      .execute();
    if (!reachable.length) return { requests, facts: [], issues: [], inputs: [] };
    const facts = await tx
      .selectFrom("core.metric_fact_versions as f")
      .innerJoin("core.calculation_runs as run", "run.id", "f.run_id")
      .innerJoin("core.projects as p", "p.id", "f.project_id")
      .leftJoin("core.facilities as fa", "fa.id", "f.facility_id")
      .leftJoin("user as u", "u.id", "run.performed_by")
      .select(["f.id", "f.metric_key", "f.value_num", "f.value_text", "f.unit", "f.revision", "f.run_id", "f.supersedes_id", "p.id as project_id", "p.name as project_name", "fa.name as facility_name", "u.name as performed_by_name", "run.kind"])
      .where("f.project_id", "in", reachable)
      .where("f.status", "=", "ready_for_review")
      .where("run.performed_by", "!=", actor.userId)
      .orderBy("f.created_at")
      .execute();
    const issues = await tx
      .selectFrom("core.quality_issues as i")
      .innerJoin("core.projects as p", "p.id", "i.project_id")
      .select(["i.id", "i.rule_id", "i.severity", "i.target_id", "i.run_id", "p.id as project_id", "p.name as project_name", "i.created_at"])
      .where("i.project_id", "in", reachable)
      .where("i.status", "=", "open")
      .where("i.severity", "=", "warning")
      .where("i.detected_by", "!=", actor.userId)
      .orderBy("i.created_at")
      .execute();
    const inputs = await tx
      .selectFrom("core.entity_financials as f")
      .innerJoin("core.legal_entities as e", "e.id", "f.legal_entity_id")
      .innerJoin("core.projects as p", "p.id", "f.project_id")
      .select(["f.id", "f.cycle_id", "f.net_sales", "e.name as entity_name", "p.id as project_id", "p.name as project_name"])
      .where("f.project_id", "in", reachable)
      .where("f.status", "=", "submitted")
      .where("f.entered_by", "!=", actor.userId)
      .execute();
    // keep only projects where this person may review (role and grant), checked in one batch for every project
    const allowed = await projectsAllowing(tx, actor, [...facts, ...issues, ...inputs].map((r) => r.project_id), ["quality.review", "data.review"]);
    const keep = <T extends { project_id: string }>(rows: T[], action: "quality.review" | "data.review") => rows.filter((r) => allowed[action].has(r.project_id));
    // previous approved value next to a new revision (CTRL-07 diff)
    const prevIds = facts.map((f) => f.supersedes_id).filter(Boolean) as string[];
    const prev = prevIds.length ? await tx.selectFrom("core.metric_fact_versions").select(["id", "value_num", "value_text", "status"]).where("id", "in", prevIds).execute() : [];
    return {
      requests,
      facts: keep(facts, "quality.review").map((f) => ({ ...f, previous: prev.find((p) => p.id === f.supersedes_id) ?? null })),
      issues: keep(issues, "quality.review"),
      inputs: keep(inputs, "data.review"),
    };
  });
}
