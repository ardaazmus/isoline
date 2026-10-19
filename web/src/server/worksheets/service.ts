/**
 * Cycle worksheets (migration 0012): save a version, submit it, and a second person approves or returns it. The
 * taxonomy run turns the approved taxonomy sheet into metric facts; the analysis area reads approved figures only.
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { audit, canonicalJson } from "../audit/audit";
import { withActor, type Actor, type Tx } from "../db/client";
import { forbidden, HttpError, notFound, type Action } from "../policy/policy";
import { projectsAllowing, reachableProjectIds, requireProjectAction } from "../tenancy/service";
import { issueCounts, recordIssues, supersedeOpenIssues, writeFacts, type RunRef } from "../calc/service";
import { ANALYSIS_KINDS, SHEETS, type Payload, type WorksheetKind } from "./schemas";
import { ANNUAL_REPORT_TEMPLATES, taxonomyFacts, taxonomyWarnings, type ApprovedFact } from "./compute";

export const TAXONOMY_ENGINE = "taxonomy-2026.10.19";
const sha = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");
const NO_FACTORS = createHash("sha256").update("[]").digest("hex");
const FROZEN = ["frozen", "released"];

/** Who may write and who may approve each kind. Customer governance (materiality, annual report) stays with members. */
const EDIT: Record<WorksheetKind, Action> = { materiality: "scope.decide", taxonomy: "data.submit", annual_report: "report.write", pathway: "calc.run", ets: "calc.run", cbam_cost: "calc.run" };
const APPROVE: Record<WorksheetKind, Action> = { materiality: "scope.decide", taxonomy: "data.review", annual_report: "report.review", pathway: "quality.review", ets: "quality.review", cbam_cost: "quality.review" };
const MEMBER_APPROVES: WorksheetKind[] = ["materiality", "annual_report"];

type Row = { id: string; kind: string; report_id: string | null; version: number; payload: unknown; status: string; note: string | null; entered_by: string; approved_by: string | null; approved_at: Date | null; created_at: Date; cycle_id: string; project_id: string; owner_tenant_id: string };

async function cycleScope(tx: Tx, actor: Actor, cycleId: string, action: Action) {
  const c = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "owner_tenant_id", "status", "reporting_year", "label"]).where("id", "=", cycleId).executeTakeFirst();
  if (!c) throw notFound("cycle_not_found");
  const access = await requireProjectAction(tx, actor, c.project_id, action);
  return { cycle: c, access };
}

async function reportOf(tx: Tx, cycleId: string, reportId: string | null | undefined, kind: WorksheetKind) {
  if (kind !== "annual_report") {
    if (reportId) throw new HttpError(422, "report_not_expected");
    return null;
  }
  if (!reportId) throw new HttpError(422, "report_required");
  const r = await tx.selectFrom("core.reports").select(["id", "template_id", "cycle_id"]).where("id", "=", reportId).executeTakeFirst();
  if (!r || r.cycle_id !== cycleId) throw notFound("report_not_found");
  if (!ANNUAL_REPORT_TEMPLATES[r.template_id]) throw new HttpError(422, "not_annual_report");
  return r;
}

const scoped = (tx: Tx, cycleId: string, kind: WorksheetKind, reportId: string | null) =>
  tx
    .selectFrom("core.cycle_worksheets as w")
    .leftJoin("user as e", "e.id", "w.entered_by")
    .leftJoin("user as a", "a.id", "w.approved_by")
    .select(["w.id", "w.kind", "w.report_id", "w.version", "w.payload", "w.status", "w.note", "w.entered_by", "w.approved_by", "w.approved_at", "w.created_at", "w.cycle_id", "w.project_id", "w.owner_tenant_id", "e.name as entered_by_name", "a.name as approved_by_name"])
    .where("w.cycle_id", "=", cycleId)
    .where("w.kind", "=", kind)
    .where((eb) => (reportId ? eb("w.report_id", "=", reportId) : eb("w.report_id", "is", null)));

