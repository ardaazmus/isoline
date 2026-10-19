/**
 * DataOps (G3-02..G3-09; plan 05 §3): campaigns generated from the chosen report templates, requests per metric ×
 * facility × period, assignment with a separate reviewer, the contributor's draft → submit, the reviewer's
 * accept or return-with-reason, versioned observations, evidence links, comments and notifications.
 *
 * Request state machine (server-enforced):
 *   created → assigned → sent → submitted → reviewing → accepted
 *                                   ↘ revision_required → (new version) → submitted
 *   created/assigned/sent → withdrawn | not_applicable (with a reason)
 */
import { sql } from "kysely";
import { generateRequests, suggestTemplates } from "@/lib/requests";
import type { Finding, Profile } from "@/lib/calc/applicability";
import { audit, enqueue } from "../audit/audit";
import { withActor, withSystem, type Actor, type Tx } from "../db/client";
import { forbidden, HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { METRIC, type MetricDef } from "./catalog";
import { dimensionOf, normalizeUnit, plainDecimal, toCanonical } from "./units";

export type RequestStatus = "created" | "assigned" | "sent" | "submitted" | "reviewing" | "accepted" | "revision_required" | "withdrawn" | "not_applicable";

export const REVIEWER_ROLES = ["project_lead", "data_lead", "data_owner", "technical_reviewer", "advisor_reviewer"];
export const ASSIGNEE_ROLES = ["project_lead", "data_lead", "data_owner", "contributor", "advisor_preparer", "technical_reviewer"];

const pg = (e: unknown): never => {
  const c = (e as { code?: string }).code;
  if (c === "23514") throw new HttpError(422, "invalid_input");
  if (c === "23505") throw new HttpError(409, "conflict");
  if (c === "23503") throw new HttpError(404, "not_found");
  throw e;
};

// ---------------------------------------------------------------- campaign generation (G3-02)

/** Templates the confirmed applicability decisions point to (falls back to suggestions while undecided). */
export async function suggestedTemplates(actor: Actor, cycleId: string): Promise<{ suggestions: { template: string; finding: string }[]; basedOnDecisions: boolean }> {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["project_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    const rows = await tx.selectFrom("core.applicability_assessments").select(["regime", "suggestion", "decision", "confirmed_at", "inputs"]).where("cycle_id", "=", cycleId).where("superseded_at", "is", null).execute();
    const decided = rows.some((r) => r.decision && r.confirmed_at);
    const status = (r: (typeof rows)[number]): Finding["status"] => {
      if (!decided) return r.suggestion as Finding["status"];
      if (!(r.decision && r.confirmed_at)) return "not_applicable";
      return r.decision === "in_scope" ? "required" : r.decision === "voluntary" ? (r.suggestion === "indirect" ? "indirect" : "voluntary") : "not_applicable";
    };
    const findings: Finding[] = rows.map((r) => ({ id: r.regime, status: status(r), dates: [], notes: [], sources: [] }));
    const profile = (rows[0]?.inputs ?? { entityType: "unlisted_company" }) as unknown as Pick<Profile, "entityType">;
    return { suggestions: suggestTemplates(findings, profile), basedOnDecisions: decided };
  });
}

export type CampaignInput = { title: string; templateIds: string[]; dueOn?: string | null; facilityIds?: string[] | null };

/**
 * Builds (or extends) a campaign: one request per data point the templates need, per facility for facility-level
 * metrics. Re-running with more templates adds only the missing requests and widens the traces of existing ones.
 */
