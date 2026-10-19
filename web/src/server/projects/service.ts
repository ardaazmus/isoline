/**
 * Projects, reporting cycles, boundaries, applicability, team and plan (G2-03..G2-09). Every call runs as the actor
 * under RLS and checks the role/grant action for the project; state changes are audited in the same transaction.
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { evaluate, TSRS_THRESHOLDS, type Profile } from "@/lib/calc/applicability";
import { audit } from "../audit/audit";
import { withActor, withSystem, type Actor, type Tx } from "../db/client";
import { canonicalJson } from "../audit/audit";
import { suggestBoundary, type BoundaryKind, type Control } from "../orgs/boundary";
import { forbidden, HttpError, notFound } from "../policy/policy";
import { requireMemberAction, requireProjectAction } from "../tenancy/service";
import { addDays, criticalSet, GATE_TEMPLATE, iso, reaches, schedule, WP_TRANSITIONS, type WpStatus } from "./plan";

const pg = (e: unknown): never => {
  const c = (e as { code?: string; constraint?: string }).code;
  const name = String((e as { constraint?: string }).constraint ?? "");
  if (c === "23P01" && name.includes("cycles")) throw new HttpError(409, "cycle_overlap");
  if (c === "23505") throw new HttpError(409, "conflict");
  if (c === "23514") throw new HttpError(422, "invalid_input");
  if (c === "23503") throw new HttpError(404, "not_found");
  throw e;
};

// ---------------------------------------------------------------- project wizard and cycles (G2-05)

export type CycleInput = { label?: string; reportingYear: number; periodStart?: string; periodEnd?: string; publishDue?: string | null; isBaseYear?: boolean };

function cycleDates(c: CycleInput) {
  const start = c.periodStart ?? `${c.reportingYear}-01-01`;
  const end = c.periodEnd ?? `${c.reportingYear}-12-31`;
  if (end < start) throw new HttpError(422, "invalid_period");
  return { start, end, label: c.label?.trim() || String(c.reportingYear) };
}

/** Inserts a cycle with its 13-gate plan inside the caller's transaction (also used by the toolkit import). */
export async function insertCycle(tx: Tx, actor: Actor, owner: string, projectId: string, c: CycleInput, planStart: string) {
  const { start, end, label } = cycleDates(c);
  const cyc = await tx
    .insertInto("core.reporting_cycles")
    .values({ owner_tenant_id: owner, project_id: projectId, label, reporting_year: c.reportingYear, period_start: start, period_end: end, publish_due: c.publishDue ?? null, is_base_year: c.isBaseYear ?? false, created_by: actor.userId })
    .returning("id")
    .executeTakeFirstOrThrow()
    .catch(pg);
  // the 13-gate plan for the cycle (G2-08)
  const plan = schedule(planStart, end, c.publishDue ?? null);
  const ids = new Map<string, string>();
  for (const [i, it] of plan.items.entries()) {
    const wp = await tx
      .insertInto("core.work_packages")
      .values({ owner_tenant_id: owner, project_id: projectId, cycle_id: cyc.id, gate: it.gate, title: it.gate, status: it.status, starts_on: it.startsOn, due_on: it.dueOn, critical: it.critical, sort: i, created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    ids.set(it.gate, wp.id);
  }
  for (const it of plan.items) for (const d of it.deps) await tx.insertInto("core.work_package_deps").values({ owner_tenant_id: owner, project_id: projectId, work_package_id: ids.get(it.gate)!, depends_on_id: ids.get(d)! }).execute();
  await audit(tx, actor, { action: "cycle.create", objectType: "reporting_cycle", objectId: cyc.id, ownerTenantId: owner, projectId, after: { label, start, end, publishDue: c.publishDue ?? null, planFinish: plan.finish, lateBy: plan.lateBy } });
  return { cycleId: cyc.id, planFinish: plan.finish, lateBy: plan.lateBy };
}

export type WizardInput = {
  name: string;
  description?: string | null;
  ownerTenantId?: string;
  organizationId?: string | null;
  engagementId?: string | null;
  cycle: CycleInput;
  planStart?: string;
};

/** PORT-07: project + first cycle + 13-gate plan + the creator as project lead, in one transaction. */
export async function createProjectWizard(actor: Actor, input: WizardInput): Promise<{ projectId: string; cycleId: string; planFinish: string; lateBy: number }> {
  const name = input.name.trim();
  if (!name || name.length > 200) throw new HttpError(422, "invalid_name");
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "project.create");
    const owner = input.ownerTenantId ?? actor.actingTenantId!;
    if (owner !== actor.actingTenantId) {
      const s = await tx.selectFrom("core.tenants").select("id").where("id", "=", owner).where("lifecycle", "=", "provisional").where("steward_tenant_id", "=", actor.actingTenantId).executeTakeFirst();
      if (!s) throw notFound("tenant_not_found");
    }
    const p = await tx
      .insertInto("core.projects")
      .values({ owner_tenant_id: owner, name, description: input.description ?? null, organization_id: input.organizationId ?? null, engagement_id: input.engagementId ?? null, created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pg);
    await audit(tx, actor, { action: "project.create", objectType: "project", objectId: p.id, ownerTenantId: owner, projectId: p.id, after: { name, organizationId: input.organizationId ?? null, engagementId: input.engagementId ?? null } });
    const c = await insertCycle(tx, actor, owner, p.id, input.cycle, input.planStart ?? iso(new Date()));
    await tx.insertInto("core.project_participants").values({ owner_tenant_id: owner, project_id: p.id, user_id: actor.userId, member_tenant_id: actor.actingTenantId!, raci_role: owner === actor.actingTenantId ? "project_lead" : "advisor_preparer", responsibilities: null, added_by: actor.userId }).execute();
    return { projectId: p.id, ...c };
  });
}

