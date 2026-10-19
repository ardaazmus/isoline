/**
 * Report studio and release (G6; plan 10).
 *
 *   report (template outline, one cycle) → sections → versioned text with metric references → section review
 *   (never by the author) → technical review → customer review → management sign-off (each on the digest of the
 *   exact candidate) → release: frozen cycle snapshot, no stale or unresolved reference, no blocking green claim →
 *   immutable assets (DOCX, XLSX, CSV, SVG, index, notes, manifest, hand-off ZIP) with SHA-256 → amendment = a new
 *   release pointing to the old one, which never changes. A design partner sees releases only (database rule).
 */
import { createHash, randomUUID } from "node:crypto";
import { sql } from "kysely";
import { TEMPLATES } from "@/data/templates";
import { translate } from "@/i18n/core";
import { screenClaims, type ClaimHit } from "@/lib/claims";
import { xlsxWorkbook } from "@/lib/spreadsheet";
import { audit, canonicalJson } from "../audit/audit";
import { withActor, type Actor, type Tx } from "../db/client";
import { detect } from "../evidence/filetype";
import { scan } from "../evidence/scanner";
import { getObjectBytes, presignDownload, putObject } from "../evidence/storage";
import { forbidden, HttpError, memberCan, notFound, type Action, type MemberRole } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { parse, prose, tokens } from "./body";
import { releaseDocx } from "./docx";
import { barChartSvg, csv, withUnit, type FactValue } from "./render";
import { zip } from "./zip";
import { ANNUAL_REPORT_TEMPLATES, annualReportStatus } from "../worksheets/compute";
import { approvedChecklist } from "../worksheets/service";

const sha = (v: unknown) => createHash("sha256").update(typeof v === "string" || v instanceof Uint8Array ? v : canonicalJson(v)).digest("hex");
export const STAGES = ["tech_review", "customer_review", "management_signoff"] as const;
type Stage = (typeof STAGES)[number];
const NEXT: Record<Stage, string> = { tech_review: "customer_review", customer_review: "management_signoff", management_signoff: "management_signoff" };
const BOUNDARY_PREF = [null, "ghg_operational_control", "financial_reporting", "ghg_financial_control", "ghg_equity_share", "cbam_facility_product"];
const GHG_ROWS = ["ghg.scope1", "ghg.scope2.location", "ghg.scope2.market", "ghg.scope3", "ghg.total.location"];

type FactRow = { id: string; metric_key: string; facility_id: string | null; boundary_kind: string | null; revision: number; value_num: string | null; value_text: string | null; unit: string; status: string; suppressed: boolean };

async function reportScope(tx: Tx, actor: Actor, reportId: string, action: Action) {
  const r = await tx.selectFrom("core.reports").selectAll().where("id", "=", reportId).executeTakeFirst();
  if (!r) throw notFound("report_not_found");
  const access = await requireProjectAction(tx, actor, r.project_id, action);
  return { report: r, access };
}

