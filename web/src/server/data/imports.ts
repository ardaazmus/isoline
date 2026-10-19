/**
 * Source imports (G3-05; plan 09 §2): the file is scanned before it is read, stored as evidence, parsed and
 * validated row by row (preview); commit turns the valid rows into submitted observation versions in one
 * transaction with a rollback manifest; the same file cannot be committed twice to a project.
 */
import { gridToStrings, readSheets, xlsxWorkbook } from "@/lib/spreadsheet";
import { audit, enqueue } from "../audit/audit";
import { withActor, type Actor } from "../db/client";
import { uploadEvidence } from "../evidence/service";
import { scan } from "../evidence/scanner";
import { HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { METRIC } from "./catalog";
import { detectMapping, parseRows, type ParsedRow, type RowError, type Target } from "./import-parse";
import { normaliseEntry } from "./service";

export const MAX_IMPORT_FILE = 15 * 1024 * 1024;

export type ImportPreview = { importId: string; duplicateOf: string | null; total: number; valid: number; errors: RowError[]; rows: ParsedRow[]; ownReview: number };

export async function previewImport(actor: Actor, campaignId: string, file: { filename: string; bytes: Uint8Array }): Promise<ImportPreview> {
  if (file.bytes.length > MAX_IMPORT_FILE) throw new HttpError(413, "file_too_large");
  if (!/\.(xlsx|xls|csv|txt|ods)$/i.test(file.filename)) throw new HttpError(415, "unsupported_file_type");
  // the parser never sees a file the scanner has not passed
  const verdict = await scan(file.bytes);
  if (!verdict.clean) throw new HttpError(422, "file_infected");

  const ctx = await withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.data_campaigns").select(["id", "project_id", "cycle_id", "owner_tenant_id"]).where("id", "=", campaignId).executeTakeFirst();
    if (!c) throw notFound("campaign_not_found");
    await requireProjectAction(tx, actor, c.project_id, "data.request");
    const targets = await tx
      .selectFrom("core.data_requests as r")
      .leftJoin("core.facilities as f", "f.id", "r.facility_id")
      .select(["r.id", "r.metric_code", "r.facility_id", "f.name as facility_name", "r.status", "r.reviewer_user_id"])
      .where("r.campaign_id", "=", campaignId)
      .execute();
    return { c, targets };
  });

  let sheets: { name: string; grid: unknown[][] }[];
  try {
    sheets = await readSheets(file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer, file.filename);
  } catch {
    throw new HttpError(422, "unreadable_file");
  }
  let picked: { sheet: string; grid: string[][]; headerRow: number; mapping: ReturnType<typeof detectMapping> } | null = null;
  for (const s of sheets) {
    const grid = gridToStrings(s.grid as never);
    const d = detectMapping(grid);
    if (d) {
      picked = { sheet: s.name, grid, headerRow: d.headerRow, mapping: d };
      break;
    }
  }
  if (!picked) throw new HttpError(422, "no_header_row");
  const targets: Target[] = ctx.targets.map((t) => ({ requestId: t.id, metricCode: t.metric_code, facilityId: t.facility_id, facilityName: t.facility_name, status: t.status, reviewerUserId: t.reviewer_user_id }));
  const parsed = parseRows(picked.grid, picked.headerRow, picked.mapping!.mapping, targets);

  // the raw file is evidence of every value that comes from it
  const ev = await uploadEvidence(actor, ctx.c.project_id, { filename: file.filename, bytes: file.bytes, classification: "internal" });
  return withActor(actor, async (tx) => {
    const prior = await tx.selectFrom("core.source_imports").select("id").where("project_id", "=", ctx.c.project_id).where("sha256", "=", ev.sha256).where("status", "=", "committed").executeTakeFirst();
    const imp = await tx
      .insertInto("core.source_imports")
      .values({
        owner_tenant_id: ctx.c.owner_tenant_id,
        project_id: ctx.c.project_id,
        cycle_id: ctx.c.cycle_id,
        campaign_id: campaignId,
        evidence_id: ev.id,
        sha256: ev.sha256,
        file_name: file.filename.slice(0, 255),
        sheet: picked!.sheet,
        mapping: JSON.stringify({ headerRow: picked!.headerRow, columns: picked!.mapping!.mapping }),
        rows_total: parsed.total,
        rows_valid: parsed.rows.length,
        rows_error: parsed.errors.length,
        errors: JSON.stringify(parsed.errors),
        parsed: JSON.stringify(parsed.rows),
        created_by: actor.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "import.preview", objectType: "source_import", objectId: imp.id, ownerTenantId: ctx.c.owner_tenant_id, projectId: ctx.c.project_id, after: { file: file.filename, sha256: ev.sha256, total: parsed.total, valid: parsed.rows.length, errors: parsed.errors.length } });
    const ownReview = parsed.rows.filter((r) => targets.find((t) => t.requestId === r.requestId)?.reviewerUserId === actor.userId).length;
    return { importId: imp.id, duplicateOf: prior?.id ?? null, total: parsed.total, valid: parsed.rows.length, errors: parsed.errors, rows: parsed.rows.slice(0, 200), ownReview };
  });
}