export async function addCycle(actor: Actor, projectId: string, input: CycleInput & { planStart?: string }) {
  return withActor(actor, async (tx) => {
    const a = await requireProjectAction(tx, actor, projectId, "project.update");
    return insertCycle(tx, actor, a.ownerTenantId, projectId, input, input.planStart ?? iso(new Date()));
  });
}

export async function listCycles(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    return tx.selectFrom("core.reporting_cycles").selectAll().where("project_id", "=", projectId).orderBy("period_start", "desc").execute();
  });
}

const CYCLE_FLOW: Record<string, string[]> = { planning: ["collection"], collection: ["calculation"], calculation: ["close_review"], close_review: ["calculation"], reopened: ["collection", "calculation"] };

/** Moves a cycle through the working states; freezing and release belong to the close (G5) and release (G6). */
export async function moveCycle(actor: Actor, cycleId: string, to: string, expectedVersion?: number): Promise<number> {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").selectAll().where("id", "=", cycleId).forUpdate().executeTakeFirst();
    if (!c) throw notFound();
    await requireProjectAction(tx, actor, c.project_id, "project.update");
    if (expectedVersion !== undefined && c.row_version !== expectedVersion) throw new HttpError(409, "version_conflict");
    if (!(CYCLE_FLOW[c.status] ?? []).includes(to)) throw new HttpError(409, "invalid_transition");
    const r = await tx.updateTable("core.reporting_cycles").set({ status: to }).where("id", "=", cycleId).returning("row_version").executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "cycle.move", objectType: "reporting_cycle", objectId: cycleId, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, before: { status: c.status }, after: { status: to } });
    return r.row_version;
  });
}

// ---------------------------------------------------------------- boundaries (G2-03)

async function cycleScope(tx: Tx, actor: Actor, cycleId: string, action: "project.read" | "org.manage" | "project.update") {
  const c = await tx.selectFrom("core.reporting_cycles").selectAll().where("id", "=", cycleId).executeTakeFirst();
  if (!c) throw notFound("cycle_not_found");
  const access = await requireProjectAction(tx, actor, c.project_id, action);
  return { cycle: c, access };
}

/**
 * Builds a draft boundary revision from the organisation tree on the cycle's last day. An earlier approved
 * revision stays in force until the new draft is approved.
 */
export async function proposeBoundary(actor: Actor, cycleId: string, kind: BoundaryKind): Promise<{ boundaryId: string; revision: number; warnings: string[] }> {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleScope(tx, actor, cycleId, "org.manage");
    const owner = cycle.owner_tenant_id;
    const draft = await tx.selectFrom("core.reporting_boundaries").select("id").where("cycle_id", "=", cycleId).where("kind", "=", kind).where("status", "=", "draft").executeTakeFirst();
    if (draft) throw new HttpError(409, "draft_exists");
    const last = await tx.selectFrom("core.reporting_boundaries").select(sql<number>`coalesce(max(revision), 0)`.as("r")).where("cycle_id", "=", cycleId).where("kind", "=", kind).executeTakeFirstOrThrow();
    const asOf = cycle.period_end;
    const entities = await tx.selectFrom("core.legal_entities").select(["id", "is_reporting_parent", "valid_from", "valid_to"]).where("owner_tenant_id", "=", owner).execute();
    const edges = await tx.selectFrom("core.ownership_edges").select(["parent_entity_id", "child_entity_id", "share_pct", "control", "valid_from", "valid_to"]).where("owner_tenant_id", "=", owner).execute();
    const facilities = await tx.selectFrom("core.facilities").select(["id", "legal_entity_id", "operated", "cbam_installation", "valid_from", "valid_to"]).where("owner_tenant_id", "=", owner).execute();
    const s = suggestBoundary(
      kind,
      entities.map((e) => ({ id: e.id, isParent: e.is_reporting_parent, validFrom: e.valid_from, validTo: e.valid_to })),
      edges.map((e) => ({ parent: e.parent_entity_id, child: e.child_entity_id, sharePct: Number(e.share_pct), control: e.control as Control, validFrom: e.valid_from, validTo: e.valid_to })),
      facilities.map((f) => ({ id: f.id, entityId: f.legal_entity_id, operated: f.operated, cbamInstallation: f.cbam_installation, validFrom: f.valid_from, validTo: f.valid_to })),
      asOf,
    );
    if (s.warnings.includes("no_reporting_parent") || s.warnings.includes("several_reporting_parents")) throw new HttpError(422, s.warnings[0]);
    const b = await tx
      .insertInto("core.reporting_boundaries")
      .values({ owner_tenant_id: owner, project_id: cycle.project_id, cycle_id: cycleId, kind, revision: Number(last.r) + 1, as_of: asOf, created_by: actor.userId })
      .returning(["id", "revision"])
      .executeTakeFirstOrThrow()
      .catch(pg);
    for (const m of s.members) {
      await tx
        .insertInto("core.boundary_members")
        .values({ owner_tenant_id: owner, project_id: cycle.project_id, boundary_id: b.id, legal_entity_id: m.kind === "entity" ? m.id : null, facility_id: m.kind === "facility" ? m.id : null, included: m.pct > 0, inclusion_pct: String(m.pct), suggested_pct: String(m.pct), reason: m.reason })
        .execute();
    }
    await audit(tx, actor, { action: "boundary.propose", objectType: "reporting_boundary", objectId: b.id, ownerTenantId: owner, projectId: cycle.project_id, after: { kind, revision: b.revision, asOf, members: s.members.length }, payload: { warnings: s.warnings } });
    return { boundaryId: b.id, revision: b.revision, warnings: s.warnings };
  });
}