export async function createCampaign(actor: Actor, cycleId: string, input: CampaignInput, campaignId?: string): Promise<{ campaignId: string; created: number; updated: number }> {
  if (!input.templateIds.length) throw new HttpError(422, "templates_required");
  return withActor(actor, async (tx) => {
    const cycle = await tx.selectFrom("core.reporting_cycles").selectAll().where("id", "=", cycleId).executeTakeFirst();
    if (!cycle) throw notFound("cycle_not_found");
    const access = await requireProjectAction(tx, actor, cycle.project_id, "data.request");
    const project = await tx.selectFrom("core.projects").select(["organization_id"]).where("id", "=", cycle.project_id).executeTakeFirstOrThrow();
    const asOf = cycle.period_end;
    let facilities: { id: string; name: string }[] = [];
    if (project.organization_id) {
      facilities = await tx
        .selectFrom("core.facilities as f")
        .innerJoin("core.legal_entities as e", "e.id", "f.legal_entity_id")
        .select(["f.id", "f.name"])
        .where("e.organization_id", "=", project.organization_id)
        .where((eb) => eb.or([eb("f.valid_from", "is", null), eb("f.valid_from", "<=", asOf)]))
        .where((eb) => eb.or([eb("f.valid_to", "is", null), eb("f.valid_to", ">=", cycle.period_start)]))
        .orderBy("f.name")
        .execute();
      if (input.facilityIds?.length) facilities = facilities.filter((f) => input.facilityIds!.includes(f.id));
    }
    const year = cycle.reporting_year;
    const base = await tx.selectFrom("core.reporting_cycles").select("reporting_year").where("project_id", "=", cycle.project_id).where("is_base_year", "=", true).orderBy("reporting_year").executeTakeFirst();
    const items = generateRequests({ profile: { reportingYear: year } as Profile, pathway: { baseYear: base?.reporting_year ?? year - 1, targetYear: year + 4 } as never }, input.templateIds);
    if (!items.length) throw new HttpError(422, "nothing_to_request");

    let id = campaignId;
    if (!id) {
      const c = await tx
        .insertInto("core.data_campaigns")
        .values({ owner_tenant_id: access.ownerTenantId, project_id: cycle.project_id, cycle_id: cycleId, title: input.title.trim() || `${cycle.label} veri kampanyası`, template_ids: input.templateIds, default_due: input.dueOn ?? null, created_by: actor.userId })
        .returning("id")
        .executeTakeFirstOrThrow()
        .catch(pg);
      id = c.id;
    } else {
      const c = await tx.selectFrom("core.data_campaigns").select(["template_ids", "cycle_id"]).where("id", "=", id).executeTakeFirst();
      if (!c || c.cycle_id !== cycleId) throw notFound("campaign_not_found");
      await tx.updateTable("core.data_campaigns").set({ template_ids: [...new Set([...c.template_ids, ...input.templateIds])] }).where("id", "=", id).execute();
    }
    const existing = await tx.selectFrom("core.data_requests").select(["id", "metric_code", "facility_id", "traces"]).where("campaign_id", "=", id).execute();
    const key = (code: string, f: string | null) => `${code}|${f ?? ""}`;
    const have = new Map(existing.map((r) => [key(r.metric_code, r.facility_id), r]));
    let created = 0;
    let updated = 0;
    for (const it of items) {
      const m = METRIC.get(it.id);
      if (!m) continue;
      const targets: (string | null)[] = m.grain === "facility" && facilities.length ? facilities.map((f) => f.id) : [null];
      const periodStart = it.when === "year" ? cycle.period_start : it.when === "prior" ? `${year - 1}-01-01` : null;
      const periodEnd = it.when === "year" ? cycle.period_end : it.when === "prior" ? `${year - 1}-12-31` : null;
      for (const f of targets) {
        const ex = have.get(key(it.id, f));
        if (ex) {
          const merged = [...(ex.traces as unknown as object[]), ...it.traces].filter((t, i, a) => a.findIndex((x) => JSON.stringify(x) === JSON.stringify(t)) === i);
          if (merged.length !== (ex.traces as unknown as object[]).length) {
            await tx.updateTable("core.data_requests").set({ traces: JSON.stringify(merged) }).where("id", "=", ex.id).execute();
            updated++;
          }
          continue;
        }
        await tx
          .insertInto("core.data_requests")
          .values({ owner_tenant_id: access.ownerTenantId, project_id: cycle.project_id, cycle_id: cycleId, campaign_id: id, metric_code: m.code, metric_version: m.version, facility_id: f, period_label: it.period, period_start: periodStart, period_end: periodEnd, due_on: input.dueOn ?? null, traces: JSON.stringify(it.traces), created_by: actor.userId })
          .execute()
          .catch(pg);
        created++;
      }
    }
    await audit(tx, actor, { action: campaignId ? "campaign.extend" : "campaign.create", objectType: "data_campaign", objectId: id, ownerTenantId: access.ownerTenantId, projectId: cycle.project_id, after: { templates: input.templateIds, created, updated, facilities: facilities.length } });
    return { campaignId: id, created, updated };
  });
}

export async function listCampaigns(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    const campaigns = await tx.selectFrom("core.data_campaigns").selectAll().where("project_id", "=", projectId).orderBy("created_at", "desc").execute();
    const counts = campaigns.length
      ? await tx.selectFrom("core.data_requests").select(["campaign_id", "status", sql<number>`count(*)`.as("n")]).where("campaign_id", "in", campaigns.map((c) => c.id)).groupBy(["campaign_id", "status"]).execute()
      : [];
    return campaigns.map((c) => ({ ...c, counts: Object.fromEntries(counts.filter((x) => x.campaign_id === c.id).map((x) => [x.status, Number(x.n)])) as Record<string, number> }));
  });
}

export type RequestRow = Awaited<ReturnType<typeof listRequests>>[number];