/** The newest version still in play (draft, submitted or approved) and the approved one. */
export async function getWorksheet(actor: Actor, cycleId: string, kind: WorksheetKind, reportId?: string | null) {
  return withActor(actor, async (tx) => {
    const { cycle, access } = await cycleScope(tx, actor, cycleId, "project.read");
    await reportOf(tx, cycleId, reportId, kind);
    const rows = await scoped(tx, cycleId, kind, reportId ?? null).orderBy("w.version", "desc").execute();
    const current = rows.find((r) => r.status !== "superseded") ?? null;
    const approved = rows.find((r) => r.status === "approved") ?? null;
    return { cycle: { id: cycle.id, label: cycle.label, status: cycle.status, reportingYear: cycle.reporting_year }, access: { via: access.via }, current, approved, versions: rows.length };
  });
}

/** A new version: drafts and submissions before it are superseded; an approved version stays until a newer one is approved. */
export async function saveWorksheet(actor: Actor, cycleId: string, kind: WorksheetKind, raw: unknown, opts: { reportId?: string | null; note?: string | null } = {}): Promise<{ id: string; version: number }> {
  const parsed = SHEETS[kind].safeParse(raw);
  if (!parsed.success) throw new HttpError(422, "invalid_worksheet", `invalid_worksheet: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  const payload = parsed.data as Payload;
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleScope(tx, actor, cycleId, EDIT[kind]);
    if (FROZEN.includes(cycle.status) && !ANALYSIS_KINDS.includes(kind)) throw new HttpError(409, "cycle_frozen");
    const report = await reportOf(tx, cycleId, opts.reportId, kind);
    await tx.selectFrom("core.reporting_cycles").select("id").where("id", "=", cycleId).forUpdate().execute();
    const last = await scoped(tx, cycleId, kind, report?.id ?? null).orderBy("w.version", "desc").executeTakeFirst();
    await tx
      .updateTable("core.cycle_worksheets")
      .set({ status: "superseded" })
      .where("cycle_id", "=", cycleId)
      .where("kind", "=", kind)
      .where((eb) => (report ? eb("report_id", "=", report.id) : eb("report_id", "is", null)))
      .where("status", "in", ["draft", "submitted"])
      .execute();
    const version = (last?.version ?? 0) + 1;
    const r = await tx
      .insertInto("core.cycle_worksheets")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, kind, report_id: report?.id ?? null, version, payload: JSON.stringify(payload), payload_sha256: sha(payload), note: opts.note?.trim() || null, entered_by: actor.userId, status: "draft" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "worksheet.save", objectType: "cycle_worksheet", objectId: r.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { kind, version, report: report?.id ?? null } });
    return { id: r.id, version };
  });
}

async function worksheetFor(tx: Tx, actor: Actor, id: string, action: (k: WorksheetKind) => Action) {
  const w = (await tx.selectFrom("core.cycle_worksheets").selectAll().where("id", "=", id).executeTakeFirst()) as Row | undefined;
  if (!w) throw notFound("worksheet_not_found");
  const kind = w.kind as WorksheetKind;
  const { cycle, access } = await cycleScope(tx, actor, w.cycle_id, action(kind));
  await tx.selectFrom("core.cycle_worksheets").select("id").where("id", "=", id).forUpdate().execute();
  return { w, kind, cycle, access };
}

export async function submitWorksheet(actor: Actor, id: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const { w, kind, cycle } = await worksheetFor(tx, actor, id, (k) => EDIT[k]);
    if (w.status !== "draft") throw new HttpError(409, "invalid_transition");
    if (FROZEN.includes(cycle.status) && !ANALYSIS_KINDS.includes(kind)) throw new HttpError(409, "cycle_frozen");
    await tx.updateTable("core.cycle_worksheets").set({ status: "submitted" }).where("id", "=", id).execute();
    await audit(tx, actor, { action: "worksheet.submit", objectType: "cycle_worksheet", objectId: id, ownerTenantId: w.owner_tenant_id, projectId: w.project_id, after: { kind, version: w.version } });
  });
}

/** Approves a submitted version — never the author's own; the previous approved version is superseded. */
export async function approveWorksheet(actor: Actor, id: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const { w, kind, cycle, access } = await worksheetFor(tx, actor, id, (k) => APPROVE[k]);
    if (w.status !== "submitted") throw new HttpError(409, "invalid_transition");
    if (w.entered_by === actor.userId) throw forbidden("own_work");
    if (MEMBER_APPROVES.includes(kind) && access.via !== "member") throw forbidden("owner_decision");
    if (FROZEN.includes(cycle.status) && !ANALYSIS_KINDS.includes(kind)) throw new HttpError(409, "cycle_frozen");
    await tx
      .updateTable("core.cycle_worksheets")
      .set({ status: "superseded" })
      .where("cycle_id", "=", w.cycle_id)
      .where("kind", "=", kind)
      .where((eb) => (w.report_id ? eb("report_id", "=", w.report_id) : eb("report_id", "is", null)))
      .where("status", "=", "approved")
      .execute();
    await tx.updateTable("core.cycle_worksheets").set({ status: "approved", approved_by: actor.userId, approved_at: new Date() }).where("id", "=", id).execute();
    await audit(tx, actor, { action: "worksheet.approve", objectType: "cycle_worksheet", objectId: id, ownerTenantId: w.owner_tenant_id, projectId: w.project_id, after: { kind, version: w.version } });
  });
}

/** Sends a submitted version back to draft with a reason (the reason is in the audit trail). */
export async function returnWorksheet(actor: Actor, id: string, reason: string): Promise<void> {
  if (reason.trim().length < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const { w, kind } = await worksheetFor(tx, actor, id, (k) => APPROVE[k]);
    if (w.status !== "submitted") throw new HttpError(409, "invalid_transition");
    if (w.entered_by === actor.userId) throw forbidden("own_work");
    await tx.updateTable("core.cycle_worksheets").set({ status: "draft" }).where("id", "=", id).execute();
    await audit(tx, actor, { action: "worksheet.return", objectType: "cycle_worksheet", objectId: id, ownerTenantId: w.owner_tenant_id, projectId: w.project_id, after: { kind, version: w.version }, payload: { reason: reason.trim() } });
  });
}

/** Submitted worksheets this person may approve (the inbox). */
export async function worksheetsToApprove(actor: Actor) {
  return withActor(actor, async (tx) => {
    const reachable = await reachableProjectIds(tx, actor);
    if (!reachable.length) return [];
    const rows = await tx
      .selectFrom("core.cycle_worksheets as w")
      .innerJoin("core.projects as p", "p.id", "w.project_id")
      .leftJoin("user as e", "e.id", "w.entered_by")
      .select(["w.id", "w.kind", "w.version", "w.cycle_id", "w.report_id", "p.id as project_id", "p.name as project_name", "p.owner_tenant_id", "e.name as entered_by_name"])
      .where("w.status", "=", "submitted")
      .where("w.entered_by", "!=", actor.userId)
      .where("w.project_id", "in", reachable)
      .execute();
    const allowed = await projectsAllowing(tx, actor, rows.map((r) => r.project_id), [...new Set(Object.values(APPROVE))]);
    return rows.filter((r) => {
      const kind = r.kind as WorksheetKind;
      return allowed[APPROVE[kind]].has(r.project_id) && (!MEMBER_APPROVES.includes(kind) || r.owner_tenant_id === actor.actingTenantId);
    });
  });
}

/** Current approved (or locked) facts of a cycle: newest revision per key. */
export async function approvedFacts(tx: Tx, cycleId: string): Promise<ApprovedFact[]> {
  const rows = await tx
    .selectFrom("core.metric_fact_versions")
    .select(["metric_key", "facility_id", "boundary_kind", "value_num", "status"])
    .where("cycle_id", "=", cycleId)
    .where("status", "not in", ["superseded", "rejected"])
    .orderBy("revision", "desc")
    .execute();
  const seen = new Set<string>();
  const out: ApprovedFact[] = [];
  for (const f of rows) {
    const k = `${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (f.status === "approved" || f.status === "locked") out.push({ metricKey: f.metric_key, facilityId: f.facility_id, boundaryKind: f.boundary_kind, value: f.value_num === null ? null : Number(f.value_num) });
  }
  return out;
}

/**
 * Taxonomy run (step 3): the approved taxonomy sheet's KPIs become metric facts that wait for approval like any
 * other calculated metric. The same approved version twice is the same run.
 */
export async function runTaxonomy(actor: Actor, cycleId: string): Promise<{ runId: string; reused: boolean; blockers: number; warnings: number; facts: number }> {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleScope(tx, actor, cycleId, "calc.run");
    if (FROZEN.includes(cycle.status)) throw new HttpError(409, "cycle_frozen");
    const sheet = await scoped(tx, cycleId, "taxonomy", null).where("w.status", "=", "approved").orderBy("w.version", "desc").executeTakeFirst();
    if (!sheet) throw new HttpError(422, "worksheet_not_approved");
    const payload = SHEETS.taxonomy.parse(sheet.payload);
    const input = { worksheet: sheet.id, version: sheet.version, sha: sha(payload) };
    const iDigest = sha(input);
    const existing = await tx
      .selectFrom("core.calculation_runs")
      .select("id")
      .where("project_id", "=", cycle.project_id)
      .where("cycle_id", "=", cycleId)
      .where("kind", "=", "taxonomy")
      .where("input_digest", "=", iDigest)
      .where("engine_version", "=", TAXONOMY_ENGINE)
      .executeTakeFirst();
    const facts = taxonomyFacts(payload);
    if (existing) return { runId: existing.id, reused: true, ...(await issueCounts(tx, existing.id)), facts: facts.length };
    const warnings = taxonomyWarnings(payload);
    const run = await tx
      .insertInto("core.calculation_runs")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, boundary_id: null, kind: "taxonomy", mode: "final", engine_version: TAXONOMY_ENGINE, rule_version: TAXONOMY_ENGINE, factor_digest: NO_FACTORS, input_digest: iDigest, output_digest: sha(facts), inputs: JSON.stringify(input), factors: JSON.stringify({ factors: {}, warnings: [] }), result: JSON.stringify({ facts, warnings }), performed_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    const ref: RunRef = { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycleId, boundaryKind: null };
    await supersedeOpenIssues(tx, cycleId, "taxonomy");
    const counts = await recordIssues(tx, actor, ref, warnings);
    await writeFacts(tx, ref, facts, counts.blockers > 0);
    await audit(tx, actor, { action: "taxonomy.run", objectType: "calculation_run", objectId: run.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { worksheet: sheet.id, version: sheet.version, facts: facts.length, ...counts } });
    return { runId: run.id, reused: false, ...counts, facts: facts.length };
  });
}

