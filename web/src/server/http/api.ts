/**
 * The one request pipeline for /api/v1 (ADR-007). Every handler gets:
 *   1. a verified person from the Better Auth session (never from the request body),
 *   2. an acting tenant from `x-isoline-tenant` or the `isoline_tenant` cookie, checked against live membership,
 *   3. the tenant's MFA policy,
 *   4. zod-validated input,
 *   5. CSRF protection (Origin must be ours on state-changing methods),
 *   6. Idempotency-Key replay for POST,
 *   7. one error body: { error: { code, message?, details? } } — other tenants' objects are 404.
 */
import { createHash, randomUUID } from "node:crypto";
import { sql } from "kysely";
import { z, type ZodType } from "zod";
import { auth } from "../auth/auth";
import { withActor, type Actor } from "../db/client";
import { HttpError, notFound } from "../policy/policy";
import type { MemberRole } from "../policy/policy";
import type { Identity } from "../tenancy/service";

export const TENANT_HEADER = "x-isoline-tenant";
export const TENANT_COOKIE = "isoline_tenant";

export type Session = { identity: Identity; name: string; sessionId: string; twoFactorEnabled: boolean };
export type TenantActor = Actor & { role: MemberRole | null; requireMfa: boolean };

export type HandlerContext<I> = {
  req: Request;
  session: Session;
  actor: TenantActor;
  input: I;
  params: Record<string, string>;
  requestId: string;
};

type Opts<S extends ZodType | undefined> = {
  /** "required": acting tenant must be chosen; "optional": person-level call (e.g. onboarding, accept invitation). */
  tenant?: "required" | "optional";
  body?: S;
  query?: ZodType;
  status?: number;
  /** Person without a session may call (invitation preview). */
  public?: boolean;
  /** Handler reads the body itself (multipart upload); no Idempotency-Key replay — uploads dedupe by content hash. */
  raw?: boolean;
};

type Input<S> = S extends ZodType ? z.infer<S> : undefined;

export function problem(status: number, code: string, details?: unknown): Response {
  return Response.json({ error: { code, ...(details === undefined ? {} : { details }) } }, { status, headers: { "cache-control": "no-store" } });
}

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function trustedOrigins(): string[] {
  const base = process.env.APP_BASE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3210";
  return [new URL(base).origin, ...(process.env.TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean)];
}