/** Requests of a campaign with people, facility and evidence counts (the actor sees what RLS lets through). */
export async function listRequests(actor: Actor, campaignId: string) {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.data_campaigns").select(["project_id"]).where("id", "=", campaignId).executeTakeFirst();
    if (!c) throw notFound("campaign_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    return tx
      .selectFrom("core.data_requests as r")
      .leftJoin("core.facilities as f", "f.id", "r.facility_id")
      .leftJoin("user as a", "a.id", "r.assignee_user_id")
      .leftJoin("user as v", "v.id", "r.reviewer_user_id")
      .select([
        "r.id",
        "r.metric_code",
        "r.facility_id",
        "f.name as facility_name",
        "r.period_label",
        "r.status",
        "r.due_on",
        "r.critical",
        "r.returns",
        "r.assignee_user_id",
        "r.reviewer_user_id",
        "a.name as assignee_name",
        "v.name as reviewer_name",
        "r.row_version",
        "r.traces",
        sql<number>`(select count(*) from core.evidence_links l where l.target_type = 'data_request' and l.target_id = r.id and l.unlinked_at is null)`.as("evidence"),
      ])
      .where("r.campaign_id", "=", campaignId)
      .orderBy("r.metric_code")
      .orderBy("f.name")
      .execute();
  });
}

// ---------------------------------------------------------------- assignment and sending (G3-03, G3-09 bulk)

async function participant(tx: Tx, projectId: string, userId: string) {
  return tx.selectFrom("core.project_participants").select(["raci_role", "facility_ids"]).where("project_id", "=", projectId).where("user_id", "=", userId).where("revoked_at", "is", null).execute();
}

export type AssignInput = { assigneeUserId?: string | null; reviewerUserId?: string | null; dueOn?: string | null; critical?: boolean };

/** Bulk assignment: people must be on the team in a fitting role; a facility-scoped contributor only gets their facilities. */
export async function assignRequests(actor: Actor, requestIds: string[], input: AssignInput): Promise<{ changed: number }> {
  if (!requestIds.length) return { changed: 0 };
  if (input.assigneeUserId && input.assigneeUserId === input.reviewerUserId) throw new HttpError(422, "reviewer_must_differ");
  return withActor(actor, async (tx) => {
    const rows = await tx.selectFrom("core.data_requests").selectAll().where("id", "in", requestIds).forUpdate().execute();
    if (rows.length !== new Set(requestIds).size) throw notFound();
    const projects = new Set(rows.map((r) => r.project_id));
    if (projects.size !== 1) throw new HttpError(422, "one_project_at_a_time");
    const projectId = rows[0].project_id;
    await requireProjectAction(tx, actor, projectId, "data.request");
    const aRoles = input.assigneeUserId ? await participant(tx, projectId, input.assigneeUserId) : [];
    const rRoles = input.reviewerUserId ? await participant(tx, projectId, input.reviewerUserId) : [];
    if (input.assigneeUserId && !aRoles.some((p) => ASSIGNEE_ROLES.includes(p.raci_role))) throw new HttpError(422, "assignee_not_on_team");
    if (input.reviewerUserId && !rRoles.some((p) => REVIEWER_ROLES.includes(p.raci_role))) throw new HttpError(422, "reviewer_not_on_team");
    const scope = aRoles.flatMap((p) => p.facility_ids);
    let changed = 0;
    for (const r of rows) {
      if (["submitted", "reviewing", "accepted", "withdrawn", "not_applicable"].includes(r.status)) continue;
      const assignee = input.assigneeUserId !== undefined ? input.assigneeUserId : r.assignee_user_id;
      const reviewer = input.reviewerUserId !== undefined ? input.reviewerUserId : r.reviewer_user_id;
      if (assignee && reviewer && assignee === reviewer) throw new HttpError(422, "reviewer_must_differ");
      if (input.assigneeUserId && scope.length && r.facility_id && !scope.includes(r.facility_id)) throw new HttpError(422, "facility_out_of_scope");
      const status: RequestStatus = r.status === "created" && assignee && reviewer ? "assigned" : (r.status as RequestStatus);
      await tx
        .updateTable("core.data_requests")
        .set({ assignee_user_id: assignee, reviewer_user_id: reviewer, status, ...(input.dueOn !== undefined ? { due_on: input.dueOn } : {}), ...(input.critical !== undefined ? { critical: input.critical } : {}) })
        .where("id", "=", r.id)
        .execute()
        .catch(pg);
      changed++;
    }
    await audit(tx, actor, { action: "request.assign", objectType: "data_request", objectId: rows.map((r) => r.id).join(",").slice(0, 900), ownerTenantId: rows[0].owner_tenant_id, projectId, after: { ...input, count: changed } });
    return { changed };
  });
}

/** Sends assigned requests to their people (one notification and mail each, idempotent per request version). */
export async function sendRequests(actor: Actor, requestIds: string[]): Promise<{ sent: number }> {
  return withActor(actor, async (tx) => {
    const rows = await tx.selectFrom("core.data_requests").selectAll().where("id", "in", requestIds).forUpdate().execute();
    if (!rows.length) return { sent: 0 };
    const projectId = rows[0].project_id;
    if (rows.some((r) => r.project_id !== projectId)) throw new HttpError(422, "one_project_at_a_time");
    await requireProjectAction(tx, actor, projectId, "data.request");
    let sent = 0;
    for (const r of rows) {
      if (r.status !== "assigned") continue;
      await tx.updateTable("core.data_requests").set({ status: "sent" }).where("id", "=", r.id).execute();
      await enqueue(tx, "notify", { userId: r.assignee_user_id, ownerTenantId: r.owner_tenant_id, projectId, kind: "task_sent", payload: { requestId: r.id, metric: r.metric_code, due: r.due_on }, mail: true }, { ownerTenantId: r.owner_tenant_id, dedupeKey: `task:${r.id}:sent:${r.row_version}` });
      sent++;
    }
    await audit(tx, actor, { action: "request.send", objectType: "data_request", objectId: rows.map((r) => r.id).join(",").slice(0, 900), ownerTenantId: rows[0].owner_tenant_id, projectId, after: { sent } });
    return { sent };
  });
}