/** Changes one member of a draft boundary; a change away from the rule's suggestion needs a reason (DB check). */
export async function setBoundaryMember(actor: Actor, memberId: string, input: { inclusionPct: number; reason?: string | null }): Promise<void> {
  if (!(input.inclusionPct >= 0 && input.inclusionPct <= 100)) throw new HttpError(422, "invalid_share");
  await withActor(actor, async (tx) => {
    const m = await tx.selectFrom("core.boundary_members as m").innerJoin("core.reporting_boundaries as b", "b.id", "m.boundary_id").select(["m.id", "m.project_id", "m.owner_tenant_id", "m.inclusion_pct", "m.suggested_pct", "m.reason", "b.status", "b.id as boundary_id"]).where("m.id", "=", memberId).executeTakeFirst();
    if (!m) throw notFound();
    await requireProjectAction(tx, actor, m.project_id, "org.manage");
    if (m.status !== "draft") throw new HttpError(409, "boundary_not_draft");
    const differs = m.suggested_pct !== null && Number(m.suggested_pct) !== input.inclusionPct;
    if (differs && (input.reason ?? "").trim().length < 5) throw new HttpError(422, "reason_required");
    await tx
      .updateTable("core.boundary_members")
      .set({ inclusion_pct: String(input.inclusionPct), included: input.inclusionPct > 0, reason: differs ? input.reason!.trim() : (input.reason?.trim() || m.reason) })
      .where("id", "=", memberId)
      .execute()
      .catch(pg);
    await audit(tx, actor, { action: "boundary.member_change", objectType: "boundary_member", objectId: memberId, ownerTenantId: m.owner_tenant_id, projectId: m.project_id, before: { pct: m.inclusion_pct }, after: { pct: input.inclusionPct, reason: input.reason ?? null } });
  });
}

export async function approveBoundary(actor: Actor, boundaryId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const b = await tx.selectFrom("core.reporting_boundaries").selectAll().where("id", "=", boundaryId).forUpdate().executeTakeFirst();
    if (!b) throw notFound();
    const a = await requireProjectAction(tx, actor, b.project_id, "org.manage");
    if (a.via === "grant") throw forbidden("owner_decision");
    if (b.status !== "draft") throw new HttpError(409, "boundary_not_draft");
    await tx.updateTable("core.reporting_boundaries").set({ status: "superseded" }).where("cycle_id", "=", b.cycle_id).where("kind", "=", b.kind).where("status", "=", "approved").execute();
    await tx.updateTable("core.reporting_boundaries").set({ status: "approved", approved_by: actor.userId, approved_at: new Date() }).where("id", "=", boundaryId).execute();
    await audit(tx, actor, { action: "boundary.approve", objectType: "reporting_boundary", objectId: boundaryId, ownerTenantId: b.owner_tenant_id, projectId: b.project_id, after: { kind: b.kind, revision: b.revision } });
  });
}

export async function listBoundaries(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    await cycleScope(tx, actor, cycleId, "project.read");
    const boundaries = await tx
      .selectFrom("core.reporting_boundaries as b")
      .leftJoin("user as u", "u.id", "b.approved_by")
      .select(["b.id", "b.kind", "b.revision", "b.status", "b.as_of", "b.approved_at", "b.row_version", "u.name as approved_by_name"])
      .where("b.cycle_id", "=", cycleId)
      .orderBy("b.kind")
      .orderBy("b.revision", "desc")
      .execute();
    const ids = boundaries.map((b) => b.id);
    const members = ids.length
      ? await tx
          .selectFrom("core.boundary_members as m")
          .leftJoin("core.legal_entities as e", "e.id", "m.legal_entity_id")
          .leftJoin("core.facilities as f", "f.id", "m.facility_id")
          .select(["m.id", "m.boundary_id", "m.legal_entity_id", "m.facility_id", "m.included", "m.inclusion_pct", "m.suggested_pct", "m.reason", "e.name as entity_name", "f.name as facility_name", "f.legal_entity_id as facility_entity_id"])
          .where("m.boundary_id", "in", ids)
          .execute()
      : [];
    return boundaries.map((b) => ({ ...b, members: members.filter((m) => m.boundary_id === b.id) }));
  });
}

// ---------------------------------------------------------------- applicability (G2-06, ADR-010)

export const APPLICABILITY_ENGINE = `isoline-applicability/2026.10.19+${createHash("sha256").update(JSON.stringify(TSRS_THRESHOLDS)).digest("hex").slice(0, 8)}`;