/** Newest non-superseded, non-rejected revision per key in the cycle. */
async function currentFacts(tx: Tx, cycleId: string): Promise<FactRow[]> {
  const rows = (await tx
    .selectFrom("core.metric_fact_versions")
    .select(["id", "metric_key", "facility_id", "boundary_kind", "revision", "value_num", "value_text", "unit", "status", "suppressed"])
    .where("cycle_id", "=", cycleId)
    .where("status", "not in", ["superseded", "rejected"])
    .orderBy("revision", "desc")
    .execute()) as FactRow[];
  const seen = new Set<string>();
  return rows.filter((f) => {
    const k = `${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function pick(facts: FactRow[], key: string, boundary: string | null): FactRow | undefined {
  const group = facts.filter((f) => f.metric_key === key && f.facility_id === null);
  if (boundary) return group.find((f) => f.boundary_kind === boundary);
  for (const b of BOUNDARY_PREF) {
    const f = group.find((x) => x.boundary_kind === b);
    if (f) return f;
  }
  return group[0];
}

const fv = (f: FactRow): FactValue => ({ metricKey: f.metric_key, value: f.value_num, text: f.value_text, unit: f.unit, suppressed: f.suppressed });

function metricName(lang: string, key: string): string {
  const cat = /^ghg\.scope3\.cat(\d+)$/.exec(key);
  if (cat) return translate(lang, "pf.calc.m.scope3_cat", { n: cat[1] });
  return translate(lang, `pf.calc.m.${key.replace(/\./g, "_")}`);
}

// ---------------------------------------------------------------- reports and outline (G6-01)

export async function createReport(actor: Actor, cycleId: string, input: { templateId: string; title?: string | null; language?: "tr" | "en" }): Promise<{ reportId: string; sections: number }> {
  const tpl = TEMPLATES.find((t) => t.id === input.templateId);
  if (!tpl) throw new HttpError(422, "unknown_template");
  const lang = input.language ?? "tr";
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "owner_tenant_id", "label"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, c.project_id, "report.write");
    const title = input.title?.trim() || `${translate(lang, `tpl.${tpl.id}.title`)} ${c.label}`;
    const r = await tx.insertInto("core.reports").values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, cycle_id: cycleId, template_id: tpl.id, kind: tpl.kind, title, language: lang, created_by: actor.userId }).returning("id").executeTakeFirstOrThrow();
    let i = 0;
    for (const s of tpl.sections) await tx.insertInto("core.report_sections").values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, report_id: r.id, section_key: s.id, position: i++, refs: s.refs, tools: s.tools ?? [] }).execute();
    await audit(tx, actor, { action: "report.create", objectType: "report", objectId: r.id, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, after: { template: tpl.id, title, language: lang } });
    return { reportId: r.id, sections: tpl.sections.length };
  });
}

export async function listReports(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    return tx
      .selectFrom("core.reports as r")
      .innerJoin("core.reporting_cycles as c", "c.id", "r.cycle_id")
      .select([
        "r.id",
        "r.title",
        "r.template_id",
        "r.language",
        "r.status",
        "r.cycle_id",
        "c.label as cycle_label",
        "r.updated_at",
        sql<number>`(select count(*)::int from core.report_sections s where s.report_id = r.id)`.as("sections"),
        sql<number>`(select count(*)::int from core.report_sections s where s.report_id = r.id and s.status = 'approved')`.as("approved"),
        sql<number>`(select coalesce(max(version), 0)::int from core.report_releases x where x.report_id = r.id)`.as("releases"),
      ])
      .where("r.project_id", "=", projectId)
      .orderBy("r.created_at")
      .execute();
  });
}

// ---------------------------------------------------------------- sections (G6-02)

async function sectionScope(tx: Tx, actor: Actor, sectionId: string, action: Action) {
  const s = await tx.selectFrom("core.report_sections").selectAll().where("id", "=", sectionId).forUpdate().executeTakeFirst();
  if (!s) throw notFound("section_not_found");
  const { report, access } = await reportScope(tx, actor, s.report_id, action);
  return { section: s, report, access };
}

/** Binds every token of a body to the current fact of the report's cycle. */
async function bind(tx: Tx, report: { cycle_id: string; language: string }, body: string) {
  const facts = await currentFacts(tx, report.cycle_id);
  return tokens(body).map((t) => {
    const f = pick(facts, t.key, t.boundary);
    return { token: t.raw, fact: f ?? null, rendered: f ? withUnit(report.language, fv(f)) : null };
  });
}

/** A new version of a section's text (optimistic: the base version must still be the current one). */
export async function saveSection(actor: Actor, sectionId: string, input: { body: string; baseVersion?: number | null }): Promise<{ versionId: string; version: number; unresolved: string[] }> {
  if (input.body.length > 100_000) throw new HttpError(422, "body_too_long");
  return withActor(actor, async (tx) => {
    const { report } = await sectionScope(tx, actor, sectionId, "report.write");
    const last = await tx.selectFrom("core.report_section_versions").select(["id", "version", "status"]).where("section_id", "=", sectionId).orderBy("version", "desc").executeTakeFirst();
    if (input.baseVersion !== undefined && input.baseVersion !== null && (last?.version ?? 0) !== input.baseVersion) throw new HttpError(409, "version_conflict");
    const refs = await bind(tx, report, input.body);
    await tx.updateTable("core.report_section_versions").set({ status: "superseded" }).where("section_id", "=", sectionId).where("status", "in", ["draft", "submitted"]).execute();
    const v = await tx
      .insertInto("core.report_section_versions")
      .values({ owner_tenant_id: report.owner_tenant_id, project_id: report.project_id, section_id: sectionId, version: (last?.version ?? 0) + 1, body: input.body, author_id: actor.userId, author_tenant_id: actor.actingTenantId })
      .returning(["id", "version"])
      .executeTakeFirstOrThrow();
    if (refs.length) await tx.insertInto("core.metric_references").values(refs.map((r) => ({ owner_tenant_id: report.owner_tenant_id, project_id: report.project_id, section_version_id: v.id, token: r.token, fact_id: r.fact?.id ?? null, rendered: r.rendered, unit: r.fact?.unit ?? null }))).execute();
    await tx.updateTable("core.report_sections").set({ status: "draft", current_version_id: v.id }).where("id", "=", sectionId).execute();
    // a released report that is edited again goes back to drafting (an amendment follows the whole chain)
    if (report.status !== "drafting") await tx.updateTable("core.reports").set({ status: "drafting" }).where("id", "=", report.id).execute();
    await audit(tx, actor, { action: "report.section_save", objectType: "report_section", objectId: sectionId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id, after: { version: v.version, chars: input.body.length, tokens: refs.length } });
    return { versionId: v.id, version: v.version, unresolved: refs.filter((r) => !r.fact).map((r) => r.token) };
  });
}

export async function submitSection(actor: Actor, sectionId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const { section, report } = await sectionScope(tx, actor, sectionId, "report.write");
    if (!section.current_version_id || section.status !== "draft") throw new HttpError(409, "invalid_transition");
    const unresolved = await tx.selectFrom("core.metric_references").select("token").where("section_version_id", "=", section.current_version_id).where("fact_id", "is", null).execute();
    if (unresolved.length) throw new HttpError(422, "unresolved_tokens", `unresolved_tokens: ${unresolved.map((u) => u.token).join(", ")}`);
    await tx.updateTable("core.report_section_versions").set({ status: "submitted" }).where("id", "=", section.current_version_id).execute();
    await tx.updateTable("core.report_sections").set({ status: "submitted" }).where("id", "=", sectionId).execute();
    await audit(tx, actor, { action: "report.section_submit", objectType: "report_section", objectId: sectionId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id });
  });
}

/** Approves or returns a submitted version; never the author (DB CHECK as well). */
export async function reviewSection(actor: Actor, sectionId: string, input: { decision: "approve" | "reject"; note?: string | null }): Promise<void> {
  await withActor(actor, async (tx) => {
    const { section, report } = await sectionScope(tx, actor, sectionId, "report.review");
    if (section.status !== "submitted" || !section.current_version_id) throw new HttpError(409, "invalid_transition");
    const v = await tx.selectFrom("core.report_section_versions").select(["id", "author_id"]).where("id", "=", section.current_version_id).executeTakeFirstOrThrow();
    if (v.author_id === actor.userId) throw forbidden("own_work");
    if (input.decision === "reject" && (input.note?.trim().length ?? 0) < 10) throw new HttpError(422, "reason_required");
    await tx.updateTable("core.report_section_versions").set({ status: input.decision === "approve" ? "approved" : "rejected", reviewed_by: actor.userId, reviewed_at: new Date(), review_note: input.note?.trim() || null }).where("id", "=", v.id).execute();
    await tx.updateTable("core.report_sections").set({ status: input.decision === "approve" ? "approved" : "draft" }).where("id", "=", sectionId).execute();
    await audit(tx, actor, { action: `report.section_${input.decision}`, objectType: "report_section", objectId: sectionId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id, after: { version: v.id, note: input.note ?? null } });
  });
}

export async function assignSection(actor: Actor, sectionId: string, input: { ownerUserId?: string | null; dueOn?: string | null }): Promise<void> {
  await withActor(actor, async (tx) => {
    const { report } = await sectionScope(tx, actor, sectionId, "report.write");
    await tx.updateTable("core.report_sections").set({ ...(input.ownerUserId !== undefined ? { owner_user_id: input.ownerUserId } : {}), ...(input.dueOn !== undefined ? { due_on: input.dueOn } : {}) }).where("id", "=", sectionId).execute();
    await audit(tx, actor, { action: "report.section_assign", objectType: "report_section", objectId: sectionId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id, after: input });
  });
}

// ---------------------------------------------------------------- state: candidate, coverage, stale references (G6-03)

type SectionState = { id: string; key: string; title: string; refs: string[]; status: string; versionId: string | null; version: number | null; body: string; authorId: string | null; authorName: string | null; reviewerName: string | null; ownerName: string | null; dueOn: string | null; references: { token: string; factId: string | null; rendered: string | null; stale: boolean }[] };

async function reportState(tx: Tx, report: { id: string; cycle_id: string; template_id: string; language: string }) {
  const sections = await tx
    .selectFrom("core.report_sections as s")
    .leftJoin("core.report_section_versions as v", "v.id", "s.current_version_id")
    .leftJoin("user as a", "a.id", "v.author_id")
    .leftJoin("user as r", "r.id", "v.reviewed_by")
    .leftJoin("user as o", "o.id", "s.owner_user_id")
    .select(["s.id", "s.section_key", "s.refs", "s.status", "s.due_on", "v.id as version_id", "v.version", "v.body", "v.author_id", "a.name as author_name", "r.name as reviewer_name", "o.name as owner_name"])
    .where("s.report_id", "=", report.id)
    .orderBy("s.position")
    .execute();
  const versionIds = sections.map((s) => s.version_id).filter(Boolean) as string[];
  const refs = versionIds.length ? await tx.selectFrom("core.metric_references").select(["section_version_id", "token", "fact_id", "rendered"]).where("section_version_id", "in", versionIds).execute() : [];
  const facts = await currentFacts(tx, report.cycle_id);
  const all = refs.map((r) => r.fact_id).filter(Boolean) as string[];
  const bound = all.length ? await tx.selectFrom("core.metric_fact_versions").select(["id", "metric_key", "facility_id", "boundary_kind", "status"]).where("id", "in", all).execute() : [];
  // a reference is stale when its fact is no longer the current one for its key (a newer revision exists)
  const stale = (factId: string | null) => {
    if (!factId) return false;
    const f = bound.find((b) => b.id === factId);
    if (!f) return true;
    const cur = facts.find((x) => x.metric_key === f.metric_key && x.facility_id === f.facility_id && x.boundary_kind === f.boundary_kind);
    return !cur || cur.id !== f.id;
  };
  const out: SectionState[] = sections.map((s) => ({
    id: s.id,
    key: s.section_key,
    title: translate(report.language, `tpl.${report.template_id}.sections.${s.section_key}.title`),
    refs: s.refs,
    status: s.status,
    versionId: s.version_id,
    version: s.version,
    body: s.body ?? "",
    authorId: s.author_id,
    authorName: s.author_name,
    reviewerName: s.reviewer_name,
    ownerName: s.owner_name,
    dueOn: s.due_on,
    references: refs.filter((r) => r.section_version_id === s.version_id).map((r) => ({ token: r.token, factId: r.fact_id, rendered: r.rendered, stale: stale(r.fact_id) })),
  }));
  const candidate = sha({ report: report.id, sections: out.map((s) => ({ k: s.key, v: s.versionId, b: sha(s.body), r: s.references.map((x) => [x.token, x.factId, x.rendered]).sort() })) });
  const claims: { section: string; hits: ClaimHit[] }[] = out.map((s) => ({ section: s.key, hits: screenClaims(prose(s.body), report.language) })).filter((c) => c.hits.length);
  const coverage = { met: out.filter((s) => s.status === "approved").length, partial: out.filter((s) => s.status === "draft" || s.status === "submitted").length, pending: out.filter((s) => s.status === "empty").length, total: out.length };
  return { sections: out, candidate, claims, coverage, facts };
}

export async function getReport(actor: Actor, reportId: string) {
  return withActor(actor, async (tx) => {
    const { report, access } = await reportScope(tx, actor, reportId, "project.read");
    const st = await reportState(tx, report);
    const approvals = await tx.selectFrom("core.report_approvals as a").leftJoin("user as u", "u.id", "a.user_id").select(["a.id", "a.stage", "a.decision", "a.candidate_sha256", "a.comment", "a.decided_at", "u.name as user_name"]).where("a.report_id", "=", reportId).orderBy("a.decided_at", "desc").execute();
    const releases = await tx.selectFrom("core.report_releases as r").leftJoin("user as u", "u.id", "r.released_by").select(["r.id", "r.version", "r.status", "r.manifest_sha256", "r.amendment_of", "r.amendment_reason", "r.released_at", "u.name as released_by_name"]).where("r.report_id", "=", reportId).orderBy("r.version", "desc").execute();
    const cycle = await tx.selectFrom("core.reporting_cycles").select(["id", "label", "status"]).where("id", "=", report.cycle_id).executeTakeFirstOrThrow();
    const available = st.facts.filter((f) => f.facility_id === null).map((f) => ({ token: `{{${f.metric_key}${f.boundary_kind ? `|${f.boundary_kind}` : ""}}}`, key: f.metric_key, boundary: f.boundary_kind, value: withUnit(report.language, fv(f)), status: f.status }));
    return { report, cycle, access: { via: access.via }, ...st, facts: undefined, available, approvals, releases };
  });
}

// ---------------------------------------------------------------- review chain (G6-05)

/** Drafting → technical review: every section approved, no stale or unresolved reference. */
export async function requestReview(actor: Actor, reportId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const { report } = await reportScope(tx, actor, reportId, "report.write");
    if (report.status !== "drafting") throw new HttpError(409, "invalid_transition");
    const st = await reportState(tx, report);
    if (st.sections.some((s) => s.status !== "approved")) throw new HttpError(409, "sections_not_approved");
    if (st.sections.some((s) => s.references.some((r) => r.stale || !r.factId))) throw new HttpError(409, "stale_references");
    await tx.updateTable("core.reports").set({ status: "tech_review" }).where("id", "=", reportId).execute();
    await audit(tx, actor, { action: "report.request_review", objectType: "report", objectId: reportId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id, after: { candidate: st.candidate } });
  });
}

/**
 * A stage decision on the current candidate. Technical review: anyone with report.review (an advisor's reviewer
 * too). Customer review and management sign-off: a member of the owning company only — a grant never signs
 * (plan 10 §6), and the sign-off needs report.release.
 */
export async function decideStage(actor: Actor, reportId: string, input: { decision: "approved" | "changes_requested"; comment?: string | null }): Promise<{ status: string; candidate: string }> {
  return withActor(actor, async (tx) => {
    const r0 = await tx.selectFrom("core.reports").select(["status"]).where("id", "=", reportId).executeTakeFirst();
    if (!r0) throw notFound("report_not_found");
    const stage = r0.status as Stage;
    if (!STAGES.includes(stage)) throw new HttpError(409, "invalid_transition");
    const { report, access } = await reportScope(tx, actor, reportId, stage === "tech_review" ? "report.review" : stage === "customer_review" ? "report.review" : "report.release");
    if (stage !== "tech_review" && access.via !== "member") throw forbidden("owner_decision");
    if (input.decision === "changes_requested" && (input.comment?.trim().length ?? 0) < 10) throw new HttpError(422, "reason_required");
    const st = await reportState(tx, report);
    // the candidate the earlier stages approved must still be the one on the table
    const prior = await tx.selectFrom("core.report_approvals").select(["stage", "candidate_sha256"]).where("report_id", "=", reportId).where("decision", "=", "approved").orderBy("decided_at", "desc").execute();
    const earlier = STAGES.slice(0, STAGES.indexOf(stage));
    if (earlier.some((s) => prior.find((p) => p.stage === s)?.candidate_sha256 !== st.candidate)) throw new HttpError(409, "candidate_changed");
    await tx.insertInto("core.report_approvals").values({ owner_tenant_id: report.owner_tenant_id, project_id: report.project_id, report_id: reportId, stage, decision: input.decision, candidate_sha256: st.candidate, comment: input.comment?.trim() || null, user_id: actor.userId, acting_tenant_id: actor.actingTenantId }).execute();
    const status = input.decision === "approved" ? NEXT[stage] : "drafting";
    // after the sign-off the report waits for release in "management_signoff" with an approved sign-off on record
    await tx.updateTable("core.reports").set({ status }).where("id", "=", reportId).execute();
    if (input.decision === "changes_requested") await tx.updateTable("core.report_sections").set({ status: "draft" }).where("report_id", "=", reportId).where("status", "=", "approved").execute();
    await audit(tx, actor, { action: `report.${stage}_${input.decision}`, objectType: "report", objectId: reportId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id, after: { candidate: st.candidate, comment: input.comment ?? null } });
    return { status, candidate: st.candidate };
  });
}

// ---------------------------------------------------------------- release (G6-04, G6-06, G6-08)

type Asset = { path: string; mime: string; data: Uint8Array };
const enc = new TextEncoder();
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function releaseReport(actor: Actor, reportId: string, input: { amendmentReason?: string | null } = {}): Promise<{ releaseId: string; version: number; manifestSha256: string; assets: number }> {
  return withActor(actor, async (tx) => {
    const { report, access } = await reportScope(tx, actor, reportId, "report.release");
    if (access.via !== "member") throw forbidden("owner_decision");
    await tx.selectFrom("core.reports").select("id").where("id", "=", reportId).forUpdate().execute();
    const st = await reportState(tx, report);
    const signoff = await tx.selectFrom("core.report_approvals as a").leftJoin("user as u", "u.id", "a.user_id").select(["a.id", "a.candidate_sha256", "a.decided_at", "u.name"]).where("a.report_id", "=", reportId).where("a.stage", "=", "management_signoff").where("a.decision", "=", "approved").orderBy("a.decided_at", "desc").executeTakeFirst();
    if (report.status !== "management_signoff" || !signoff || signoff.candidate_sha256 !== st.candidate) throw new HttpError(409, "signoff_required");
    const cycle = await tx.selectFrom("core.reporting_cycles").select(["id", "label", "status", "reporting_year"]).where("id", "=", report.cycle_id).executeTakeFirstOrThrow();
    if (cycle.status !== "frozen" && cycle.status !== "released") throw new HttpError(409, "cycle_not_frozen");
    const snap = await tx.selectFrom("core.cycle_snapshots").select(["id", "version", "content_sha256"]).where("cycle_id", "=", cycle.id).where("status", "=", "frozen").executeTakeFirstOrThrow();
    const snapFacts = (await tx.selectFrom("core.snapshot_facts").select(["fact_id"]).where("snapshot_id", "=", snap.id).execute()).map((f) => f.fact_id);
    const refs = st.sections.flatMap((s) => s.references);
    if (refs.some((r) => !r.factId || r.stale || !snapFacts.includes(r.factId))) throw new HttpError(409, "stale_references");
    const blocking = st.claims.flatMap((c) => c.hits.filter((h) => h.rule === "offset" || h.rule === "future").map((h) => ({ section: c.section, ...h })));
    if (blocking.length) throw new HttpError(409, "claims_blocked", `claims_blocked: ${blocking.map((b) => b.text).join(", ")}`);
    // an annual report carries the minimum-content checklist (Yön. 28395): approved and with every item covered
    if (ANNUAL_REPORT_TEMPLATES[report.template_id]) {
      const checklist = await approvedChecklist(tx, reportId);
      if (!checklist || !annualReportStatus(checklist).complete) throw new HttpError(409, "ar_checklist_incomplete");
    }
    const previous = await tx.selectFrom("core.report_releases").select(["id", "version"]).where("report_id", "=", reportId).orderBy("version", "desc").executeTakeFirst();
    if (previous && (input.amendmentReason?.trim().length ?? 0) < 20) throw new HttpError(422, "amendment_reason_required");

    const lang = report.language;
    const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
    // facts of the release: referenced in the text plus the GHG table/chart rows — all from the frozen snapshot
    const facts = (await tx.selectFrom("core.metric_fact_versions").select(["id", "metric_key", "facility_id", "boundary_kind", "revision", "value_num", "value_text", "unit", "status", "suppressed"]).where("id", "in", snapFacts.length ? snapFacts : ["00000000-0000-0000-0000-000000000000"]).execute()) as FactRow[];
    const ghgRows = GHG_ROWS.map((k) => pick(facts, k, null)).filter(Boolean) as FactRow[];
    const used = [...new Map([...refs.map((r) => facts.find((f) => f.id === r.factId)!), ...ghgRows].map((f) => [f.id, f])).values()];
    const bound = new Map(refs.map((r) => [r.token, r.rendered ?? ""]));
    const ghgTable = ghgRows.map((f) => ({ label: metricName(lang, f.metric_key), value: withUnit(lang, fv(f)) }));
    const assets: Asset[] = [];
    const approvals = await tx.selectFrom("core.report_approvals as a").leftJoin("user as u", "u.id", "a.user_id").select(["a.stage", "a.decision", "a.candidate_sha256", "a.decided_at", "u.name"]).where("a.report_id", "=", reportId).where("a.candidate_sha256", "=", st.candidate).where("a.decision", "=", "approved").orderBy("a.decided_at").execute();
    const docx = await releaseDocx({
      title: report.title,
      subtitle: `${cycle.label} · ${t("pf.rep.docx.release", { v: (previous?.version ?? 0) + 1 })}`,
      sections: st.sections.map((s) => ({ title: s.title, refs: s.refs, body: s.body })),
      bound,
      tables: { ghg: ghgTable },
      labels: { refs: t("pf.rep.docx.refs"), ghgTable: t("pf.rep.docx.ghgTable"), chart: t("pf.rep.docx.chart"), chartNote: t("pf.rep.docx.chartNote"), signoff: t("pf.rep.docx.signoff"), index: t("pf.rep.docx.index"), section: t("pf.rep.docx.section"), status: t("pf.rep.docx.status"), page: t("pf.rep.docx.page"), pageNote: t("pf.rep.docx.pageNote") },
      signoff: approvals.map((a) => ({ stage: t(`pf.rep.stage.${a.stage}`), name: a.name ?? "—", at: a.decided_at.toISOString().slice(0, 10) })),
      index: st.sections.map((s) => ({ section: s.title, refs: s.refs.join(" · "), status: t("pf.rep.coverage.met") })),
    });
    assets.push({ path: "content.docx", mime: DOCX, data: docx });
    const factHead = ["metric_key", t("pf.rep.col.metric"), t("pf.rep.col.boundary"), t("pf.rep.col.value"), t("pf.rep.col.formatted"), t("pf.rep.col.unit"), "fact_id", t("pf.rep.col.revision")];
    const factRows = used.map((f) => [f.metric_key, metricName(lang, f.metric_key), f.boundary_kind ?? "", f.suppressed ? "" : (f.value_num ?? f.value_text ?? ""), withUnit(lang, fv(f)), f.unit, f.id, String(f.revision)]);
    assets.push({ path: "tables/facts.csv", mime: "text/csv", data: enc.encode(csv(lang, factHead, factRows)) });
    assets.push({ path: "tables/facts.xlsx", mime: XLSX, data: new Uint8Array(await xlsxWorkbook([{ name: "facts", rows: [factHead, ...factRows], text: [0, 1, 2, 4, 5, 6] }])) });
    if (ghgRows.length) assets.push({ path: "charts/ghg_scopes.svg", mime: "image/svg+xml", data: enc.encode(barChartSvg(lang, t("pf.rep.docx.chart"), ghgRows.map((f) => ({ label: metricName(lang, f.metric_key), fact: fv(f) })))) });
    assets.push({ path: "disclosure-index-draft.csv", mime: "text/csv", data: enc.encode(csv(lang, [t("pf.rep.docx.section"), t("pf.rep.docx.refs"), t("pf.rep.docx.status"), t("pf.rep.docx.page")], st.sections.map((s) => [s.title, s.refs.join(" · "), t("pf.rep.coverage.met"), ""]))) });
    const warnings = st.claims.flatMap((c) => c.hits.map((h) => `- ${c.section}: ${h.rule} — "${h.text}"`));
    const notes = [`# ${report.title}`, "", `## ${t("pf.rep.docx.signoff")}`, ...approvals.map((a) => `- ${t(`pf.rep.stage.${a.stage}`)}: ${a.name} (${a.decided_at.toISOString()}) — ${a.candidate_sha256.slice(0, 16)}`), "", `## ${t("pf.rep.notes.claims")}`, ...(warnings.length ? warnings : ["- —"]), ...(previous ? ["", `## ${t("pf.rep.notes.amendment")}`, input.amendmentReason!.trim()] : [])].join("\n");
    assets.push({ path: "review-notes.md", mime: "text/markdown", data: enc.encode(notes + "\n") });

    const releaseId = randomUUID();
    const version = (previous?.version ?? 0) + 1;
    const manifest = {
      releaseId,
      reportId,
      report: report.title,
      template: report.template_id,
      language: lang,
      version,
      period: { cycle: cycle.id, label: cycle.label, year: cycle.reporting_year },
      snapshot: { id: snap.id, version: snap.version, sha256: snap.content_sha256 },
      candidate: st.candidate,
      sections: st.sections.map((s) => ({ key: s.key, versionId: s.versionId, version: s.version, sha256: sha(s.body) })),
      facts: used.map((f) => ({ id: f.id, key: f.metric_key, boundary: f.boundary_kind, revision: f.revision, value: f.suppressed ? null : (f.value_num ?? f.value_text), unit: f.unit })),
      approvals: approvals.map((a) => ({ stage: a.stage, by: a.name, at: a.decided_at.toISOString(), candidate: a.candidate_sha256 })),
      claims: st.claims.map((c) => ({ section: c.section, rules: c.hits.map((h) => h.rule) })),
      assets: assets.map((a) => ({ path: a.path, mime: a.mime, sha256: sha(a.data), bytes: a.data.length })),
      amendmentOf: previous?.id ?? null,
      amendmentReason: previous ? input.amendmentReason!.trim() : null,
    };
    const manifestJson = JSON.stringify(manifest, null, 2);
    assets.push({ path: "asset-manifest.json", mime: "application/json", data: enc.encode(manifestJson) });
    assets.push({ path: "handoff.zip", mime: "application/zip", data: zip(assets.map((a) => ({ path: a.path, data: a.data }))) });
    const manifestSha = sha(manifest);
    if (previous) await tx.updateTable("core.report_releases").set({ status: "superseded" }).where("report_id", "=", reportId).where("status", "=", "released").execute();
    await tx.insertInto("core.report_releases").values({ id: releaseId, owner_tenant_id: report.owner_tenant_id, project_id: report.project_id, report_id: reportId, version, manifest: manifestJson, manifest_sha256: manifestSha, snapshot_id: snap.id, amendment_of: previous?.id ?? null, amendment_reason: previous ? input.amendmentReason!.trim() : null, signoff_id: signoff.id, released_by: actor.userId }).execute();
    for (const a of assets) {
      const key = `releases/${report.owner_tenant_id}/${releaseId}/${a.path}`;
      const digest = sha(a.data);
      await putObject(key, a.data, a.mime, digest);
      await tx.insertInto("core.release_assets").values({ owner_tenant_id: report.owner_tenant_id, project_id: report.project_id, release_id: releaseId, path: a.path, mime: a.mime, sha256: digest, size_bytes: a.data.length, storage_key: key }).execute();
    }
    await tx.updateTable("core.reports").set({ status: "released" }).where("id", "=", reportId).execute();
    await audit(tx, actor, { action: previous ? "report.amend" : "report.release", objectType: "report_release", objectId: releaseId, ownerTenantId: report.owner_tenant_id, projectId: report.project_id, after: { version, manifest: manifestSha, snapshot: snap.id, assets: assets.length, amendmentOf: previous?.id ?? null } });
    return { releaseId, version, manifestSha256: manifestSha, assets: assets.length };
  });
}

