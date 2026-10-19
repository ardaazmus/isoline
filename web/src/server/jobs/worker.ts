/**
 * Outbox worker (ADR-006). Claims due events with FOR UPDATE SKIP LOCKED, so several workers can run; each event is
 * handled at least once and handlers are idempotent. Failures back off exponentially; after MAX_ATTEMPTS the event
 * is "dead" and shows up on the operations screen. Sealed secrets are removed from the payload once delivered.
 */
import { sql } from "kysely";
import { unseal } from "../crypto/seal";
import { withSystem } from "../db/client";
import { processScan } from "../evidence/service";
import { MAIL, sendMail } from "../mail/mailer";

export const MAX_ATTEMPTS = 8;

type Event = { id: number; kind: string; payload: Record<string, unknown>; attempts: number; owner_tenant_id: string | null };
type Handler = (e: Event) => Promise<void>;

const appUrl = (path: string) => `${(process.env.APP_BASE_URL ?? "http://localhost:3210").replace(/\/$/, "")}${path}`;

async function invitationMail(e: Event, claim: boolean): Promise<void> {
  const p = e.payload as { invitationId: string; email: string; sealedToken?: string };
  if (!p.sealedToken) return; // already delivered and scrubbed
  const inv = await withSystem("worker: invitation mail context", (tx) =>
    tx.selectFrom("core.invitations as i").innerJoin("core.tenants as t", "t.id", "i.tenant_id").select(["t.name", "i.role", "i.accepted_at", "i.revoked_at", "i.expires_at"]).where("i.id", "=", p.invitationId).executeTakeFirst(),
  );
  if (!inv || inv.accepted_at || inv.revoked_at || inv.expires_at <= new Date()) return; // nothing to send any more
  const token = unseal(p.sealedToken, `invitation:${p.invitationId}`);
  const url = appUrl(`/tr/auth/invite/${encodeURIComponent(token)}`);
  await sendMail({ to: p.email, ...(claim ? MAIL.claim(inv.name, url) : MAIL.invitation(inv.name, inv.role, url)) });
}

async function grantMail(e: Event): Promise<void> {
  const p = e.payload as { grantId: string; recipientTenantId: string };
  const ctx = await withSystem("worker: grant mail context", async (tx) => {
    const g = await tx
      .selectFrom("core.external_grants as g")
      .innerJoin("core.projects as p", "p.id", "g.project_id")
      .innerJoin("core.tenants as o", "o.id", "g.owner_tenant_id")
      .select(["o.name as owner", "p.name as project", "g.role", "g.revoked_at"])
      .where("g.id", "=", p.grantId)
      .executeTakeFirst();
    const admins = await tx
      .selectFrom("core.memberships as m")
      .innerJoin("user as u", "u.id", "m.user_id")
      .select("u.email")
      .where("m.tenant_id", "=", p.recipientTenantId)
      .where("m.role", "in", ["owner", "admin"])
      .where("m.revoked_at", "is", null)
      .execute();
    return { g, admins };
  });
  if (!ctx.g || ctx.g.revoked_at) return;
  for (const a of ctx.admins) await sendMail({ to: a.email, ...MAIL.grant(ctx.g.owner, ctx.g.project, ctx.g.role) });
}

export const HANDLERS: Record<string, Handler> = {
  "mail.invitation": (e) => invitationMail(e, false),
  "mail.claim": (e) => invitationMail(e, true),
  "mail.grant": grantMail,
  "evidence.scan": async (e) => {
    await processScan(String(e.payload.evidenceId));
  },
};

/** Registers more handlers (later gates: reminders, imports, report packages). */
export function registerHandler(kind: string, h: Handler): void {
  HANDLERS[kind] = h;
}

const backoffSeconds = (attempts: number) => Math.min(2 ** attempts * 15, 6 * 3600);

async function claim(limit: number): Promise<Event[]> {
  return withSystem("worker: claim due outbox events", async (tx) => {
    const r = await sql<Event>`
      update core.outbox_events o set status = 'processing', attempts = o.attempts + 1, next_attempt_at = now()
      where o.id in (select id from core.outbox_events where status = 'pending' and next_attempt_at <= now() order by id limit ${limit} for update skip locked)
      returning o.id, o.kind, o.payload, o.attempts, o.owner_tenant_id`.execute(tx);
    return r.rows;
  });
}

async function finish(e: Event, error: unknown): Promise<void> {
  await withSystem("worker: settle outbox event", async (tx) => {
    if (!error) {
      const { sealedToken: _drop, ...rest } = e.payload;
      void _drop;
      await tx.updateTable("core.outbox_events").set({ status: "done", processed_at: new Date(), last_error: null, payload: JSON.stringify(rest) }).where("id", "=", e.id).execute();
      return;
    }
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
    const dead = e.attempts >= MAX_ATTEMPTS;
    await tx
      .updateTable("core.outbox_events")
      .set({ status: dead ? "dead" : "pending", last_error: message, next_attempt_at: new Date(Date.now() + backoffSeconds(e.attempts) * 1000) })
      .where("id", "=", e.id)
      .execute();
  });
}

/** Processes up to `limit` due events once; returns how many were handled and how many failed. */
export async function runOnce(limit = 20): Promise<{ handled: number; failed: number }> {
  const events = await claim(limit);
  let failed = 0;
  for (const e of events) {
    const h = HANDLERS[e.kind];
    try {
      if (!h) throw new Error(`no handler for ${e.kind}`);
      await h(e);
      await finish(e, null);
    } catch (err) {
      failed++;
      await finish(e, err);
    }
  }
  return { handled: events.length, failed };
}

/** Events left in "processing" by a crashed worker go back to the queue after `minutes`. */
export async function recoverStuck(minutes = 15): Promise<number> {
  return withSystem("worker: recover stuck events", async (tx) => {
    const r = await sql`update core.outbox_events set status = 'pending' where status = 'processing' and next_attempt_at < now() - make_interval(mins => ${minutes})`.execute(tx);
    return Number(r.numAffectedRows ?? 0);
  });
}

export async function queueHealth() {
  return withSystem("operations: queue health", (tx) =>
    tx.selectFrom("core.outbox_events").select(["status", "kind", sql<number>`count(*)`.as("n"), sql<Date>`min(created_at)`.as("oldest")]).groupBy(["status", "kind"]).execute(),
  );
}