export function frameworkFor(regime: string, year: number): string | null {
  const map: Record<string, string> = {
    tsrs: "tsrs@2024",
    csrd: year >= 2027 ? "esrs@2026" : "esrs@2023",
    csddd: "csddd@2026",
    cbam: "cbam@2025",
    tr_ets: "tr_ets@2026",
    annual_report: "annual_report_tr@2012",
    tr_taxonomy: "tr_taxonomy@2026",
    eudr: "eudr@2025",
    espr_dpp: "espr@2024",
  };
  return map[regime] ?? null;
}

/** Runs the rule engine for the cycle's year: a suggestion per regime with its sources; decisions stay with people. */
export async function runApplicability(actor: Actor, cycleId: string, profile: Profile): Promise<{ assessments: number; engine: string }> {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleScope(tx, actor, cycleId, "project.read");
    await requireProjectAction(tx, actor, cycle.project_id, "scope.decide");
    const p: Profile = { ...profile, reportingYear: cycle.reporting_year };
    const findings = evaluate(p);
    const digest = createHash("sha256").update(canonicalJson(p)).digest("hex");
    await tx.updateTable("core.applicability_assessments").set({ superseded_at: new Date() }).where("cycle_id", "=", cycleId).where("superseded_at", "is", null).execute();
    for (const f of findings) {
      await tx
        .insertInto("core.applicability_assessments")
        .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, regime: f.id, framework_version_id: frameworkFor(f.id, cycle.reporting_year), engine_version: APPLICABILITY_ENGINE, inputs: JSON.stringify(p), inputs_digest: digest, suggestion: f.status, first_year: f.firstYear ?? null, notes: f.notes, source_ids: f.sources, created_by: actor.userId })
        .execute()
        .catch(pg);
    }
    await audit(tx, actor, { action: "scope.assess", objectType: "reporting_cycle", objectId: cycleId, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { engine: APPLICABILITY_ENGINE, inputsDigest: digest, findings: findings.map((f) => `${f.id}:${f.status}`) } });
    return { assessments: findings.length, engine: APPLICABILITY_ENGINE };
  });
}

export type Decision = "in_scope" | "voluntary" | "not_applicable" | "needs_review";

/**
 * The named expert decision (R). When it is made by someone outside the owner tenant (an advisor under a grant),
 * the owner tenant still has to confirm it (A); a decision by the owner's own lead is confirmed at once.
 */
export async function decideApplicability(actor: Actor, assessmentId: string, input: { decision: Decision; rationale: string; decisionSource?: string | null }): Promise<void> {
  if (input.rationale.trim().length < 10) throw new HttpError(422, "rationale_required");
  await withActor(actor, async (tx) => {
    const a = await tx.selectFrom("core.applicability_assessments").selectAll().where("id", "=", assessmentId).forUpdate().executeTakeFirst();
    if (!a) throw notFound();
    const acc = await requireProjectAction(tx, actor, a.project_id, "scope.decide");
    if (a.superseded_at) throw new HttpError(409, "assessment_superseded");
    const now = new Date();
    const own = acc.via !== "grant";
    await tx
      .updateTable("core.applicability_assessments")
      .set({ decision: input.decision, rationale: input.rationale.trim(), decision_source: input.decisionSource ?? null, decided_by: actor.userId, decided_at: now, confirmed_by: own ? actor.userId : null, confirmed_at: own ? now : null })
      .where("id", "=", assessmentId)
      .execute();
    await audit(tx, actor, { action: "scope.decide", objectType: "applicability_assessment", objectId: assessmentId, ownerTenantId: a.owner_tenant_id, projectId: a.project_id, before: { suggestion: a.suggestion, decision: a.decision }, after: { decision: input.decision, confirmed: own }, payload: { regime: a.regime, rationale: input.rationale.trim(), source: input.decisionSource ?? null } });
  });
}

export async function confirmApplicability(actor: Actor, assessmentId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const a = await tx.selectFrom("core.applicability_assessments").selectAll().where("id", "=", assessmentId).forUpdate().executeTakeFirst();
    if (!a) throw notFound();
    const acc = await requireProjectAction(tx, actor, a.project_id, "scope.decide");
    if (acc.via === "grant") throw forbidden("owner_decision");
    if (!a.decision) throw new HttpError(409, "no_decision");
    if (a.confirmed_by) throw new HttpError(409, "already_confirmed");
    await tx.updateTable("core.applicability_assessments").set({ confirmed_by: actor.userId, confirmed_at: new Date() }).where("id", "=", assessmentId).execute();
    await audit(tx, actor, { action: "scope.confirm", objectType: "applicability_assessment", objectId: assessmentId, ownerTenantId: a.owner_tenant_id, projectId: a.project_id, after: { decision: a.decision } });
  });
}

export async function listApplicability(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    await cycleScope(tx, actor, cycleId, "project.read");
    return tx
      .selectFrom("core.applicability_assessments as a")
      .leftJoin("core.framework_versions as f", "f.id", "a.framework_version_id")
      .leftJoin("user as d", "d.id", "a.decided_by")
      .leftJoin("user as c", "c.id", "a.confirmed_by")
      .select(["a.id", "a.regime", "a.suggestion", "a.first_year", "a.notes", "a.source_ids", "a.decision", "a.rationale", "a.decision_source", "a.decided_at", "a.confirmed_at", "a.engine_version", "a.inputs", "a.created_at", "f.id as framework_id", "f.title as framework_title", "f.status as framework_status", "f.effective_from", "d.name as decided_by_name", "c.name as confirmed_by_name"])
      .where("a.cycle_id", "=", cycleId)
      .where("a.superseded_at", "is", null)
      .orderBy("a.regime")
      .execute();
  });
}