/** Releases and their assets the person may see (a design partner: only these). */
export async function releaseAssets(actor: Actor, releaseId: string) {
  return withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.report_releases").select(["id", "report_id", "version", "status", "manifest", "manifest_sha256", "released_at", "amendment_of", "project_id"]).where("id", "=", releaseId).executeTakeFirst();
    if (!r) throw notFound();
    const assets = await tx.selectFrom("core.release_assets").select(["id", "path", "mime", "sha256", "size_bytes"]).where("release_id", "=", releaseId).orderBy("path").execute();
    const proofs = await tx.selectFrom("core.design_proofs as p").leftJoin("user as u", "u.id", "p.uploaded_by").select(["p.id", "p.version", "p.filename", "p.status", "p.decision_note", "p.uploaded_at", "u.name as uploaded_by_name"]).where("p.release_id", "=", releaseId).orderBy("p.version", "desc").execute();
    return { release: r, assets, proofs };
  });
}

export async function assetDownload(actor: Actor, assetId: string): Promise<{ url: string; filename: string }> {
  return withActor(actor, async (tx) => {
    const a = await tx.selectFrom("core.release_assets").select(["id", "path", "mime", "storage_key", "owner_tenant_id", "project_id", "release_id"]).where("id", "=", assetId).executeTakeFirst();
    if (!a) throw notFound();
    const filename = a.path.split("/").pop()!;
    await audit(tx, actor, { action: "release.asset_download", objectType: "release_asset", objectId: assetId, ownerTenantId: a.owner_tenant_id, projectId: a.project_id, after: { path: a.path, release: a.release_id } });
    return { url: await presignDownload(a.storage_key, filename, a.mime), filename };
  });
}

