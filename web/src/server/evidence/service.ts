/**
 * Evidence objects (G1-09, G3-06; ADR-005). Upload → quarantine prefix + "scanning" row in one transaction →
 * worker scans → clean files move to the evidence prefix and become "available"; infected ones stay quarantined.
 * Downloads are presigned for five minutes after a project permission check and each one is logged.
 */
import { createHash, randomUUID } from "node:crypto";
import { audit, enqueue } from "../audit/audit";
import { withActor, withSystem, type Actor } from "../db/client";
import { HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { detect, MAX_EVIDENCE_BYTES, safeFilename } from "./filetype";
import { scan } from "./scanner";
import { getObjectBytes, moveObject, presignDownload, putObject } from "./storage";

export type Classification = "public" | "internal" | "confidential" | "personal";

export type UploadInput = { filename: string; bytes: Uint8Array; classification?: Classification };
export type UploadResult = { id: string; sha256: string; duplicate: boolean; scanStatus: string };

export const sha256Hex = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export async function uploadEvidence(actor: Actor, projectId: string, input: UploadInput): Promise<UploadResult> {
  if (input.bytes.length === 0) throw new HttpError(422, "empty_file");
  if (input.bytes.length > MAX_EVIDENCE_BYTES) throw new HttpError(413, "file_too_large");
  const filename = safeFilename(input.filename);
  const type = detect(input.bytes, filename);
  if (!type) throw new HttpError(415, "unsupported_file_type");
  const sha256 = sha256Hex(input.bytes);

  return withActor(actor, async (tx) => {
    const access = await requireProjectAction(tx, actor, projectId, "evidence.upload");
    const existing = await tx.selectFrom("core.evidence_objects").select(["id", "scan_status"]).where("project_id", "=", projectId).where("sha256", "=", sha256).executeTakeFirst();
    if (existing?.scan_status === "awaiting_file") {
      // a legacy placeholder (G0 R5): the file whose hash the old workspace recorded has arrived — the hash match is
      // the check; the row moves to scanning under the system role (the app role may not rewrite storage fields)
      const key = `q/${access.ownerTenantId}/${projectId}/${existing.id}`;
      await putObject(key, input.bytes, type.mime, sha256);
      await withSystem("evidence: fulfil a legacy placeholder after evidence.upload check", async (s) => {
        await s.updateTable("core.evidence_objects").set({ storage_key: key, mime: type.mime, size_bytes: input.bytes.length, filename, scan_status: "scanning", scan_detail: null }).where("id", "=", existing.id).where("scan_status", "=", "awaiting_file").execute();
        await enqueue(s, "evidence.scan", { evidenceId: existing.id }, { ownerTenantId: access.ownerTenantId, dedupeKey: `scan:${existing.id}` });
      });
      await tx.insertInto("core.evidence_access_log").values({ owner_tenant_id: access.ownerTenantId, evidence_id: existing.id, actor_user_id: actor.userId, acting_tenant_id: actor.actingTenantId, action: "upload" }).execute();
      await audit(tx, actor, { action: "evidence.fulfil_placeholder", objectType: "evidence", objectId: existing.id, ownerTenantId: access.ownerTenantId, projectId, after: { filename, mime: type.mime, size: input.bytes.length, sha256 } });
      return { id: existing.id, sha256, duplicate: false, scanStatus: "scanning" };
    }
    if (existing) return { id: existing.id, sha256, duplicate: true, scanStatus: existing.scan_status };

    const id = randomUUID();
    const key = `q/${access.ownerTenantId}/${projectId}/${id}`;
    await tx
      .insertInto("core.evidence_objects")
      .values({ id, owner_tenant_id: access.ownerTenantId, project_id: projectId, storage_key: key, filename, mime: type.mime, size_bytes: input.bytes.length, sha256, classification: input.classification ?? "internal", scan_status: "scanning", uploaded_by: actor.userId })
      .execute();
    await tx.insertInto("core.evidence_access_log").values({ owner_tenant_id: access.ownerTenantId, evidence_id: id, actor_user_id: actor.userId, acting_tenant_id: actor.actingTenantId, action: "upload" }).execute();
    await audit(tx, actor, { action: "evidence.upload", objectType: "evidence", objectId: id, ownerTenantId: access.ownerTenantId, projectId, after: { filename, mime: type.mime, size: input.bytes.length, sha256 } });
    await enqueue(tx, "evidence.scan", { evidenceId: id }, { ownerTenantId: access.ownerTenantId, dedupeKey: `scan:${id}` });
    // the object is written last: if storage fails the row rolls back; if the commit fails a quarantined orphan remains
    await putObject(key, input.bytes, type.mime, sha256);
    return { id, sha256, duplicate: false, scanStatus: "scanning" };
  });
}

/** Worker step: scan one quarantined object and release or keep it. Idempotent. */
export async function processScan(evidenceId: string): Promise<"available" | "quarantined" | "skipped"> {
  const row = await withSystem("scanner: read evidence awaiting scan", (tx) => tx.selectFrom("core.evidence_objects").selectAll().where("id", "=", evidenceId).executeTakeFirst());
  if (!row || row.scan_status !== "scanning") return "skipped";
  const bytes = await getObjectBytes(row.storage_key);
  if (sha256Hex(bytes) !== row.sha256) throw new Error(`evidence ${evidenceId}: stored object does not match its hash`);
  const result = await scan(bytes);
  if (result.clean) {
    const key = `e/${row.owner_tenant_id}/${row.project_id}/${row.id}`;
    await moveObject(row.storage_key, key);
    await withSystem("scanner: release clean evidence", async (tx) => {
      await tx.updateTable("core.evidence_objects").set({ storage_key: key, scan_status: "available", scan_detail: `clean:${result.engine}` }).where("id", "=", row.id).where("scan_status", "=", "scanning").execute();
      await audit(tx, null, { action: "evidence.scan_clean", objectType: "evidence", objectId: row.id, ownerTenantId: row.owner_tenant_id, projectId: row.project_id, payload: { engine: result.engine } });
    });
    return "available";
  }
  await withSystem("scanner: quarantine infected evidence", async (tx) => {
    await tx.updateTable("core.evidence_objects").set({ scan_status: "quarantined", scan_detail: `${result.engine}:${result.signature ?? "unknown"}` }).where("id", "=", row.id).execute();
    await audit(tx, null, { action: "evidence.quarantine", objectType: "evidence", objectId: row.id, ownerTenantId: row.owner_tenant_id, projectId: row.project_id, payload: { engine: result.engine, signature: result.signature ?? null } });
  });
  return "quarantined";
}

export async function listEvidence(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    return tx
      .selectFrom("core.evidence_objects as e")
      .leftJoin("user as u", "u.id", "e.uploaded_by")
      .select(["e.id", "e.filename", "e.mime", "e.size_bytes", "e.sha256", "e.classification", "e.scan_status", "e.uploaded_at", "e.retention_until", "e.legal_hold", "u.name as uploaded_by_name"])
      .where("e.project_id", "=", projectId)
      .orderBy("e.uploaded_at", "desc")
      .execute();
  });
}