export async function closeRequest(actor: Actor, requestId: string, to: "withdrawn" | "not_applicable", reason: string): Promise<void> {
  if (reason.trim().length < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.data_requests").selectAll().where("id", "=", requestId).forUpdate().executeTakeFirst();
    if (!r) throw notFound();
    await requireProjectAction(tx, actor, r.project_id, "data.request");
    if (!["created", "assigned", "sent", "revision_required"].includes(r.status)) throw new HttpError(409, "invalid_transition");
    await tx.updateTable("core.data_requests").set({ status: to, na_reason: reason.trim() }).where("id", "=", requestId).execute();
    await tx.insertInto("core.request_comments").values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, request_id: r.id, author_user_id: actor.userId, kind: to === "withdrawn" ? "system" : "not_applicable", body: reason.trim() }).execute();
    await audit(tx, actor, { action: `request.${to}`, objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, before: { status: r.status }, payload: { reason: reason.trim() } });
  });
}

// ---------------------------------------------------------------- the contributor's task (G3-04, G3-07)

export type DraftInput = { value?: string | number | null; unit?: string | null; text?: string | null; lines?: { key: string; label?: string; value: string | number; unit: string }[] | null; quality?: "measured" | "calculated" | "estimated"; methodNote?: string | null; sourceRef?: string | null };

type Normalised = { value_num: string | null; unit_code: string | null; canonical_value: string | null; canonical_unit: string | null; value_text: string | null; lines: string | null };

/** Checks the entered value against the metric: number format, unit dimension, line keys; converts to canonical. */
export function normaliseEntry(m: MetricDef, d: DraftInput): Normalised {
  const numeric = !m.dimensions.includes("none");
  const one = (raw: string | number, unitRaw: string) => {
    const v = plainDecimal(raw);
    if (v === null) throw new HttpError(422, "invalid_number");
    const unit = normalizeUnit(unitRaw);
    if (!unit) throw new HttpError(422, "unknown_unit");
    const dim = dimensionOf(unit)!;
    if (!m.dimensions.includes(dim)) throw new HttpError(422, "unit_not_allowed");
    if (v.startsWith("-") && dim !== "money") throw new HttpError(422, "negative_value");
    const c = toCanonical(v, unit);
    return { value: v, unit, canonical: c.value, canonicalUnit: c.unit };
  };
  if (m.multiline) {
    if (!d.lines?.length) throw new HttpError(422, "lines_required");
    const keys = new Set<string>();
    const lines = d.lines.map((l) => {
      if (m.lineKeys.length && !m.lineKeys.includes(l.key)) throw new HttpError(422, "unknown_line");
      if (keys.has(l.key)) throw new HttpError(422, "duplicate_line");
      keys.add(l.key);
      const x = one(l.value, l.unit);
      return { key: l.key, label: l.label ?? null, value: x.value, unit: x.unit, canonical: x.canonical, canonicalUnit: x.canonicalUnit };
    });
    return { value_num: null, unit_code: null, canonical_value: null, canonical_unit: null, value_text: d.text?.trim() || null, lines: JSON.stringify(lines) };
  }
  if (numeric) {
    if (d.value === null || d.value === undefined || d.value === "") {
      if (d.text?.trim()) return { value_num: null, unit_code: null, canonical_value: null, canonical_unit: null, value_text: d.text.trim(), lines: null };
      throw new HttpError(422, "value_required");
    }
    const x = one(d.value, d.unit ?? "");
    return { value_num: x.value, unit_code: x.unit, canonical_value: x.canonical, canonical_unit: x.canonicalUnit, value_text: d.text?.trim() || null, lines: null };
  }
  if (!d.text?.trim()) throw new HttpError(422, "text_required");
  return { value_num: null, unit_code: null, canonical_value: null, canonical_unit: null, value_text: d.text.trim(), lines: null };
}

async function requestForAssignee(tx: Tx, actor: Actor, requestId: string) {
  const r = await tx.selectFrom("core.data_requests").selectAll().where("id", "=", requestId).forUpdate().executeTakeFirst();
  if (!r) throw notFound("request_not_found");
  await requireProjectAction(tx, actor, r.project_id, "data.submit");
  if (r.assignee_user_id !== actor.userId) throw forbidden("not_assignee");
  return r;
}