/** Browsers always send Origin on cross-site unsafe requests; a foreign one is refused (OWASP CSRF cheat sheet). */
export function originAllowed(req: Request): boolean {
  if (!UNSAFE.has(req.method)) return true;
  const origin = req.headers.get("origin");
  if (origin) return trustedOrigins().includes(origin);
  return req.headers.get("sec-fetch-site") !== "cross-site";
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export async function sessionFrom(headers: Headers): Promise<Session | null> {
  const s = await auth().api.getSession({ headers });
  if (!s) return null;
  const u = s.user as typeof s.user & { twoFactorEnabled?: boolean | null };
  return { identity: { userId: u.id, email: u.email, emailVerified: u.emailVerified }, name: u.name, sessionId: s.session.id, twoFactorEnabled: Boolean(u.twoFactorEnabled) };
}

/**
 * Membership check plus the tenant's MFA rule, in one query (every API request and page runs it: G8-07 load test).
 * Same outcome as actorFor + the tenant lookup: no live membership is a 404, whatever the requested id looks like.
 */
export async function tenantActor(session: Session, requested: string | null, requestId: string): Promise<TenantActor> {
  const userId = session.identity.userId;
  if (!requested) return { userId, actingTenantId: null, requestId, role: null, requireMfa: false };
  if (!UUID.test(requested)) throw notFound("tenant_not_found");
  const m = await withActor({ userId, actingTenantId: null }, (tx) =>
    tx
      .selectFrom("core.memberships as m")
      .innerJoin("core.tenants as t", "t.id", "m.tenant_id")
      .select(["m.tenant_id", "m.role", "t.require_mfa"])
      .where("m.user_id", "=", userId)
      .where("m.tenant_id", "=", requested)
      .where("m.revoked_at", "is", null)
      .executeTakeFirst(),
  );
  if (!m) throw notFound("tenant_not_found");
  // the id as stored (lower case): callers compare it with ids from the database
  return actorOf(session, { tenantId: m.tenant_id, role: m.role as MemberRole, requireMfa: m.require_mfa }, requestId);
}

/**
 * The actor of a live membership row (tenantActor's query, or the person's membership list a page has already read):
 * the tenant's MFA rule applies the same way on both paths.
 */
export function actorOf(session: Session, m: { tenantId: string; role: MemberRole; requireMfa: boolean }, requestId: string): TenantActor {
  if (m.requireMfa && !session.twoFactorEnabled) throw new HttpError(403, "mfa_required");
  return { userId: session.identity.userId, actingTenantId: m.tenantId, requestId, role: m.role, requireMfa: m.requireMfa };
}

export const requestedTenant = (req: Request) => req.headers.get(TENANT_HEADER) ?? readCookie(req, TENANT_COOKIE);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Expected row_version from If-Match ("3" or W/"3"); undefined when absent. */
export function ifMatch(req: Request): number | undefined {
  const h = req.headers.get("if-match");
  if (!h) return undefined;
  const n = Number(h.replace(/^W\//, "").replace(/"/g, ""));
  if (!Number.isInteger(n) || n < 1) throw new HttpError(400, "invalid_if_match");
  return n;
}

async function idempotent(req: Request, session: Session, route: string, body: string, run: () => Promise<Response>): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  if (req.method !== "POST" || !key) return run();
  if (key.length < 8 || key.length > 200) return problem(400, "invalid_idempotency_key");
  const hash = createHash("sha256").update(body).digest("hex");
  const person: Actor = { userId: session.identity.userId, actingTenantId: null };
  const claimed = await withActor(person, async (tx) => {
    const r = await sql<{ inserted: boolean }>`insert into core.idempotency_keys (user_id, key, route, request_hash, status, response)
      values (${person.userId}, ${key}, ${route}, ${hash}, 0, '{}'::jsonb) on conflict (user_id, key) do nothing returning true as inserted`.execute(tx);
    if (r.rows.length) return null;
    return tx.selectFrom("core.idempotency_keys").select(["route", "request_hash", "status", "response"]).where("user_id", "=", person.userId).where("key", "=", key).executeTakeFirstOrThrow();
  });
  if (claimed) {
    if (claimed.route !== route || claimed.request_hash !== hash) return problem(422, "idempotency_key_reuse");
    if (claimed.status === 0) return problem(409, "idempotency_in_progress");
    return Response.json(claimed.response, { status: claimed.status, headers: { "idempotent-replay": "true" } });
  }
  let res: Response;
  try {
    res = await run();
  } catch (e) {
    await withActor(person, (tx) => tx.deleteFrom("core.idempotency_keys").where("user_id", "=", person.userId).where("key", "=", key).execute()).catch(() => undefined);
    throw e;
  }
  const json = await res.clone().json().catch(() => ({}));
  await withActor(person, (tx) => tx.updateTable("core.idempotency_keys").set({ status: res.status, response: JSON.stringify(json) }).where("user_id", "=", person.userId).where("key", "=", key).execute());
  return res;
}

function errorResponse(e: unknown, requestId: string): Response {
  if (e instanceof HttpError) return problem(e.status, e.code);
  if (e instanceof z.ZodError) return problem(422, "invalid_input", e.issues.map((i) => ({ path: i.path.join("."), code: i.code, message: i.message })));
  const pgCode = (e as { code?: string })?.code;
  if (pgCode === "42501") return problem(404, "not_found"); // RLS refused: do not reveal existence
  if (pgCode === "23505") return problem(409, "conflict");
  console.error(`[api ${requestId}]`, e);
  return problem(500, "internal_error", { requestId });
}

type RouteCtx = { params: Promise<Record<string, string | string[]>> };

export function route<S extends ZodType | undefined = undefined>(opts: Opts<S>, fn: (c: HandlerContext<Input<S>>) => Promise<unknown>) {
  return async (req: Request, ctx?: RouteCtx): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    try {
      if (!originAllowed(req)) return problem(403, "bad_origin");
      const raw = await ctx?.params;
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw ?? {})) {
        const s = Array.isArray(v) ? v.join("/") : v;
        if (k.endsWith("Id") || k === "id") {
          if (!UUID.test(s)) return problem(404, "not_found");
        }
        params[k] = s;
      }
      const session = opts.public ? null : await sessionFrom(req.headers);
      if (!opts.public && !session) return problem(401, "unauthenticated");
      if (session && !session.identity.emailVerified) return problem(403, "email_not_verified");

      const text = UNSAFE.has(req.method) && !opts.raw ? await req.text() : "";
      let input: unknown = undefined;
      if (opts.body) input = opts.body.parse(text ? JSON.parse(text) : {});
      else if (opts.query) input = opts.query.parse(Object.fromEntries(new URL(req.url).searchParams));

      const run = async () => {
        const wanted = requestedTenant(req);
        const none: TenantActor = { userId: session?.identity.userId ?? "", actingTenantId: null, requestId, role: null, requireMfa: false };
        let actor: TenantActor = none;
        if (session && opts.tenant === "optional") {
          // person-level calls (choose a workspace, onboarding, accept an invitation) ignore a stale or
          // no-longer-valid workspace choice instead of failing on it
          actor = wanted && UUID.test(wanted) ? await tenantActor(session, wanted, requestId).catch((e) => (e instanceof HttpError && (e.status === 404 || e.code === "mfa_required") ? none : Promise.reject(e))) : none;
        } else if (session) actor = await tenantActor(session, wanted, requestId);
        if (opts.tenant !== "optional" && !opts.public && !actor.actingTenantId) return problem(400, "tenant_required");
        const out = await fn({ req, session: session!, actor, input: input as Input<S>, params, requestId });
        if (out instanceof Response) return out;
        return Response.json(out ?? { ok: true }, { status: opts.status ?? (req.method === "POST" ? 201 : 200), headers: { "cache-control": "no-store", "x-request-id": requestId } });
      };
      return session && !opts.raw ? await idempotent(req, session, new URL(req.url).pathname, text, run) : await run();
    } catch (e) {
      if (e instanceof SyntaxError) return problem(400, "invalid_json");
      return errorResponse(e, requestId);
    }
  };
}