/** Release bytes from storage (tests and the integrity check compare them with the recorded SHA-256). */
export async function assetBytes(actor: Actor, assetId: string): Promise<{ path: string; data: Uint8Array; intact: boolean }> {
  return withActor(actor, async (tx) => {
    const a = await tx.selectFrom("core.release_assets").select(["path", "sha256", "storage_key"]).where("id", "=", assetId).executeTakeFirst();
    if (!a) throw notFound();
    const data = await getObjectBytes(a.storage_key);
    return { path: a.path, data, intact: sha(data) === a.sha256 };
  });
}

// ---------------------------------------------------------------- design partner (G6-07)

async function designAccess(tx: Tx, actor: Actor, projectId: string): Promise<void> {
  const g = await sql<{ role: string | null }>`select authz.grant_role(${projectId}::uuid) as role`.execute(tx);
  const role = g.rows[0]?.role;
  const m = await tx.selectFrom("core.memberships").select("role").where("tenant_id", "=", actor.actingTenantId!).where("user_id", "=", actor.userId).executeTakeFirst();
  if (role !== "design" || !m || !memberCan(m.role as MemberRole, "design.handoff")) throw notFound();
}

/** Every release shared with the person's workspace through a design grant. */
export async function handoffReleases(actor: Actor) {
  return withActor(actor, async (tx) =>
    tx
      .selectFrom("core.report_releases as r")
      .select(["r.id", "r.version", "r.status", "r.released_at", "r.project_id", sql<string>`r.manifest->>'report'`.as("title"), sql<string>`r.manifest->'period'->>'label'`.as("period")])
      .where(sql<boolean>`authz.grant_role(r.project_id) = 'design'`)
      .orderBy("r.released_at", "desc")
      .execute(),
  );
}

