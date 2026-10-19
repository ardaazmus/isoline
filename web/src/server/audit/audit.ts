/**
 * Audit events and outbox (ADR-006). Both are written inside the caller's transaction: if the audit insert fails
 * the whole operation rolls back (fail-closed). The hash chain is computed by a database trigger.
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import type { Actor, Tx } from "../db/client";

export type AuditInput = {
  action: string;
  objectType: string;
  objectId: string;
  ownerTenantId: string | null;
  projectId?: string | null;
  before?: unknown;
  after?: unknown;
  payload?: Record<string, unknown>;
};

/** Canonical JSON: object keys sorted, so the same value always has the same digest. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
}

export const digest = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");

export async function audit(tx: Tx, actor: Actor | null, e: AuditInput): Promise<void> {
  await tx
    .insertInto("core.audit_events")
    .values({
      owner_tenant_id: e.ownerTenantId,
      acting_tenant_id: actor?.actingTenantId ?? null,
      actor_user_id: actor?.userId ?? null,
      project_id: e.projectId ?? null,
      action: e.action,
      object_type: e.objectType,
      object_id: e.objectId,
      before_digest: e.before === undefined ? null : digest(e.before),
      after_digest: e.after === undefined ? null : digest(e.after),
      payload: JSON.stringify(e.payload ?? {}),
      request_id: actor?.requestId ?? null,
    })
    .execute();
}

export type ChainCheck = { ok: boolean; events: number; firstBrokenId: number | null };

/**
 * Recomputes the tenant's hash chain with the trigger's formula. A row edited or deleted behind the application's
 * back (the app role cannot, a superuser could) breaks the chain at that point.
 */
export async function verifyChain(tx: Tx, ownerTenantId: string): Promise<ChainCheck> {
  const r = await sql<{ id: number; ok: boolean }>`
    select id, (hash = expected and prev_hash is not distinct from prev) as ok from (
      select id, hash, prev_hash, lag(hash) over w as prev,
        encode(public.digest(coalesce(lag(hash) over w, '') || '|' || action || '|' || object_type || '|' || object_id || '|' ||
          coalesce(actor_user_id::text, '') || '|' || coalesce(after_digest, '') || '|' || payload::text || '|' ||
          to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), 'sha256'), 'hex') as expected
      from core.audit_events where owner_tenant_id = ${ownerTenantId} window w as (order by id)
    ) x order by id`.execute(tx);
  const bad = r.rows.find((x) => !x.ok);
  return { ok: !bad, events: r.rows.length, firstBrokenId: bad ? Number(bad.id) : null };
}

/** Queues a side effect (mail, reminder, scan) in the same transaction; dedupeKey makes it idempotent. */
export async function enqueue(tx: Tx, kind: string, payload: Record<string, unknown>, opts: { dedupeKey?: string; ownerTenantId?: string | null; at?: Date } = {}): Promise<void> {
  await sql`select authz.enqueue(${kind}, ${JSON.stringify(payload)}::jsonb, ${opts.dedupeKey ?? null}, ${opts.ownerTenantId ?? null}::uuid, ${opts.at ?? null}::timestamptz)`.execute(tx);
}