/** Commits the rows validated at preview: one submitted version per request (lines grouped), evidence linked. */
export async function commitImport(actor: Actor, importId: string): Promise<{ versions: number; requests: number }> {
  return withActor(actor, async (tx) => {
    const imp = await tx.selectFrom("core.source_imports").selectAll().where("id", "=", importId).forUpdate().executeTakeFirst();
    if (!imp) throw notFound("import_not_found");
    await requireProjectAction(tx, actor, imp.project_id, "data.request");
    if (imp.status !== "previewed") throw new HttpError(409, "import_not_previewed");
    const dup = await tx.selectFrom("core.source_imports").select("id").where("project_id", "=", imp.project_id).where("sha256", "=", imp.sha256).where("status", "=", "committed").executeTakeFirst();
    if (dup) throw new HttpError(409, "import_already_committed");
    const rows = imp.parsed as unknown as ParsedRow[];
    const byRequest = new Map<string, ParsedRow[]>();
    for (const r of rows) byRequest.set(r.requestId, [...(byRequest.get(r.requestId) ?? []), r]);
    const created: string[] = [];
    const now = new Date();
    for (const [requestId, group] of byRequest) {
      const req = await tx.selectFrom("core.data_requests").selectAll().where("id", "=", requestId).forUpdate().executeTakeFirst();
      // requests that moved on since the preview (submitted by hand, accepted) are skipped, not overwritten
      if (!req || !["created", "assigned", "sent", "revision_required"].includes(req.status) || !req.assignee_user_id || !req.reviewer_user_id) continue;
      const m = METRIC.get(req.metric_code)!;
      const n = m.multiline
        ? normaliseEntry(m, { lines: group.map((g) => ({ key: g.line!, value: g.value!, unit: g.unit! })), text: group.map((g) => g.note).filter(Boolean).join(" · ") || null })
        : normaliseEntry(m, { value: group[0].value, unit: group[0].unit, text: group[0].text ?? group[0].note });
      // an unfinished draft of the importer's own is superseded by the imported value (never deleted)
      await tx.updateTable("core.observation_versions").set({ status: "superseded" }).where("request_id", "=", requestId).where("status", "=", "draft").execute();
      const last = await tx.selectFrom("core.observation_versions").select((eb) => eb.fn.coalesce(eb.fn.max("revision"), eb.lit(0)).as("r")).where("request_id", "=", requestId).executeTakeFirstOrThrow();
      const v = await tx
        .insertInto("core.observation_versions")
        .values({ owner_tenant_id: req.owner_tenant_id, project_id: req.project_id, request_id: requestId, revision: Number(last.r) + 1, ...n, quality: group[0].quality, method_note: group.map((g) => g.note).filter(Boolean).join(" · ") || null, source_ref: `${imp.file_name} · ${imp.sheet ?? ""} · ${group.map((g) => g.row).join(",")}`, status: "submitted", submitted_at: now, entered_by: actor.userId, import_id: importId })
        .returning("id")
        .executeTakeFirstOrThrow();
      created.push(v.id);
      await tx.updateTable("core.data_requests").set({ status: "submitted", submitted_at: now }).where("id", "=", requestId).execute();
      await tx
        .insertInto("core.evidence_links")
        .values({ owner_tenant_id: req.owner_tenant_id, project_id: req.project_id, evidence_id: imp.evidence_id, target_type: "data_request", target_id: requestId, linked_by: actor.userId })
        .onConflict((oc) => oc.doNothing())
        .execute();
      await enqueue(tx, "notify", { userId: req.reviewer_user_id, ownerTenantId: req.owner_tenant_id, projectId: req.project_id, kind: "task_submitted", payload: { requestId, metric: req.metric_code, viaImport: importId }, mail: false }, { ownerTenantId: req.owner_tenant_id, dedupeKey: `task:${requestId}:import:${importId}` });
    }
    await tx.updateTable("core.source_imports").set({ status: "committed", committed_at: now, created_versions: created }).where("id", "=", importId).execute();
    await audit(tx, actor, { action: "import.commit", objectType: "source_import", objectId: importId, ownerTenantId: imp.owner_tenant_id, projectId: imp.project_id, after: { versions: created.length, requests: byRequest.size } });
    return { versions: created.length, requests: byRequest.size };
  });
}

