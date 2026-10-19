/**
 * Controlled source connectors (G8-01; plan 12 §5). A connector pulls CSV or JSON rows from one configured host
 * (a customer's ERP/HRIS export endpoint, usually on the local network) into one campaign, through the same path
 * as a file import: scanned, stored as evidence, validated row by row, committed as submitted versions that a
 * reviewer still has to accept — a source change never alters accepted or released data by itself.
 *
 *   - tenant scope: the connector belongs to the project owner and runs with the rights of the member who set it
 *     up (no service super-user);
 *   - idempotency: the payload's SHA-256 is compared with the last successful pull; the same payload is recorded
 *     as "unchanged" and creates nothing; a re-sent file is also refused by the import's own duplicate check;
 *   - failure queue: a pull runs as an outbox job — failures are retried with back-off and end as "dead" events;
 *     every attempt leaves a connector_run row with its message;
 *   - network: http(s) only, the host fixed at set-up, no redirects, 15 s timeout, 15 MB cap; the secret is
 *     sealed with AES-256-GCM and sent only as a bearer token to that host.
 */
import { createHash } from "node:crypto";
import { audit, enqueue } from "../audit/audit";
import { seal, unseal } from "../crypto/seal";
import { withActor, withSystem, type Actor } from "../db/client";
import { commitImport, MAX_IMPORT_FILE, previewImport } from "../data/imports";
import { forbidden, HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";

const TIMEOUT_MS = 15_000;
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

export type ConnectorInput = { name: string; kind: "http_csv" | "http_json"; url: string; secret?: string | null; schedule?: "manual" | "daily" };

function parseUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new HttpError(422, "invalid_url");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new HttpError(422, "invalid_url");
  if (u.username || u.password) throw new HttpError(422, "credentials_in_url");
  return u;
}

export async function createConnector(actor: Actor, campaignId: string, input: ConnectorInput): Promise<{ id: string }> {
  const u = parseUrl(input.url);
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.data_campaigns").select(["id", "project_id", "owner_tenant_id"]).where("id", "=", campaignId).executeTakeFirst();
    if (!c) throw notFound("campaign_not_found");
    const a = await requireProjectAction(tx, actor, c.project_id, "data.request");
    // a connector acts for the data owner: it is set up by a member of the owning company, never through a grant
    if (a.via !== "member") throw forbidden("owner_decision");
    const r = await tx
      .insertInto("core.connectors")
      .values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, campaign_id: campaignId, name: input.name.trim(), kind: input.kind, url: u.toString(), allowed_host: u.host, run_as: actor.userId, schedule: input.schedule ?? "manual", created_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (input.secret) await tx.updateTable("core.connectors").set({ secret_sealed: seal(input.secret, `connector:${r.id}`) }).where("id", "=", r.id).execute();
    await audit(tx, actor, { action: "connector.create", objectType: "connector", objectId: r.id, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, after: { name: input.name, kind: input.kind, host: u.host, schedule: input.schedule ?? "manual", secret: Boolean(input.secret) } });
    return { id: r.id };
  });
}

export async function listConnectors(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    const connectors = await tx.selectFrom("core.connectors as c").innerJoin("core.data_campaigns as k", "k.id", "c.campaign_id").select(["c.id", "c.name", "c.kind", "c.allowed_host", "c.schedule", "c.status", "c.created_at", "k.title as campaign_title", "c.campaign_id"]).where("c.project_id", "=", projectId).orderBy("c.created_at").execute();
    const runs = connectors.length ? await tx.selectFrom("core.connector_runs").select(["id", "connector_id", "status", "rows", "valid", "message", "pulled_at", "checksum"]).where("connector_id", "in", connectors.map((c) => c.id)).orderBy("pulled_at", "desc").limit(200).execute() : [];
    return connectors.map((c) => ({ ...c, runs: runs.filter((r) => r.connector_id === c.id).slice(0, 10) }));
  });
}

/** Queues a pull (the worker runs it; failures are retried with back-off and end in the dead-letter state). */
export async function triggerConnector(actor: Actor, connectorId: string): Promise<{ queued: boolean }> {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.connectors").select(["id", "project_id", "owner_tenant_id", "status"]).where("id", "=", connectorId).executeTakeFirst();
    if (!c) throw notFound();
    await requireProjectAction(tx, actor, c.project_id, "data.request");
    if (c.status !== "active") throw new HttpError(409, "connector_paused");
    const minute = new Date().toISOString().slice(0, 16);
    await enqueue(tx, "connector.pull", { connectorId, triggeredBy: actor.userId }, { ownerTenantId: c.owner_tenant_id, dedupeKey: `connector:${connectorId}:${minute}` });
    await audit(tx, actor, { action: "connector.trigger", objectType: "connector", objectId: connectorId, ownerTenantId: c.owner_tenant_id, projectId: c.project_id });
    return { queued: true };
  });
}