export async function uploadProof(actor: Actor, releaseId: string, file: { filename: string; bytes: Uint8Array }): Promise<{ proofId: string; version: number }> {
  if (file.bytes.length > 50 * 1024 * 1024) throw new HttpError(413, "too_large");
  const kind = detect(file.bytes, file.filename);
  if (!kind || kind.mime !== "application/pdf") throw new HttpError(415, "pdf_required");
  const verdict = await scan(file.bytes);
  if (!verdict.clean) throw new HttpError(422, "malware_detected");
  return withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.report_releases").select(["id", "project_id", "owner_tenant_id"]).where("id", "=", releaseId).executeTakeFirst();
    if (!r) throw notFound();
    await designAccess(tx, actor, r.project_id);
    const last = await tx.selectFrom("core.design_proofs").select(sql<number>`coalesce(max(version), 0)::int`.as("v")).where("release_id", "=", releaseId).executeTakeFirstOrThrow();
    const digest = sha(file.bytes);
    const key = `proofs/${r.owner_tenant_id}/${releaseId}/${last.v + 1}-${digest.slice(0, 12)}.pdf`;
    await putObject(key, file.bytes, "application/pdf", digest);
    const p = await tx.insertInto("core.design_proofs").values({ owner_tenant_id: r.owner_tenant_id, project_id: r.project_id, release_id: releaseId, version: last.v + 1, filename: file.filename.slice(0, 200), storage_key: key, sha256: digest, size_bytes: file.bytes.length, uploaded_by: actor.userId }).returning(["id", "version"]).executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "design.proof_upload", objectType: "design_proof", objectId: p.id, ownerTenantId: r.owner_tenant_id, projectId: r.project_id, after: { release: releaseId, version: p.version, sha256: digest } });
    return { proofId: p.id, version: p.version };
  });
}