// ---------------------------------------------------------------- team and RACI (G2-07)

export type RaciRole = "project_lead" | "data_lead" | "data_owner" | "contributor" | "technical_reviewer" | "report_editor" | "management_signer" | "advisor_preparer" | "advisor_reviewer" | "assurance" | "design";
const OWNER_SIDE: RaciRole[] = ["project_lead", "data_lead", "data_owner", "contributor", "technical_reviewer", "report_editor", "management_signer"];
const GRANT_SIDE: Record<string, RaciRole[]> = { preparer: ["advisor_preparer", "report_editor", "data_lead"], methodology: ["advisor_reviewer", "technical_reviewer"], reviewer: ["advisor_reviewer"], design: ["design"], assurance: ["assurance"], supplier: ["contributor"] };

/** People who may take a role in the project: owner-tenant members and members of workspaces holding an active grant. */
export async function participantCandidates(actor: Actor, projectId: string) {
  const access = await withActor(actor, (tx) => requireProjectAction(tx, actor, projectId, "plan.update"));
  return withSystem("team screen: people with access to one project (after plan.update check)", async (tx) => {
    const grants = await tx.selectFrom("core.external_grants").select(["recipient_tenant_id", "role"]).where("project_id", "=", projectId).where("revoked_at", "is", null).where("expires_at", ">", new Date()).execute();
    // a grant holder sees the owner's people only when it is the owner or steward; otherwise just its own tenant
    const tenants = access.via === "grant" ? [actor.actingTenantId!] : [access.ownerTenantId, ...grants.map((g) => g.recipient_tenant_id)];
    const rows = await tx
      .selectFrom("core.memberships as m")
      .innerJoin("user as u", "u.id", "m.user_id")
      .innerJoin("core.tenants as t", "t.id", "m.tenant_id")
      .select(["u.id as user_id", "u.name", "u.email", "m.tenant_id", "t.name as tenant_name", "m.role"])
      .where("m.tenant_id", "in", tenants)
      .where("m.revoked_at", "is", null)
      .orderBy("t.name")
      .orderBy("u.name")
      .execute();
    return rows.map((r) => ({ ...r, grantRole: r.tenant_id === access.ownerTenantId ? null : (grants.find((g) => g.recipient_tenant_id === r.tenant_id)?.role ?? null), allowed: r.tenant_id === access.ownerTenantId ? OWNER_SIDE : (GRANT_SIDE[grants.find((g) => g.recipient_tenant_id === r.tenant_id)?.role ?? ""] ?? []) }));
  });
}

export async function addParticipant(actor: Actor, projectId: string, input: { userId: string; memberTenantId: string; raciRole: RaciRole; responsibilities?: string | null; facilityIds?: string[] }): Promise<string> {
  const candidates = await participantCandidates(actor, projectId);
  const c = candidates.find((x) => x.user_id === input.userId && x.tenant_id === input.memberTenantId);
  if (!c) throw new HttpError(422, "not_a_project_member");
  if (!c.allowed.includes(input.raciRole)) throw new HttpError(422, "role_not_allowed_for_access");
  return withActor(actor, async (tx) => {
    const a = await requireProjectAction(tx, actor, projectId, "plan.update");
    const r = await tx
      .insertInto("core.project_participants")
      .values({ owner_tenant_id: a.ownerTenantId, project_id: projectId, user_id: input.userId, member_tenant_id: input.memberTenantId, raci_role: input.raciRole, responsibilities: input.responsibilities ?? null, facility_ids: input.facilityIds ?? [], added_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pg);
    await audit(tx, actor, { action: "team.add", objectType: "project_participant", objectId: r.id, ownerTenantId: a.ownerTenantId, projectId, after: input });
    return r.id;
  });
}

export async function removeParticipant(actor: Actor, participantId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const p = await tx.selectFrom("core.project_participants").selectAll().where("id", "=", participantId).where("revoked_at", "is", null).executeTakeFirst();
    if (!p) throw notFound();
    await requireProjectAction(tx, actor, p.project_id, "plan.update");
    await tx.updateTable("core.project_participants").set({ revoked_at: new Date(), revoked_by: actor.userId }).where("id", "=", participantId).execute();
    await audit(tx, actor, { action: "team.remove", objectType: "project_participant", objectId: participantId, ownerTenantId: p.owner_tenant_id, projectId: p.project_id, before: { userId: p.user_id, role: p.raci_role } });
  });
}

/** Team with each person's access path: the RACI role and, for outsiders, the grant that lets them in. */
export async function listParticipants(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    return tx
      .selectFrom("core.project_participants as p")
      .innerJoin("user as u", "u.id", "p.user_id")
      .select(["p.id", "p.user_id", "u.name", "u.email", "p.member_tenant_id", "p.owner_tenant_id", "p.raci_role", "p.responsibilities", "p.facility_ids", "p.created_at"])
      .where("p.project_id", "=", projectId)
      .where("p.revoked_at", "is", null)
      .orderBy("p.raci_role")
      .execute();
  });
}