/** Saves the assignee's draft (one draft per request; earlier submitted versions stay as they are). */
export async function saveDraft(actor: Actor, requestId: string, d: DraftInput, importId?: string): Promise<{ versionId: string; revision: number }> {
  return withActor(actor, async (tx) => {
    const r = await requestForAssignee(tx, actor, requestId);
    if (!["assigned", "sent", "revision_required"].includes(r.status)) throw new HttpError(409, "not_editable");
    const m = METRIC.get(r.metric_code);
    if (!m) throw new HttpError(422, "unknown_metric");
    const n = normaliseEntry(m, d);
    const draft = await tx.selectFrom("core.observation_versions").select(["id", "revision"]).where("request_id", "=", requestId).where("status", "=", "draft").executeTakeFirst();
    const fields = { ...n, quality: d.quality ?? "measured", method_note: d.methodNote?.trim() || null, source_ref: d.sourceRef?.trim() || null, import_id: importId ?? null };
    if (draft) {
      await tx.updateTable("core.observation_versions").set(fields).where("id", "=", draft.id).execute().catch(pg);
      return { versionId: draft.id, revision: draft.revision };
    }
    const last = await tx.selectFrom("core.observation_versions").select(sql<number>`coalesce(max(revision), 0)`.as("r")).where("request_id", "=", requestId).executeTakeFirstOrThrow();
    const v = await tx
      .insertInto("core.observation_versions")
      .values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, request_id: r.id, revision: Number(last.r) + 1, entered_by: actor.userId, ...fields })
      .returning(["id", "revision"])
      .executeTakeFirstOrThrow()
      .catch(pg);
    return { versionId: v.id, revision: v.revision };
  });
}

async function activeEvidence(tx: Tx, requestId: string): Promise<number> {
  const r = await tx.selectFrom("core.evidence_links").select(sql<number>`count(*)`.as("n")).where("target_type", "=", "data_request").where("target_id", "=", requestId).where("unlinked_at", "is", null).executeTakeFirstOrThrow();
  return Number(r.n);
}

/** Links a project evidence file (uploaded or existing) to the request. */
export async function linkEvidence(actor: Actor, requestId: string, evidenceId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.data_requests").select(["id", "project_id", "owner_tenant_id", "assignee_user_id", "status"]).where("id", "=", requestId).executeTakeFirst();
    if (!r) throw notFound("request_not_found");
    await requireProjectAction(tx, actor, r.project_id, "evidence.upload");
    const e = await tx.selectFrom("core.evidence_objects").select(["id", "project_id", "scan_status"]).where("id", "=", evidenceId).executeTakeFirst();
    if (!e || e.project_id !== r.project_id) throw notFound("evidence_not_found");
    if (e.scan_status === "quarantined" || e.scan_status === "rejected") throw new HttpError(409, `evidence_${e.scan_status}`);
    await tx
      .insertInto("core.evidence_links")
      .values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, evidence_id: evidenceId, target_type: "data_request", target_id: requestId, linked_by: actor.userId })
      .execute()
      .catch(pg);
    await audit(tx, actor, { action: "evidence.link", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, after: { evidenceId } });
  });
}

export async function unlinkEvidence(actor: Actor, requestId: string, evidenceId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.data_requests").select(["project_id", "owner_tenant_id", "status"]).where("id", "=", requestId).executeTakeFirst();
    if (!r) throw notFound();
    await requireProjectAction(tx, actor, r.project_id, "evidence.upload");
    if (["submitted", "reviewing", "accepted"].includes(r.status)) throw new HttpError(409, "not_editable");
    const u = await tx.updateTable("core.evidence_links").set({ unlinked_at: new Date(), unlinked_by: actor.userId }).where("target_type", "=", "data_request").where("target_id", "=", requestId).where("evidence_id", "=", evidenceId).where("unlinked_at", "is", null).returning("id").executeTakeFirst();
    if (!u) throw notFound();
    await audit(tx, actor, { action: "evidence.unlink", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, before: { evidenceId } });
  });
}

/** Submits the draft: evidence required by the metric must be attached; the reviewer is notified. */
export async function submitTask(actor: Actor, requestId: string, note?: string | null): Promise<void> {
  await withActor(actor, async (tx) => {
    const r = await requestForAssignee(tx, actor, requestId);
    if (!["assigned", "sent", "revision_required"].includes(r.status)) throw new HttpError(409, "invalid_transition");
    const draft = await tx.selectFrom("core.observation_versions").select(["id", "revision"]).where("request_id", "=", requestId).where("status", "=", "draft").executeTakeFirst();
    if (!draft) throw new HttpError(422, "value_required");
    const m = METRIC.get(r.metric_code)!;
    if (m.evidenceRequired && (await activeEvidence(tx, requestId)) === 0) throw new HttpError(422, "evidence_required");
    const now = new Date();
    await tx.updateTable("core.observation_versions").set({ status: "submitted", submitted_at: now }).where("id", "=", draft.id).execute();
    await tx.updateTable("core.data_requests").set({ status: "submitted", submitted_at: now }).where("id", "=", requestId).execute();
    if (note?.trim() || r.returns > 0) await tx.insertInto("core.request_comments").values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, request_id: r.id, author_user_id: actor.userId, kind: r.returns > 0 ? "resubmit" : "comment", body: note?.trim() || "—" }).execute();
    await enqueue(tx, "notify", { userId: r.reviewer_user_id, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, kind: "task_submitted", payload: { requestId, metric: r.metric_code, revision: draft.revision }, mail: true }, { ownerTenantId: r.owner_tenant_id, dedupeKey: `task:${r.id}:submitted:${draft.revision}` });
    await audit(tx, actor, { action: "request.submit", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, before: { status: r.status }, after: { status: "submitted", version: draft.id, revision: draft.revision } });
  });
}