export async function decideProof(actor: Actor, proofId: string, input: { decision: "approved" | "changes_requested"; note?: string | null }): Promise<void> {
  if (input.decision === "changes_requested" && (input.note?.trim().length ?? 0) < 10) throw new HttpError(422, "reason_required");
  await withActor(actor, async (tx) => {
    const p = await tx.selectFrom("core.design_proofs").select(["id", "project_id", "owner_tenant_id", "status", "uploaded_by"]).where("id", "=", proofId).executeTakeFirst();
    if (!p) throw notFound();
    const a = await requireProjectAction(tx, actor, p.project_id, "report.review");
    if (a.via !== "member") throw forbidden("owner_decision");
    if (p.status !== "submitted") throw new HttpError(409, "invalid_transition");
    if (p.uploaded_by === actor.userId) throw forbidden("own_work");
    await tx.updateTable("core.design_proofs").set({ status: input.decision, decided_by: actor.userId, decided_at: new Date(), decision_note: input.note?.trim() || null }).where("id", "=", proofId).execute();
    await audit(tx, actor, { action: `design.proof_${input.decision}`, objectType: "design_proof", objectId: proofId, ownerTenantId: p.owner_tenant_id, projectId: p.project_id, after: { note: input.note ?? null } });
  });
}

// ---------------------------------------------------------------- cross-report reconciliation (G6-09)