// ---------------------------------------------------------------- plan (G2-08)

export async function listPlan(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    await cycleScope(tx, actor, cycleId, "project.read");
    const items = await tx
      .selectFrom("core.work_packages as w")
      .leftJoin("user as r", "r.id", "w.responsible_user_id")
      .leftJoin("user as a", "a.id", "w.accountable_user_id")
      .select(["w.id", "w.gate", "w.title", "w.status", "w.starts_on", "w.due_on", "w.critical", "w.blocked_reason", "w.row_version", "w.responsible_user_id", "w.accountable_user_id", "r.name as responsible_name", "a.name as accountable_name"])
      .where("w.cycle_id", "=", cycleId)
      .orderBy("w.sort")
      .execute();
    const deps = items.length ? await tx.selectFrom("core.work_package_deps").select(["work_package_id", "depends_on_id"]).where("work_package_id", "in", items.map((i) => i.id)).execute() : [];
    return items.map((i) => ({ ...i, deps: deps.filter((d) => d.work_package_id === i.id).map((d) => d.depends_on_id) }));
  });
}

async function refreshCritical(tx: Tx, cycleId: string) {
  const items = await tx.selectFrom("core.work_packages").select(["id", "starts_on", "due_on", "critical"]).where("cycle_id", "=", cycleId).execute();
  const deps = await tx.selectFrom("core.work_package_deps").select(["work_package_id", "depends_on_id"]).where("work_package_id", "in", items.map((i) => i.id)).execute();
  const crit = criticalSet(items.map((i) => ({ id: i.id, startsOn: i.starts_on, dueOn: i.due_on, deps: deps.filter((d) => d.work_package_id === i.id).map((d) => d.depends_on_id) })));
  for (const i of items) if (i.critical !== crit.has(i.id)) await tx.updateTable("core.work_packages").set({ critical: crit.has(i.id) }).where("id", "=", i.id).execute();
}

export type WpPatch = { status?: WpStatus; responsibleUserId?: string | null; accountableUserId?: string | null; startsOn?: string; dueOn?: string; blockedReason?: string | null; title?: string };

/**
 * Updates one work package (If-Match). A status change follows the state machine; starting needs every
 * dependency done; blocking needs a reason; responsible and accountable must be project participants.
 */
export async function updateWorkPackage(actor: Actor, id: string, patch: WpPatch, expectedVersion?: number): Promise<number> {
  return withActor(actor, async (tx) => {
    const w = await tx.selectFrom("core.work_packages").selectAll().where("id", "=", id).forUpdate().executeTakeFirst();
    if (!w) throw notFound();
    await requireProjectAction(tx, actor, w.project_id, "plan.update");
    if (expectedVersion !== undefined && w.row_version !== expectedVersion) throw new HttpError(409, "version_conflict");
    if (patch.status && patch.status !== w.status) {
      if (!WP_TRANSITIONS[w.status as WpStatus].includes(patch.status)) throw new HttpError(409, "invalid_transition");
      if (patch.status === "ready" || patch.status === "active") {
        const open = await tx
          .selectFrom("core.work_package_deps as d")
          .innerJoin("core.work_packages as p", "p.id", "d.depends_on_id")
          .select("p.gate")
          .where("d.work_package_id", "=", id)
          .where("p.status", "!=", "done")
          .execute();
        if (open.length) throw new HttpError(409, "dependencies_open");
      }
      if (patch.status === "blocked" && (patch.blockedReason ?? "").trim().length < 3) throw new HttpError(422, "reason_required");
    }
    for (const u of [patch.responsibleUserId, patch.accountableUserId]) {
      if (!u) continue;
      const p = await tx.selectFrom("core.project_participants").select("id").where("project_id", "=", w.project_id).where("user_id", "=", u).where("revoked_at", "is", null).executeTakeFirst();
      if (!p) throw new HttpError(422, "not_a_participant");
    }
    const startsOn = patch.startsOn ?? w.starts_on;
    const dueOn = patch.dueOn ?? w.due_on;
    if (dueOn < startsOn) throw new HttpError(422, "invalid_dates");
    const r = await tx
      .updateTable("core.work_packages")
      .set({
        ...(patch.status ? { status: patch.status, blocked_reason: patch.status === "blocked" ? patch.blockedReason!.trim() : null } : {}),
        ...(patch.responsibleUserId !== undefined ? { responsible_user_id: patch.responsibleUserId } : {}),
        ...(patch.accountableUserId !== undefined ? { accountable_user_id: patch.accountableUserId } : {}),
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        starts_on: startsOn,
        due_on: dueOn,
      })
      .where("id", "=", id)
      .returning("row_version")
      .executeTakeFirstOrThrow()
      .catch(pg);
    // successors whose dependencies are now all done become ready
    if (patch.status === "done") {
      const succ = await tx.selectFrom("core.work_package_deps as d").innerJoin("core.work_packages as s", "s.id", "d.work_package_id").select(["s.id", "s.status"]).where("d.depends_on_id", "=", id).execute();
      for (const s of succ) {
        if (s.status !== "not_ready") continue;
        const open = await tx.selectFrom("core.work_package_deps as d").innerJoin("core.work_packages as p", "p.id", "d.depends_on_id").select("p.id").where("d.work_package_id", "=", s.id).where("p.status", "!=", "done").executeTakeFirst();
        if (!open) await tx.updateTable("core.work_packages").set({ status: "ready" }).where("id", "=", s.id).execute();
      }
    }
    if (patch.startsOn || patch.dueOn) await refreshCritical(tx, w.cycle_id);
    await audit(tx, actor, { action: "plan.update", objectType: "work_package", objectId: id, ownerTenantId: w.owner_tenant_id, projectId: w.project_id, before: { status: w.status, startsOn: w.starts_on, dueOn: w.due_on }, after: patch });
    return r.row_version;
  });
}