// ---------------------------------------------------------------- review (separation of duties)

async function requestForReviewer(tx: Tx, actor: Actor, requestId: string) {
  const r = await tx.selectFrom("core.data_requests").selectAll().where("id", "=", requestId).forUpdate().executeTakeFirst();
  if (!r) throw notFound("request_not_found");
  await requireProjectAction(tx, actor, r.project_id, "data.review");
  if (r.reviewer_user_id !== actor.userId) throw forbidden("not_reviewer");
  return r;
}

export async function startReview(actor: Actor, requestId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const r = await requestForReviewer(tx, actor, requestId);
    if (r.status !== "submitted") throw new HttpError(409, "invalid_transition");
    await tx.updateTable("core.data_requests").set({ status: "reviewing" }).where("id", "=", requestId).execute();
    await audit(tx, actor, { action: "request.review_start", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id });
  });
}

/** Accepts the submitted version. The person who entered it can never accept it (service + DB CHECK). */
export async function acceptTask(actor: Actor, requestId: string, expectedVersion?: number): Promise<void> {
  await withActor(actor, async (tx) => {
    const r = await requestForReviewer(tx, actor, requestId);
    if (expectedVersion !== undefined && r.row_version !== expectedVersion) throw new HttpError(409, "version_conflict");
    if (!["submitted", "reviewing"].includes(r.status)) throw new HttpError(409, "invalid_transition");
    const v = await tx.selectFrom("core.observation_versions").select(["id", "entered_by", "revision"]).where("request_id", "=", requestId).where("status", "=", "submitted").orderBy("revision", "desc").executeTakeFirst();
    if (!v) throw new HttpError(409, "nothing_submitted");
    if (v.entered_by === actor.userId) throw forbidden("own_work");
    const now = new Date();
    await tx.updateTable("core.observation_versions").set({ status: "superseded" }).where("request_id", "=", requestId).where("status", "=", "accepted").execute();
    await tx.updateTable("core.observation_versions").set({ status: "accepted", decided_by: actor.userId, decided_at: now }).where("id", "=", v.id).execute().catch(pg);
    await tx.updateTable("core.data_requests").set({ status: "accepted", accepted_at: now, accepted_by: actor.userId }).where("id", "=", requestId).execute().catch(pg);
    await enqueue(tx, "notify", { userId: r.assignee_user_id, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, kind: "task_accepted", payload: { requestId, metric: r.metric_code }, mail: false }, { ownerTenantId: r.owner_tenant_id, dedupeKey: `task:${r.id}:accepted:${v.revision}` });
    await audit(tx, actor, { action: "request.accept", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, after: { version: v.id, revision: v.revision } });
  });
}

/** Returns the submission with a reason (≥ 10 characters); the contributor sees why and resubmits a new version. */
export async function returnTask(actor: Actor, requestId: string, reason: string): Promise<void> {
  if (reason.trim().length < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const r = await requestForReviewer(tx, actor, requestId);
    if (!["submitted", "reviewing"].includes(r.status)) throw new HttpError(409, "invalid_transition");
    const v = await tx.selectFrom("core.observation_versions").select(["id", "entered_by", "revision"]).where("request_id", "=", requestId).where("status", "=", "submitted").orderBy("revision", "desc").executeTakeFirst();
    if (v) {
      if (v.entered_by === actor.userId) throw forbidden("own_work");
      await tx.updateTable("core.observation_versions").set({ status: "rejected", decided_by: actor.userId, decided_at: new Date() }).where("id", "=", v.id).execute().catch(pg);
    }
    await tx.updateTable("core.data_requests").set({ status: "revision_required", returns: r.returns + 1 }).where("id", "=", requestId).execute();
    await tx.insertInto("core.request_comments").values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, request_id: r.id, author_user_id: actor.userId, kind: "return", body: reason.trim() }).execute();
    await enqueue(tx, "notify", { userId: r.assignee_user_id, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, kind: "task_returned", payload: { requestId, metric: r.metric_code, reason: reason.trim().slice(0, 300) }, mail: true }, { ownerTenantId: r.owner_tenant_id, dedupeKey: `task:${r.id}:returned:${r.returns + 1}` });
    await audit(tx, actor, { action: "request.return", objectType: "data_request", objectId: requestId, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, after: { returns: r.returns + 1 }, payload: { reason: reason.trim() } });
  });
}

