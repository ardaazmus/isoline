/**
 * Assurance room (G7-03; plan 10 §5). The assurer works under an "assurance" grant: reads facts, lineage and —
 * when the grant allows downloads — evidence, and asks questions; the company answers with text and evidence; the
 * assurer closes the question. The assurer can never change data (an assurance grant has no write right in RLS).
 * The engagement record keeps the standard, the level and the status; the opinion itself is a file the company
 * adds after the independent provider issued it — the platform never issues assurance.
 */
import { audit } from "../audit/audit";
import { withActor, type Actor } from "../db/client";
import { forbidden, HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";

export async function createEngagement(actor: Actor, cycleId: string, input: { standard: "isae3000" | "isae3410" | "issa5000" | "kgk_gds" | "other"; level: "limited" | "reasonable"; providerTenantId?: string | null }): Promise<{ id: string }> {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "owner_tenant_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    const a = await requireProjectAction(tx, actor, c.project_id, "cycle.close");
    if (a.via !== "member") throw forbidden("owner_decision");
    const r = await tx.insertInto("core.assurance_engagements").values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, cycle_id: cycleId, standard: input.standard, level: input.level, provider_tenant_id: input.providerTenantId ?? null, created_by: actor.userId }).returning("id").executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "assurance.engagement_create", objectType: "assurance_engagement", objectId: r.id, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, after: input });
    return { id: r.id };
  });
}

/** Status of the engagement; "opinion_received" needs the opinion file (evidence) the provider issued. */
export async function setEngagementStatus(actor: Actor, engagementId: string, input: { status: "preparing" | "ready" | "in_progress" | "opinion_received" | "withdrawn"; opinionEvidenceId?: string | null }): Promise<void> {
  await withActor(actor, async (tx) => {
    const e = await tx.selectFrom("core.assurance_engagements").selectAll().where("id", "=", engagementId).executeTakeFirst();
    if (!e) throw notFound();
    const a = await requireProjectAction(tx, actor, e.project_id, "cycle.close");
    if (a.via !== "member") throw forbidden("owner_decision");
    if (input.status === "opinion_received" && !input.opinionEvidenceId) throw new HttpError(422, "opinion_file_required");
    await tx
      .updateTable("core.assurance_engagements")
      .set({ status: input.status, ...(input.status === "opinion_received" ? { opinion_evidence_id: input.opinionEvidenceId!, opinion_recorded_by: actor.userId, opinion_recorded_at: new Date() } : {}) })
      .where("id", "=", engagementId)
      .execute()
      .catch((err: { code?: string }) => {
        if (err.code === "23503") throw notFound("evidence_not_found");
        throw err;
      });
    await audit(tx, actor, { action: "assurance.engagement_status", objectType: "assurance_engagement", objectId: engagementId, ownerTenantId: e.owner_tenant_id, projectId: e.project_id, after: input });
  });
}

export async function askQuestion(actor: Actor, cycleId: string, input: { targetType: "fact" | "evidence" | "report" | "general"; targetId?: string | null; question: string }): Promise<{ id: string }> {
  const q = input.question.trim();
  if (q.length < 10) throw new HttpError(422, "question_too_short");
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "owner_tenant_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    const a = await requireProjectAction(tx, actor, c.project_id, "assurance.query");
    if (a.via !== "grant" || a.grantRole !== "assurance") throw forbidden("assurance_only");
    const eng = await tx.selectFrom("core.assurance_engagements").select("id").where("cycle_id", "=", cycleId).where("status", "not in", ["withdrawn"]).orderBy("created_at", "desc").executeTakeFirst();
    const r = await tx.insertInto("core.assurance_questions").values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, cycle_id: cycleId, engagement_id: eng?.id ?? null, target_type: input.targetType, target_id: input.targetId ?? null, question: q, asked_by: actor.userId, asked_tenant_id: actor.actingTenantId }).returning("id").executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "assurance.question", objectType: "assurance_question", objectId: r.id, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, after: { target: input.targetType, targetId: input.targetId ?? null } });
    return { id: r.id };
  });
}