/** Undoes a commit while none of its versions has been decided; the requests go back to where they were. */
export async function rollbackImport(actor: Actor, importId: string): Promise<{ removed: number }> {
  return withActor(actor, async (tx) => {
    const imp = await tx.selectFrom("core.source_imports").selectAll().where("id", "=", importId).forUpdate().executeTakeFirst();
    if (!imp) throw notFound("import_not_found");
    await requireProjectAction(tx, actor, imp.project_id, "data.request");
    if (imp.status !== "committed") throw new HttpError(409, "import_not_committed");
    const versions = imp.created_versions.length ? await tx.selectFrom("core.observation_versions").select(["id", "request_id", "status"]).where("id", "in", imp.created_versions).execute() : [];
    if (versions.some((v) => v.status !== "submitted")) throw new HttpError(409, "import_in_review");
    const rows = imp.parsed as unknown as ParsedRow[];
    for (const v of versions) {
      const prev = rows.find((r) => r.requestId === v.request_id)?.prevStatus ?? "sent";
      await tx.updateTable("core.data_requests").set({ status: prev === "created" ? "created" : prev, submitted_at: null }).where("id", "=", v.request_id).where("status", "=", "submitted").execute();
    }
    if (versions.length) {
      await tx.updateTable("core.observation_versions").set({ status: "rejected" }).where("id", "in", versions.map((v) => v.id)).where("status", "=", "submitted").execute();
      await tx.updateTable("core.evidence_links").set({ unlinked_at: new Date(), unlinked_by: actor.userId }).where("evidence_id", "=", imp.evidence_id).where("target_type", "=", "data_request").where("unlinked_at", "is", null).execute();
    }
    await tx.updateTable("core.source_imports").set({ status: "rolled_back", rolled_back_at: new Date() }).where("id", "=", importId).execute();
    await audit(tx, actor, { action: "import.rollback", objectType: "source_import", objectId: importId, ownerTenantId: imp.owner_tenant_id, projectId: imp.project_id, payload: { versions: versions.length } });
    return { removed: versions.length };
  });
}

export async function listImports(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    return tx
      .selectFrom("core.source_imports as i")
      .leftJoin("user as u", "u.id", "i.created_by")
      .select(["i.id", "i.file_name", "i.sheet", "i.status", "i.rows_total", "i.rows_valid", "i.rows_error", "i.errors", "i.created_at", "i.committed_at", "i.rolled_back_at", "i.campaign_id", "u.name as created_by_name"])
      .where("i.project_id", "=", projectId)
      .orderBy("i.created_at", "desc")
      .execute();
  });
}

/** An XLSX with one row per request the person can see — fill in value, unit and quality, then import it. */
export async function campaignTemplate(actor: Actor, campaignId: string, labels: { metric: string; name: (code: string) => string; headers: string[] }): Promise<ArrayBuffer> {
  const rows = await withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.data_campaigns").select(["project_id"]).where("id", "=", campaignId).executeTakeFirst();
    if (!c) throw notFound("campaign_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    return tx.selectFrom("core.data_requests as r").leftJoin("core.facilities as f", "f.id", "r.facility_id").select(["r.metric_code", "f.name as facility", "r.period_label"]).where("r.campaign_id", "=", campaignId).where("r.status", "in", ["created", "assigned", "sent", "revision_required"]).orderBy("r.metric_code").execute();
  });
  const body = rows.flatMap((r) => {
    const m = METRIC.get(r.metric_code)!;
    const lines = m.multiline ? (m.lineKeys.length ? m.lineKeys : [""]) : [""];
    return lines.map((line) => [r.metric_code, labels.name(r.metric_code), r.facility ?? "", r.period_label, line, "", "", "", ""]);
  });
  return xlsxWorkbook([{ name: labels.metric, rows: [labels.headers, ...body], widths: [22, 40, 22, 12, 14, 14, 10, 12, 30], text: [0, 1, 2, 3, 4] }]);
}