export async function addComment(actor: Actor, requestId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text || text.length > 4000) throw new HttpError(422, "invalid_input");
  await withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.data_requests").select(["id", "project_id", "owner_tenant_id", "assignee_user_id", "reviewer_user_id"]).where("id", "=", requestId).executeTakeFirst();
    if (!r) throw notFound();
    await requireProjectAction(tx, actor, r.project_id, "project.read");
    await tx.insertInto("core.request_comments").values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, request_id: r.id, author_user_id: actor.userId, kind: "comment", body: text }).execute();
    const other = actor.userId === r.assignee_user_id ? r.reviewer_user_id : r.assignee_user_id;
    if (other) await enqueue(tx, "notify", { userId: other, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, kind: "task_comment", payload: { requestId, excerpt: text.slice(0, 160) }, mail: false });
  });
}

/** Everything the task screen needs, with what this person may do. */
export async function getTask(actor: Actor, requestId: string) {
  return withActor(actor, async (tx) => {
    const r = await tx
      .selectFrom("core.data_requests as r")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .innerJoin("core.reporting_cycles as c", "c.id", "r.cycle_id")
      .leftJoin("core.facilities as f", "f.id", "r.facility_id")
      .leftJoin("user as a", "a.id", "r.assignee_user_id")
      .leftJoin("user as v", "v.id", "r.reviewer_user_id")
      .select(["r.id", "r.project_id", "r.owner_tenant_id", "r.metric_code", "r.facility_id", "f.name as facility_name", "r.period_label", "r.period_start", "r.period_end", "r.status", "r.due_on", "r.critical", "r.returns", "r.instructions", "r.na_reason", "r.traces", "r.assignee_user_id", "r.reviewer_user_id", "a.name as assignee_name", "v.name as reviewer_name", "r.row_version", "p.name as project_name", "c.label as cycle_label"])
      .where("r.id", "=", requestId)
      .executeTakeFirst();
    if (!r) throw notFound("request_not_found");
    const access = await requireProjectAction(tx, actor, r.project_id, "project.read");
    const versions = await tx
      .selectFrom("core.observation_versions as o")
      .leftJoin("user as e", "e.id", "o.entered_by")
      .leftJoin("user as d", "d.id", "o.decided_by")
      .select(["o.id", "o.revision", "o.value_num", "o.unit_code", "o.canonical_value", "o.canonical_unit", "o.value_text", "o.lines", "o.quality", "o.method_note", "o.source_ref", "o.status", "o.created_at", "o.submitted_at", "o.decided_at", "o.import_id", "e.name as entered_by_name", "d.name as decided_by_name"])
      .where("o.request_id", "=", requestId)
      .orderBy("o.revision", "desc")
      .execute();
    const evidence = await tx
      .selectFrom("core.evidence_links as l")
      .innerJoin("core.evidence_objects as e", "e.id", "l.evidence_id")
      .select(["e.id", "e.filename", "e.scan_status", "e.sha256", "e.size_bytes", "l.created_at"])
      .where("l.target_type", "=", "data_request")
      .where("l.target_id", "=", requestId)
      .where("l.unlinked_at", "is", null)
      .execute();
    const comments = await tx
      .selectFrom("core.request_comments as c")
      .leftJoin("user as u", "u.id", "c.author_user_id")
      .select(["c.id", "c.kind", "c.body", "c.created_at", "u.name as author"])
      .where("c.request_id", "=", requestId)
      .orderBy("c.created_at")
      .execute();
    const metric = METRIC.get(r.metric_code)!;
    return {
      request: r,
      metric,
      versions,
      evidence,
      comments,
      access,
      can: {
        edit: r.assignee_user_id === actor.userId && ["assigned", "sent", "revision_required"].includes(r.status),
        review: r.reviewer_user_id === actor.userId && ["submitted", "reviewing"].includes(r.status),
      },
    };
  });
}

/** DATA-04: tasks waiting for me (as assignee or reviewer) in the acting workspace's reach. */
export async function myTasks(actor: Actor) {
  return withActor(actor, (tx) =>
    tx
      .selectFrom("core.data_requests as r")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .leftJoin("core.facilities as f", "f.id", "r.facility_id")
      .select(["r.id", "r.metric_code", "r.status", "r.due_on", "r.critical", "r.returns", "r.period_label", "r.assignee_user_id", "r.reviewer_user_id", "p.id as project_id", "p.name as project_name", "f.name as facility_name"])
      .where((eb) => eb.or([eb.and([eb("r.assignee_user_id", "=", actor.userId), eb("r.status", "in", ["assigned", "sent", "revision_required"])]), eb.and([eb("r.reviewer_user_id", "=", actor.userId), eb("r.status", "in", ["submitted", "reviewing"])])]))
      .orderBy("r.due_on")
      .limit(500)
      .execute(),
  );
}

export async function myNotifications(actor: Actor, limit = 30) {
  return withActor(actor, (tx) => tx.selectFrom("core.notifications").selectAll().where("user_id", "=", actor.userId).orderBy("created_at", "desc").limit(limit).execute());
}