/** The same metric used by two reports of a cycle must be the same fact (and so the same value). */
export async function crossReportCheck(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["project_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    const rows = await tx
      .selectFrom("core.metric_references as m")
      .innerJoin("core.report_sections as s", "s.current_version_id", "m.section_version_id")
      .innerJoin("core.reports as r", "r.id", "s.report_id")
      .leftJoin("core.metric_fact_versions as f", "f.id", "m.fact_id")
      .select(["r.id as report_id", "r.title", "m.token", "m.fact_id", "m.rendered", "f.metric_key", "f.boundary_kind", "f.value_num"])
      .where("r.cycle_id", "=", cycleId)
      .execute();
    const byKey = new Map<string, typeof rows>();
    for (const r of rows) if (r.metric_key) byKey.set(`${r.metric_key}|${r.boundary_kind ?? ""}`, [...(byKey.get(`${r.metric_key}|${r.boundary_kind ?? ""}`) ?? []), r]);
    return [...byKey.entries()]
      .filter(([, list]) => new Set(list.map((x) => x.report_id)).size > 1)
      .map(([key, list]) => ({ key, reports: [...new Set(list.map((x) => x.title))], consistent: new Set(list.map((x) => x.fact_id)).size === 1, values: [...new Set(list.map((x) => x.value_num))] }));
  });
}

export const reportTemplates = () => TEMPLATES.map((t) => ({ id: t.id, kind: t.kind, sections: t.sections.length }));
export { parse as parseBody };