/** JSON rows → the import's CSV layout (the same validation then applies). */
function jsonToCsv(body: string): string {
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("invalid_json_payload");
  }
  const rows = Array.isArray(data) ? data : Array.isArray((data as { rows?: unknown }).rows) ? (data as { rows: unknown[] }).rows : null;
  if (!rows) throw new Error("json_rows_missing");
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ["Metrik", "Tesis", "Kalem", "Değer", "Birim", "Kalite", "Açıklama"];
  const lines = rows.map((r) => {
    const o = r as Record<string, unknown>;
    return [o.metric, o.facility, o.line, o.value, o.unit, o.quality, o.note].map(cell).join(";");
  });
  return [head.join(";"), ...lines].join("\n");
}

async function fetchCapped(url: string, host: string, secret: string | null): Promise<Uint8Array> {
  const u = parseUrl(url);
  if (u.host !== host) throw new Error("host_not_allowed");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { accept: "text/csv, application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) } });
    if (res.status >= 300 && res.status < 400) throw new Error("redirect_refused");
    if (!res.ok) throw new Error(`http_${res.status}`);
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_IMPORT_FILE) throw new Error("payload_too_large");
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > MAX_IMPORT_FILE) throw new Error("payload_too_large");
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One pull (worker job "connector.pull"). Throws on network or source errors so the outbox retries; the run row
 * is written in every case.
 */
export async function pullConnector(connectorId: string, triggeredBy: string | null): Promise<{ status: "succeeded" | "unchanged"; rows: number; valid: number }> {
  const c = await withSystem("connector: load configuration", (tx) => tx.selectFrom("core.connectors").selectAll().where("id", "=", connectorId).executeTakeFirst());
  if (!c) throw new Error("connector_missing");
  const record = (v: { status: "succeeded" | "unchanged" | "failed"; checksum?: string | null; bytes?: number; rows?: number; valid?: number; errors?: unknown; importId?: string | null; message?: string | null }) =>
    withSystem("connector: record run", (tx) =>
      tx
        .insertInto("core.connector_runs")
        .values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, connector_id: c.id, resource: c.url, cursor: null, checksum: v.checksum ?? null, bytes: v.bytes ?? null, rows: v.rows ?? null, valid: v.valid ?? null, errors: JSON.stringify(v.errors ?? []), import_id: v.importId ?? null, status: v.status, message: v.message ?? null, triggered_by: triggeredBy })
        .execute(),
    );
  try {
    if (c.status !== "active") throw new Error("connector_paused");
    const raw = await fetchCapped(c.url, c.allowed_host, c.secret_sealed ? unseal(c.secret_sealed, `connector:${c.id}`) : null);
    const bytes = c.kind === "http_json" ? new TextEncoder().encode(jsonToCsv(new TextDecoder().decode(raw))) : raw;
    const checksum = sha(bytes);
    if (checksum === c.last_checksum) {
      await record({ status: "unchanged", checksum, bytes: bytes.length });
      return { status: "unchanged", rows: 0, valid: 0 };
    }
    const actor: Actor = { userId: c.run_as, actingTenantId: c.owner_tenant_id };
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const preview = await previewImport(actor, c.campaign_id, { filename: `${c.name.replace(/[^\p{L}\p{N}_-]+/gu, "-")}-${stamp}.csv`, bytes });
    let committed = 0;
    if (preview.valid > 0 && !preview.duplicateOf) committed = (await commitImport(actor, preview.importId)).versions;
    await withSystem("connector: remember payload", (tx) => tx.updateTable("core.connectors").set({ last_checksum: checksum }).where("id", "=", c.id).execute());
    await record({ status: "succeeded", checksum, bytes: bytes.length, rows: preview.total, valid: committed, errors: preview.errors, importId: preview.importId });
    return { status: "succeeded", rows: preview.total, valid: committed };
  } catch (e) {
    const message = (e instanceof HttpError ? e.code : e instanceof Error ? e.message : String(e)).slice(0, 500);
    await record({ status: "failed", message });
    throw e;
  }
}

/** Daily connectors, queued once per day by the worker (dedupe key per connector and day). */
export async function queueDailyConnectors(day: string): Promise<number> {
  return withSystem("connector: daily schedule", async (tx) => {
    const due = await tx.selectFrom("core.connectors").select(["id", "owner_tenant_id"]).where("schedule", "=", "daily").where("status", "=", "active").execute();
    for (const c of due) await enqueue(tx, "connector.pull", { connectorId: c.id, triggeredBy: null }, { ownerTenantId: c.owner_tenant_id, dedupeKey: `connector:${c.id}:day:${day}` });
    return due.length;
  });
}