export async function markNotificationsRead(actor: Actor, ids: number[]): Promise<void> {
  if (!ids.length) return;
  await withActor(actor, (tx) => tx.updateTable("core.notifications").set({ read_at: new Date() }).where("user_id", "=", actor.userId).where("id", "in", ids).where("read_at", "is", null).execute());
}

// ---------------------------------------------------------------- reminders (G3-08)

export type ReminderPolicy = { beforeDays: number[]; afterDays: number[]; criticalOnlyDays: number[] };

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/**
 * Daily scan: T−n reminders to the assignee (n in beforeDays; days listed in criticalOnlyDays only for critical
 * requests) and T+n late notices to the project leads, one summary per project and day. Idempotent: the outbox
 * dedupe key carries request (or project), kind and date, so a second run the same day adds nothing.
 */
export async function scanReminders(today: string): Promise<{ queued: number }> {
  return withSystem("reminder scan over active campaigns", async (tx) => {
    const rows = await tx
      .selectFrom("core.data_requests as r")
      .innerJoin("core.data_campaigns as c", "c.id", "r.campaign_id")
      .select(["r.id", "r.owner_tenant_id", "r.project_id", "r.metric_code", "r.due_on", "r.critical", "r.assignee_user_id", "r.status", "c.reminder_policy"])
      .where("c.status", "=", "active")
      .where("r.status", "in", ["sent", "revision_required"])
      .where("r.due_on", "is not", null)
      .execute();
    let queued = 0;
    const late = new Map<string, { owner: string; count: number }>();
    for (const r of rows) {
      const p = r.reminder_policy as unknown as ReminderPolicy;
      const due = r.due_on!;
      for (const n of p.beforeDays ?? []) {
        if (addDays(due, -n) !== today) continue;
        if ((p.criticalOnlyDays ?? []).includes(n) && !r.critical) continue;
        await enqueue(tx, "notify", { userId: r.assignee_user_id, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, kind: "task_due_soon", payload: { requestId: r.id, metric: r.metric_code, due, days: n }, mail: true }, { ownerTenantId: r.owner_tenant_id, dedupeKey: `rem:${r.id}:t-${n}:${due}` });
        queued++;
      }
      for (const n of p.afterDays ?? []) if (addDays(due, n) === today) late.set(r.project_id, { owner: r.owner_tenant_id, count: (late.get(r.project_id)?.count ?? 0) + 1 });
    }
    for (const [projectId, x] of late) {
      const leads = await tx.selectFrom("core.project_participants").select("user_id").where("project_id", "=", projectId).where("raci_role", "in", ["project_lead", "data_lead"]).where("revoked_at", "is", null).execute();
      for (const l of leads) {
        await enqueue(tx, "notify", { userId: l.user_id, ownerTenantId: x.owner, projectId, kind: "tasks_late", payload: { count: x.count, date: today }, mail: true }, { ownerTenantId: x.owner, dedupeKey: `late:${projectId}:${l.user_id}:${today}` });
        queued++;
      }
    }
    return { queued };
  });
}

export const REMINDER_KIND = "reminders.scan";

export async function unreadCount(userId: string): Promise<number> {
  return withActor({ userId, actingTenantId: null }, async (tx) => {
    const r = await tx.selectFrom("core.notifications").select(sql<number>`count(*)`.as("n")).where("user_id", "=", userId).where("read_at", "is", null).executeTakeFirstOrThrow();
    return Number(r.n);
  });
}

/** Campaign reminder rule (T−n days before, T+n after; some days only for critical requests) and open/closed state. */
export async function updateCampaign(actor: Actor, campaignId: string, input: { reminderPolicy?: ReminderPolicy; status?: "active" | "closed" }): Promise<void> {
  const ok = (xs: number[]) => xs.every((n) => Number.isInteger(n) && n >= 1 && n <= 60) && xs.length <= 5;
  if (input.reminderPolicy && !(ok(input.reminderPolicy.beforeDays) && ok(input.reminderPolicy.afterDays) && input.reminderPolicy.criticalOnlyDays.every((d) => input.reminderPolicy!.beforeDays.includes(d)))) throw new HttpError(422, "invalid_reminder_policy");
  await withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.data_campaigns").selectAll().where("id", "=", campaignId).forUpdate().executeTakeFirst();
    if (!c) throw notFound("campaign_not_found");
    await requireProjectAction(tx, actor, c.project_id, "data.request");
    await tx
      .updateTable("core.data_campaigns")
      .set({ ...(input.reminderPolicy ? { reminder_policy: JSON.stringify(input.reminderPolicy) } : {}), ...(input.status ? { status: input.status } : {}) })
      .where("id", "=", campaignId)
      .execute();
    await audit(tx, actor, { action: "campaign.update", objectType: "data_campaign", objectId: campaignId, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, before: { policy: c.reminder_policy, status: c.status }, after: input });
  });
}