/** What the analysis area needs: the cycle's approved figures, the base-year cycle's, and the saved scenarios. */
export async function analysisInputs(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const { cycle } = await cycleScope(tx, actor, cycleId, "project.read");
    const facts = await approvedFacts(tx, cycleId);
    const sheets: Partial<Record<WorksheetKind, { id: string; version: number; payload: unknown; status: string } | null>> = {};
    for (const kind of ANALYSIS_KINDS) {
      const r = await scoped(tx, cycleId, kind, null).where("w.status", "!=", "superseded").orderBy("w.version", "desc").executeTakeFirst();
      sheets[kind] = r ? { id: r.id, version: r.version, payload: r.payload, status: r.status } : null;
    }
    const pathway = sheets.pathway ? SHEETS.pathway.safeParse(sheets.pathway.payload) : null;
    const baseYear = pathway?.success ? pathway.data.baseYear : null;
    const base = baseYear
      ? await tx.selectFrom("core.reporting_cycles").select("id").where("project_id", "=", cycle.project_id).where("reporting_year", "=", baseYear).where(sql<boolean>`id <> ${cycleId}`).executeTakeFirst()
      : undefined;
    return { cycle: { id: cycle.id, label: cycle.label, status: cycle.status, reportingYear: cycle.reporting_year, projectId: cycle.project_id }, facts, baseFacts: base ? await approvedFacts(tx, base.id) : baseYear === cycle.reporting_year ? facts : null, sheets };
  });
}

/** The approved annual-report checklist of a report (the release needs it). */
export async function approvedChecklist(tx: Tx, reportId: string) {
  const r = await tx.selectFrom("core.cycle_worksheets").select(["payload", "version"]).where("report_id", "=", reportId).where("kind", "=", "annual_report").where("status", "=", "approved").orderBy("version", "desc").executeTakeFirst();
  return r ? SHEETS.annual_report.parse(r.payload) : null;
}