export async function downloadEvidence(actor: Actor, evidenceId: string): Promise<{ url: string; filename: string; expiresInSeconds: number }> {
  return withActor(actor, async (tx) => {
    const e = await tx.selectFrom("core.evidence_objects").select(["id", "project_id", "owner_tenant_id", "storage_key", "filename", "mime", "scan_status"]).where("id", "=", evidenceId).executeTakeFirst();
    if (!e) throw notFound("evidence_not_found");
    await requireProjectAction(tx, actor, e.project_id, "evidence.download");
    if (e.scan_status !== "available") throw new HttpError(409, `evidence_${e.scan_status}`);
    await tx.insertInto("core.evidence_access_log").values({ owner_tenant_id: e.owner_tenant_id, evidence_id: e.id, actor_user_id: actor.userId, acting_tenant_id: actor.actingTenantId, action: "download" }).execute();
    const seconds = 300;
    return { url: await presignDownload(e.storage_key, e.filename, e.mime, seconds), filename: e.filename, expiresInSeconds: seconds };
  });
}

export async function evidenceAccessLog(actor: Actor, evidenceId: string) {
  return withActor(actor, (tx) =>
    tx
      .selectFrom("core.evidence_access_log as l")
      .leftJoin("user as u", "u.id", "l.actor_user_id")
      .select(["l.id", "l.action", "l.at", "l.acting_tenant_id", "u.name", "u.email"])
      .where("l.evidence_id", "=", evidenceId)
      .orderBy("l.id", "desc")
      .execute(),
  );
}