export async function addDependency(actor: Actor, workPackageId: string, dependsOnId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const w = await tx.selectFrom("core.work_packages").select(["id", "project_id", "owner_tenant_id", "cycle_id"]).where("id", "in", [workPackageId, dependsOnId]).execute();
    if (w.length !== 2 || w[0].cycle_id !== w[1].cycle_id) throw notFound();
    await requireProjectAction(tx, actor, w[0].project_id, "plan.update");
    const deps = await tx.selectFrom("core.work_package_deps").select(["work_package_id", "depends_on_id"]).where("project_id", "=", w[0].project_id).execute();
    const map = new Map<string, string[]>();
    for (const d of deps) map.set(d.work_package_id, [...(map.get(d.work_package_id) ?? []), d.depends_on_id]);
    if (workPackageId === dependsOnId || reaches(map, dependsOnId, workPackageId)) throw new HttpError(422, "dependency_cycle");
    await tx.insertInto("core.work_package_deps").values({ owner_tenant_id: w[0].owner_tenant_id, project_id: w[0].project_id, work_package_id: workPackageId, depends_on_id: dependsOnId }).execute().catch(pg);
    await refreshCritical(tx, w[0].cycle_id);
    await audit(tx, actor, { action: "plan.dependency_add", objectType: "work_package", objectId: workPackageId, ownerTenantId: w[0].owner_tenant_id, projectId: w[0].project_id, after: { dependsOn: dependsOnId } });
  });
}

// ---------------------------------------------------------------- engagements and deliverables (G2-04)

export type EngagementStatus = "draft" | "accepted" | "active" | "review" | "paused" | "closed" | "cancelled";
const ENGAGEMENT_FLOW: Record<EngagementStatus, EngagementStatus[]> = {
  draft: ["accepted", "cancelled"],
  accepted: ["active", "cancelled"],
  active: ["review", "paused", "cancelled"],
  paused: ["active", "cancelled"],
  review: ["active", "closed"],
  closed: [],
  cancelled: [],
};

export async function createEngagement(actor: Actor, input: { title: string; scope?: string | null; advisoryTenantId?: string | null; startsOn?: string | null; endsOn?: string | null; ownerTenantId?: string }): Promise<string> {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "project.create");
    const owner = input.ownerTenantId ?? actor.actingTenantId!;
    let advisory = input.advisoryTenantId ?? null;
    if (owner !== actor.actingTenantId) {
      const s = await tx.selectFrom("core.tenants").select("id").where("id", "=", owner).where("lifecycle", "=", "provisional").where("steward_tenant_id", "=", actor.actingTenantId).executeTakeFirst();
      if (!s) throw notFound("tenant_not_found");
      advisory = actor.actingTenantId; // the steward is the advisory of a provisional client's engagement
    }
    const r = await tx
      .insertInto("core.engagements")
      .values({ owner_tenant_id: owner, advisory_tenant_id: advisory, title: input.title.trim(), scope: input.scope ?? null, starts_on: input.startsOn ?? null, ends_on: input.endsOn ?? null, created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pg);
    await audit(tx, actor, { action: "engagement.create", objectType: "engagement", objectId: r.id, ownerTenantId: owner, after: input });
    return r.id;
  });
}

export async function moveEngagement(actor: Actor, id: string, to: EngagementStatus): Promise<void> {
  await withActor(actor, async (tx) => {
    // read first without a lock: the advisory named on the engagement may see it, and is told it cannot change it
    const e = await tx.selectFrom("core.engagements").selectAll().where("id", "=", id).executeTakeFirst();
    if (!e) throw notFound();
    if (e.owner_tenant_id !== actor.actingTenantId) {
      const s = await tx.selectFrom("core.tenants").select("id").where("id", "=", e.owner_tenant_id).where("steward_tenant_id", "=", actor.actingTenantId).executeTakeFirst();
      if (!s) throw forbidden("owner_decision");
    }
    await requireMemberAction(tx, actor, "project.update");
    await tx.selectFrom("core.engagements").select("id").where("id", "=", id).forUpdate().executeTakeFirstOrThrow();
    if (!ENGAGEMENT_FLOW[e.status as EngagementStatus].includes(to)) throw new HttpError(409, "invalid_transition");
    await tx.updateTable("core.engagements").set({ status: to }).where("id", "=", id).execute();
    await audit(tx, actor, { action: "engagement.move", objectType: "engagement", objectId: id, ownerTenantId: e.owner_tenant_id, before: { status: e.status }, after: { status: to } });
  });
}

export type ReportKind = "tsrs" | "gri" | "esrs" | "vsme" | "annual_report" | "integrated" | "ghg_inventory" | "cbam" | "tr_ets" | "cdp" | "other";