/** The company answers (never the asker); evidence files of the project can be attached. */
export async function answerQuestion(actor: Actor, questionId: string, input: { answer: string; evidenceIds?: string[] }): Promise<void> {
  const text = input.answer.trim();
  if (text.length < 10) throw new HttpError(422, "answer_too_short");
  await withActor(actor, async (tx) => {
    const q = await tx.selectFrom("core.assurance_questions").selectAll().where("id", "=", questionId).forUpdate().executeTakeFirst();
    if (!q) throw notFound();
    const a = await requireProjectAction(tx, actor, q.project_id, "data.submit");
    if (a.via === "grant") throw forbidden("owner_decision");
    if (q.status === "closed") throw new HttpError(409, "invalid_transition");
    const ev = input.evidenceIds?.length ? await tx.selectFrom("core.evidence_objects").select("id").where("project_id", "=", q.project_id).where("id", "in", input.evidenceIds).execute() : [];
    if (ev.length !== (input.evidenceIds?.length ?? 0)) throw notFound("evidence_not_found");
    await tx.updateTable("core.assurance_questions").set({ status: "answered", answer: text, answer_evidence_ids: input.evidenceIds ?? [], answered_by: actor.userId, answered_at: new Date() }).where("id", "=", questionId).execute();
    await audit(tx, actor, { action: "assurance.answer", objectType: "assurance_question", objectId: questionId, ownerTenantId: q.owner_tenant_id, projectId: q.project_id, after: { evidence: input.evidenceIds?.length ?? 0 } });
  });
}

/** The assurer closes an answered question (or reopens it by asking again). */
export async function closeQuestion(actor: Actor, questionId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const q = await tx.selectFrom("core.assurance_questions").selectAll().where("id", "=", questionId).forUpdate().executeTakeFirst();
    if (!q) throw notFound();
    await requireProjectAction(tx, actor, q.project_id, "assurance.query");
    if (q.asked_by !== actor.userId) throw forbidden("not_asker");
    if (q.status !== "answered") throw new HttpError(409, "invalid_transition");
    await tx.updateTable("core.assurance_questions").set({ status: "closed", closed_by: actor.userId, closed_at: new Date() }).where("id", "=", questionId).execute();
    await audit(tx, actor, { action: "assurance.close", objectType: "assurance_question", objectId: questionId, ownerTenantId: q.owner_tenant_id, projectId: q.project_id });
  });
}

export async function assuranceRoom(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "label", "status"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    const access = await requireProjectAction(tx, actor, c.project_id, "project.read");
    const engagement = await tx.selectFrom("core.assurance_engagements").selectAll().where("cycle_id", "=", cycleId).orderBy("created_at", "desc").executeTakeFirst();
    // the room shows the frozen snapshot when there is one, else the approved facts
    const snap = await tx.selectFrom("core.cycle_snapshots").select(["id", "version", "content_sha256", "frozen_at"]).where("cycle_id", "=", cycleId).where("status", "=", "frozen").executeTakeFirst();
    const facts = snap
      ? await tx.selectFrom("core.snapshot_facts as f").select(["f.fact_id as id", "f.metric_key", "f.facility_id", "f.boundary_kind", "f.value_num", "f.value_text", "f.unit", "f.suppressed"]).where("f.snapshot_id", "=", snap.id).where("f.facility_id", "is", null).orderBy("f.metric_key").execute()
      : await tx.selectFrom("core.metric_fact_versions as f").select(["f.id", "f.metric_key", "f.facility_id", "f.boundary_kind", "f.value_num", "f.value_text", "f.unit", "f.suppressed"]).where("f.cycle_id", "=", cycleId).where("f.status", "in", ["approved", "locked"]).where("f.facility_id", "is", null).orderBy("f.metric_key").execute();
    const questions = await tx
      .selectFrom("core.assurance_questions as q")
      .leftJoin("user as a", "a.id", "q.asked_by")
      .leftJoin("user as b", "b.id", "q.answered_by")
      .select(["q.id", "q.target_type", "q.target_id", "q.question", "q.status", "q.answer", "q.answer_evidence_ids", "q.asked_at", "q.answered_at", "q.asked_by", "a.name as asked_by_name", "b.name as answered_by_name"])
      .where("q.cycle_id", "=", cycleId)
      .orderBy("q.asked_at", "desc")
      .execute();
    return { cycle: c, access: { via: access.via, grantRole: access.via === "grant" ? access.grantRole : null }, engagement: engagement ?? null, snapshot: snap ?? null, facts, questions };
  });
}