export async function addDeliverable(actor: Actor, engagementId: string, input: { title: string; reportKind: ReportKind; dueOn?: string | null; projectId?: string | null }): Promise<string> {
  return withActor(actor, async (tx) => {
    const e = await tx.selectFrom("core.engagements").select(["owner_tenant_id"]).where("id", "=", engagementId).executeTakeFirst();
    if (!e) throw notFound();
    if (input.projectId) await requireProjectAction(tx, actor, input.projectId, "project.update");
    else await requireMemberAction(tx, actor, "project.update");
    const r = await tx
      .insertInto("core.deliverables")
      .values({ owner_tenant_id: e.owner_tenant_id, engagement_id: engagementId, project_id: input.projectId ?? null, title: input.title.trim(), report_kind: input.reportKind, due_on: input.dueOn ?? null, created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow()
      .catch(pg);
    await audit(tx, actor, { action: "deliverable.create", objectType: "deliverable", objectId: r.id, ownerTenantId: e.owner_tenant_id, projectId: input.projectId ?? null, after: input });
    return r.id;
  });
}

export async function listEngagements(actor: Actor) {
  return withActor(actor, async (tx) => {
    const rows = await tx
      .selectFrom("core.engagements as e")
      .innerJoin("core.tenants as o", "o.id", "e.owner_tenant_id")
      .select(["e.id", "e.title", "e.status", "e.starts_on", "e.ends_on", "e.owner_tenant_id", "e.advisory_tenant_id", "o.name as owner_name"])
      .orderBy("e.created_at", "desc")
      .execute();
    const ids = rows.map((r) => r.id);
    const del = ids.length ? await tx.selectFrom("core.deliverables").select(["id", "engagement_id", "title", "report_kind", "due_on", "status", "project_id"]).where("engagement_id", "in", ids).orderBy("due_on").execute() : [];
    return rows.map((r) => ({ ...r, deliverables: del.filter((d) => d.engagement_id === r.id) }));
  });
}

// ---------------------------------------------------------------- portfolio (G2-09)

/** Every project the acting workspace can see, with its latest cycle and the plan's next due, late and blocked items. */
export async function portfolio(actor: Actor) {
  return withActor(actor, async (tx) => {
    const projects = await tx
      .selectFrom("core.projects as p")
      .innerJoin("core.tenants as t", "t.id", "p.owner_tenant_id")
      .select(["p.id", "p.name", "p.status", "p.owner_tenant_id", "t.name as owner_name", "t.lifecycle as owner_lifecycle", "t.steward_tenant_id"])
      .orderBy("t.name")
      .orderBy("p.name")
      .execute();
    if (!projects.length) return [];
    const ids = projects.map((p) => p.id);
    const cycles = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "label", "status", "period_end", "publish_due"]).where("project_id", "in", ids).orderBy("period_end", "desc").execute();
    const today = iso(new Date());
    const wps = await tx.selectFrom("core.work_packages").select(["project_id", "cycle_id", "gate", "status", "due_on", "critical"]).where("project_id", "in", ids).where("status", "!=", "done").execute();
    const grants = await tx.selectFrom("core.external_grants").select(["project_id", "role", "expires_at"]).where("project_id", "in", ids).where("recipient_tenant_id", "=", actor.actingTenantId!).where("revoked_at", "is", null).where("expires_at", ">", new Date()).execute();
    return projects.map((p) => {
      const cycle = cycles.find((c) => c.project_id === p.id) ?? null;
      const open = wps.filter((w) => w.cycle_id === cycle?.id);
      const next = open.slice().sort((a, b) => (a.due_on < b.due_on ? -1 : 1))[0] ?? null;
      const g = grants.find((x) => x.project_id === p.id);
      return {
        ...p,
        access: p.owner_tenant_id === actor.actingTenantId ? "member" : g ? "grant" : p.steward_tenant_id === actor.actingTenantId ? "steward" : "member",
        grantRole: g?.role ?? null,
        grantExpires: g?.expires_at ?? null,
        cycle,
        next,
        late: open.filter((w) => w.due_on < today).length,
        lateCritical: open.filter((w) => w.due_on < today && w.critical).length,
        blocked: open.filter((w) => w.status === "blocked").length,
      };
    });
  });
}

export const PLAN_GATES = GATE_TEMPLATE.map((g) => g.gate);
export { addDays };

/** Choices for the new-project wizard: own and stewarded organisations and engagements, provisional clients. */
export async function wizardOptions(actor: Actor) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "project.create");
    const clients = await tx.selectFrom("core.tenants").select(["id", "name"]).where("steward_tenant_id", "=", actor.actingTenantId!).where("lifecycle", "=", "provisional").orderBy("name").execute();
    const owners = [actor.actingTenantId!, ...clients.map((c) => c.id)];
    const organizations = await tx.selectFrom("core.organizations").select(["id", "name", "owner_tenant_id as owner"]).where("owner_tenant_id", "in", owners).orderBy("name").execute();
    const engagements = await tx.selectFrom("core.engagements").select(["id", "title as name", "owner_tenant_id as owner"]).where("owner_tenant_id", "in", owners).where("status", "not in", ["closed", "cancelled"]).orderBy("title").execute();
    return { clients, organizations, engagements };
  });
}
