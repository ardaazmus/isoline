/**
 * Tenancy (G1-03, G1-05..08; ADR-002). Tenants, memberships, invitations, projects, external grants and the
 * provisional-client claim. Normal operations run as the actor under RLS; the few paths that must cross tenants
 * (bootstrap, invitation acceptance, provisional client, claim) use withSystem with an explicit reason.
 */
import { createHash, randomBytes } from "node:crypto";
import { sql } from "kysely";
import { audit, enqueue, verifyChain } from "../audit/audit";
import { seal } from "../crypto/seal";
import { withActor, withSystem, type Actor, type Tx } from "../db/client";
import { forbidden, grantCan, HttpError, memberCan, notFound, type Action, type GrantRole, type MemberRole } from "../policy/policy";

export type TenantKind = "company" | "advisory";
export type Identity = { userId: string; email: string; emailVerified: boolean };

const DAY = 24 * 60 * 60 * 1000;
export const INVITATION_TTL_DAYS = 7;

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("base64url");

function requireVerified(id: Identity) {
  if (!id.emailVerified) throw new HttpError(403, "email_not_verified");
}

// ---------------------------------------------------------------- membership and acting tenant

/** A live membership; `requireMfa` is the tenant's rule, so a page can build its actor from this row alone (G8-07). */
export type Membership = { tenantId: string; tenantName: string; kind: string; lifecycle: string; role: MemberRole; sample: boolean; requireMfa: boolean };

export async function myMemberships(userId: string): Promise<Membership[]> {
  return withActor({ userId, actingTenantId: null }, async (tx) => (await membershipsQuery(tx, userId).execute()).map(toMembership));
}

/** A person's live memberships by workspace name (myMemberships, and personContext for the platform pages). */
export function membershipsQuery(tx: Tx, userId: string) {
  return tx
    .selectFrom("core.memberships as m")
    .innerJoin("core.tenants as t", "t.id", "m.tenant_id")
    .select(["m.tenant_id", "t.name", "t.kind", "t.lifecycle", "m.role", "t.sample", "t.require_mfa"])
    .where("m.user_id", "=", userId)
    .where("m.revoked_at", "is", null)
    .orderBy("t.name");
}

export const toMembership = (r: { tenant_id: string; name: string; kind: string; lifecycle: string; role: string; sample: boolean; require_mfa: boolean }): Membership => ({ tenantId: r.tenant_id, tenantName: r.name, kind: r.kind, lifecycle: r.lifecycle, role: r.role as MemberRole, sample: r.sample, requireMfa: r.require_mfa });

/** Turns a requested tenant into a verified actor; the client's tenant id is never trusted on its own. */
export async function actorFor(userId: string, requestedTenantId: string | null, requestId?: string): Promise<Actor & { role: MemberRole | null }> {
  if (!requestedTenantId) return { userId, actingTenantId: null, requestId, role: null };
  const m = (await myMemberships(userId)).find((x) => x.tenantId === requestedTenantId);
  if (!m) throw notFound("tenant_not_found");
  return { userId, actingTenantId: m.tenantId, requestId, role: m.role };
}

async function roleIn(tx: Tx, actor: Actor): Promise<MemberRole | null> {
  if (!actor.actingTenantId) return null;
  const r = await tx
    .selectFrom("core.memberships")
    .select("role")
    .where("tenant_id", "=", actor.actingTenantId)
    .where("user_id", "=", actor.userId)
    .where("revoked_at", "is", null)
    .executeTakeFirst();
  return (r?.role as MemberRole) ?? null;
}

/** Throws unless the actor's role in the acting tenant allows the action. */
export async function requireMemberAction(tx: Tx, actor: Actor, action: Action): Promise<MemberRole> {
  const role = await roleIn(tx, actor);
  if (!role || !memberCan(role, action)) throw forbidden();
  return role;
}

/**
 * Access to a project: as a member of its owner tenant (role check), as steward of a provisional client, or
 * through an active grant held by the acting tenant (grant role check). RLS has already hidden other projects.
 */
export type ProjectAccess = { ownerTenantId: string; via: "member" | "steward" | "grant"; grantRole?: GrantRole; canDownload?: boolean };

export async function requireProjectAction(tx: Tx, actor: Actor, projectId: string, action: Action): Promise<ProjectAccess> {
  // the project and the person's role in the acting tenant (every path below checks it) in one round trip
  const p = await tx.selectFrom("core.projects").select(["id", "owner_tenant_id", roleInActingTenant(actor)]).where("id", "=", projectId).executeTakeFirst();
  return projectAccess(tx, actor, p, action);
}

/** The actor's live role in the acting tenant as a column of any query (null without an acting tenant). */
export function roleInActingTenant(actor: Actor) {
  return (actor.actingTenantId ? sql<string | null>`(select role from core.memberships where tenant_id = ${actor.actingTenantId} and user_id = ${actor.userId} and revoked_at is null)` : sql<string | null>`null`).as("role");
}

/**
 * requireProjectAction's rules for a project row a caller has already read, with roleInActingTenant beside it (a
 * page's own first statement can carry the check). No row — RLS hid the project — is a 404.
 */
export async function projectAccess(tx: Tx, actor: Actor, p: { id: string; owner_tenant_id: string; role: string | null } | undefined, action: Action): Promise<ProjectAccess> {
  if (!p) throw notFound("project_not_found");
  const role = (p.role as MemberRole | null) ?? null;
  const member = () => {
    if (!role || !memberCan(role, action)) throw forbidden();
  };
  if (p.owner_tenant_id === actor.actingTenantId) {
    member();
    return { ownerTenantId: p.owner_tenant_id, via: "member" };
  }
  const steward = await tx
    .selectFrom("core.tenants")
    .select("id")
    .where("id", "=", p.owner_tenant_id)
    .where("lifecycle", "=", "provisional")
    .where("steward_tenant_id", "=", actor.actingTenantId)
    .executeTakeFirst();
  if (steward) {
    member();
    return { ownerTenantId: p.owner_tenant_id, via: "steward" };
  }
  const g = await tx
    .selectFrom("core.external_grants")
    .select(["role", "can_download"])
    .where("project_id", "=", p.id)
    .where("recipient_tenant_id", "=", actor.actingTenantId)
    .where("revoked_at", "is", null)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();
  if (!g) throw notFound("project_not_found");
  // the person must also be allowed the action inside their own (recipient) tenant
  if (!role || !memberCan(role, action === "evidence.download" ? "evidence.download" : action) || !grantCan(g.role as GrantRole, action, g.can_download)) throw forbidden();
  return { ownerTenantId: p.owner_tenant_id, via: "grant", grantRole: g.role as GrantRole, canDownload: g.can_download };
}

/**
 * The projects the acting workspace can reach — its own, those of the provisional clients it stewards, and those
 * granted to it — found through indexes. A superset of what RLS lets through: lists across projects filter with it
 * first (plain equalities, which PostgreSQL evaluates before the policy functions), so RLS checks only these rows
 * instead of every project and tenant in the database (G8-07 load test: cost grew with other customers' data).
 */
export async function reachableProjectIds(tx: Tx, actor: Actor): Promise<string[]> {
  if (!actor.actingTenantId) return [];
  const stewarded = tx.selectFrom("core.tenants").select("id").where("steward_tenant_id", "=", actor.actingTenantId).where("lifecycle", "=", "provisional");
  // the database clock, as the policy (grant_role) uses it: a grant RLS still honours is never left out
  const granted = tx.selectFrom("core.external_grants").select("project_id as id").where("recipient_tenant_id", "=", actor.actingTenantId).where("revoked_at", "is", null).where("expires_at", ">", sql<Date>`now()`);
  const rows = await tx
    .selectFrom("core.projects")
    .select("id")
    .where("owner_tenant_id", "=", actor.actingTenantId)
    .union(tx.selectFrom("core.projects").select("id").where("owner_tenant_id", "in", stewarded))
    .union(granted)
    .execute();
  return rows.map((r) => r.id);
}

/**
 * requireProjectAction for many projects and actions at once (same rules): for each action, the ids of the projects
 * where the actor may perform it. At most four queries in all — the steward and grant lookups only for projects the
 * workspace does not own — instead of up to four per project and action.
 */
export async function projectsAllowing<A extends Action>(tx: Tx, actor: Actor, projectIds: string[], actions: A[]): Promise<Record<A, Set<string>>> {
  const out = Object.fromEntries(actions.map((a) => [a, new Set<string>()])) as Record<A, Set<string>>;
  const ids = [...new Set(projectIds)];
  if (!ids.length || !actor.actingTenantId) return out;
  const role = await roleIn(tx, actor);
  if (!role) return out;
  const projects = await tx.selectFrom("core.projects").select(["id", "owner_tenant_id"]).where("id", "in", ids).execute();
  const foreign = projects.filter((p) => p.owner_tenant_id !== actor.actingTenantId);
  const stewarded = new Set<string>();
  if (foreign.length) {
    const owners = [...new Set(foreign.map((p) => p.owner_tenant_id))];
    for (const t of await tx.selectFrom("core.tenants").select("id").where("id", "in", owners).where("lifecycle", "=", "provisional").where("steward_tenant_id", "=", actor.actingTenantId).execute()) stewarded.add(t.id);
  }
  const viaGrant = foreign.filter((p) => !stewarded.has(p.owner_tenant_id)).map((p) => p.id);
  const grants = viaGrant.length
    ? await tx
        .selectFrom("core.external_grants")
        .select(["project_id", "role", "can_download"])
        .where("project_id", "in", viaGrant)
        .where("recipient_tenant_id", "=", actor.actingTenantId)
        .where("revoked_at", "is", null)
        .where("expires_at", ">", new Date())
        .execute()
    : [];
  for (const p of projects)
    for (const action of actions) {
      if (!memberCan(role, action)) continue;
      if (p.owner_tenant_id === actor.actingTenantId || stewarded.has(p.owner_tenant_id)) out[action].add(p.id);
      else {
        const g = grants.find((x) => x.project_id === p.id);
        if (g && grantCan(g.role as GrantRole, action, g.can_download)) out[action].add(p.id);
      }
    }
  return out;
}

// ---------------------------------------------------------------- onboarding (paths A and B)

export async function createTenant(id: Identity, input: { name: string; kind: TenantKind; termsVersion: string }): Promise<string> {
  requireVerified(id);
  const name = input.name.trim();
  if (!name || name.length > 200) throw new HttpError(422, "invalid_name");
  return withSystem("onboarding: first tenant and owner membership", async (tx) => {
    const t = await tx
      .insertInto("core.tenants")
      .values({ name, kind: input.kind, lifecycle: "active", created_by: id.userId, terms_version: input.termsVersion })
      .returning("id")
      .executeTakeFirstOrThrow();
    await tx.insertInto("core.memberships").values({ tenant_id: t.id, user_id: id.userId, role: "owner" }).execute();
    await audit(tx, { userId: id.userId, actingTenantId: t.id }, { action: "tenant.create", objectType: "tenant", objectId: t.id, ownerTenantId: t.id, after: { name, kind: input.kind }, payload: { terms: input.termsVersion } });
    return t.id;
  });
}

// ---------------------------------------------------------------- invitations (G1-06)

export async function inviteMember(actor: Actor, input: { email: string; role: MemberRole }): Promise<{ invitationId: string; token: string }> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, "invalid_email");
  if (input.role === "owner") throw new HttpError(422, "owner_not_invitable");
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    const token = newToken();
    const row = await tx
      .insertInto("core.invitations")
      .values({ tenant_id: actor.actingTenantId!, email, role: input.role, kind: "member", token_hash: tokenHash(token), invited_by: actor.userId, expires_at: new Date(Date.now() + INVITATION_TTL_DAYS * DAY) })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "invitation.create", objectType: "invitation", objectId: row.id, ownerTenantId: actor.actingTenantId, after: { email, role: input.role } });
    await enqueue(tx, "mail.invitation", { invitationId: row.id, email, sealedToken: seal(token, `invitation:${row.id}`) }, { ownerTenantId: actor.actingTenantId, dedupeKey: `invitation:${row.id}` });
    return { invitationId: row.id, token };
  });
}

export async function revokeInvitation(actor: Actor, invitationId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    const r = await tx.updateTable("core.invitations").set({ revoked_at: new Date() }).where("id", "=", invitationId).where("accepted_at", "is", null).where("revoked_at", "is", null).returning("id").executeTakeFirst();
    if (!r) throw notFound();
    await audit(tx, actor, { action: "invitation.revoke", objectType: "invitation", objectId: invitationId, ownerTenantId: actor.actingTenantId });
  });
}

export type InvitationView = { tenantName: string; tenantKind: string; role: string; kind: string; email: string; state: "valid" | "expired" | "used" | "revoked" };

/** What the invite screen shows before acceptance; reveals nothing for an unknown token. */
export async function peekInvitation(token: string): Promise<InvitationView | null> {
  return withSystem("invite screen: read one invitation by token hash", async (tx) => {
    const r = await tx
      .selectFrom("core.invitations as i")
      .innerJoin("core.tenants as t", "t.id", "i.tenant_id")
      .select(["t.name", "t.kind as tkind", "i.role", "i.kind", "i.email", "i.expires_at", "i.accepted_at", "i.revoked_at"])
      .where("i.token_hash", "=", tokenHash(token))
      .executeTakeFirst();
    if (!r) return null;
    const state = r.revoked_at ? "revoked" : r.accepted_at ? "used" : r.expires_at <= new Date() ? "expired" : "valid";
    return { tenantName: r.name, tenantKind: r.tkind, role: r.role, kind: r.kind, email: String(r.email), state };
  });
}

/**
 * Accepts an invitation: single use, unexpired, unrevoked, and only by the verified account it was sent to.
 * A "claim" invitation also hands a provisional client to its real owner (G1-08).
 */
export async function acceptInvitation(id: Identity, token: string): Promise<{ tenantId: string }> {
  requireVerified(id);
  return withSystem("invitation acceptance by the verified invitee", async (tx) => {
    const inv = await tx.selectFrom("core.invitations").selectAll().where("token_hash", "=", tokenHash(token)).forUpdate().executeTakeFirst();
    if (!inv || inv.revoked_at) throw new HttpError(410, "invitation_invalid");
    if (inv.accepted_at) throw new HttpError(410, "invitation_used");
    if (inv.expires_at <= new Date()) throw new HttpError(410, "invitation_expired");
    if (String(inv.email).toLowerCase() !== id.email.toLowerCase()) throw new HttpError(403, "invitation_other_email");

    const actor: Actor = { userId: id.userId, actingTenantId: inv.tenant_id };
    const existing = await tx.selectFrom("core.memberships").select("id").where("tenant_id", "=", inv.tenant_id).where("user_id", "=", id.userId).where("revoked_at", "is", null).executeTakeFirst();
    if (!existing) await tx.insertInto("core.memberships").values({ tenant_id: inv.tenant_id, user_id: id.userId, role: inv.role, invited_by: inv.invited_by }).execute();
    await tx.updateTable("core.invitations").set({ accepted_at: new Date(), accepted_by: id.userId }).where("id", "=", inv.id).execute();
    await audit(tx, actor, { action: "invitation.accept", objectType: "invitation", objectId: inv.id, ownerTenantId: inv.tenant_id, after: { role: inv.role } });
    if (inv.kind === "claim") await claimTenant(tx, actor, inv.tenant_id);
    return { tenantId: inv.tenant_id };
  });
}

// ---------------------------------------------------------------- members (G1-12)

export async function listMembers(actor: Actor) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "project.read");
    return tx
      .selectFrom("core.memberships as m")
      .innerJoin("user as u", "u.id", "m.user_id")
      .select(["m.id", "u.name", "u.email", "m.role", "m.accepted_at", "u.twoFactorEnabled"])
      .where("m.tenant_id", "=", actor.actingTenantId!)
      .where("m.revoked_at", "is", null)
      .orderBy("u.name")
      .execute();
  });
}

/** Ends a membership; its API access ends on the next request (sessions stay, membership checks fail). */
export async function revokeMembership(actor: Actor, membershipId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    const m = await tx.selectFrom("core.memberships").select(["id", "user_id", "role"]).where("id", "=", membershipId).where("tenant_id", "=", actor.actingTenantId!).where("revoked_at", "is", null).executeTakeFirst();
    if (!m) throw notFound();
    if (m.role === "owner") {
      const owners = await tx.selectFrom("core.memberships").select(sql<number>`count(*)`.as("n")).where("tenant_id", "=", actor.actingTenantId!).where("role", "=", "owner").where("revoked_at", "is", null).executeTakeFirstOrThrow();
      if (Number(owners.n) <= 1) throw new HttpError(409, "last_owner");
    }
    await tx.updateTable("core.memberships").set({ revoked_at: new Date(), revoked_by: actor.userId }).where("id", "=", membershipId).execute();
    await audit(tx, actor, { action: "membership.revoke", objectType: "membership", objectId: membershipId, ownerTenantId: actor.actingTenantId, before: { userId: m.user_id, role: m.role } });
  });
}

// ---------------------------------------------------------------- projects (minimal in G1; extended in G2)

export async function createProject(actor: Actor, input: { name: string; ownerTenantId?: string }): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new HttpError(422, "invalid_name");
  return withActor(actor, async (tx) => {
    const owner = input.ownerTenantId ?? actor.actingTenantId!;
    await requireMemberAction(tx, actor, "project.create");
    if (owner !== actor.actingTenantId) {
      // only a steward may open projects in a provisional client
      const s = await tx.selectFrom("core.tenants").select("id").where("id", "=", owner).where("lifecycle", "=", "provisional").where("steward_tenant_id", "=", actor.actingTenantId).executeTakeFirst();
      if (!s) throw notFound("tenant_not_found");
    }
    const p = await tx.insertInto("core.projects").values({ owner_tenant_id: owner, name, created_by: actor.userId }).returning("id").executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "project.create", objectType: "project", objectId: p.id, ownerTenantId: owner, projectId: p.id, after: { name } });
    return p.id;
  });
}

export async function listProjects(actor: Actor) {
  return withActor(actor, async (tx) => {
    // RLS decides as before, but only over the projects this workspace can reach: without the filter it evaluated its
    // policy functions on every project and tenant in the database (Today page, G8-07 load test: ~60 ms per call)
    const reachable = await reachableProjectIds(tx, actor);
    if (!reachable.length) return [];
    return tx
      .selectFrom("core.projects as p")
      .innerJoin("core.tenants as t", "t.id", "p.owner_tenant_id")
      .select(["p.id", "p.name", "p.status", "p.owner_tenant_id", "t.name as owner_name", "t.lifecycle as owner_lifecycle", "p.updated_at"])
      .where("p.id", "in", reachable)
      .orderBy("p.updated_at", "desc")
      .execute();
  });
}

// ---------------------------------------------------------------- external grants (G1-07)

export type GrantInput = { projectId: string; recipientTenantId: string; role: GrantRole; purpose: string; days: number; scope?: Record<string, unknown>; dataClasses?: string[]; canDownload?: boolean; termsVersion: string };

export async function grantProjectAccess(actor: Actor, g: GrantInput): Promise<string> {
  if (!g.purpose.trim()) throw new HttpError(422, "purpose_required");
  if (!(g.days >= 1 && g.days <= 365)) throw new HttpError(422, "invalid_duration");
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "grant.manage");
    const p = await tx.selectFrom("core.projects").select(["id", "owner_tenant_id"]).where("id", "=", g.projectId).executeTakeFirst();
    if (!p || p.owner_tenant_id !== actor.actingTenantId) throw notFound("project_not_found");
    const rec = await tx.selectFrom("core.tenants").select("id").where("id", "=", g.recipientTenantId).executeTakeFirst();
    // the recipient is usually not visible yet under RLS; a direct id lookup through the system role confirms it exists
    const recipientExists = rec ?? (await withSystem("grant: confirm recipient tenant exists", (s) => s.selectFrom("core.tenants").select("id").where("id", "=", g.recipientTenantId).where("lifecycle", "=", "active").executeTakeFirst()));
    if (!recipientExists || g.recipientTenantId === actor.actingTenantId) throw new HttpError(422, "invalid_recipient");
    const row = await tx
      .insertInto("core.external_grants")
      .values({
        owner_tenant_id: actor.actingTenantId!,
        recipient_tenant_id: g.recipientTenantId,
        project_id: g.projectId,
        role: g.role,
        scope: JSON.stringify(g.scope ?? {}),
        data_classes: g.dataClasses ?? [],
        purpose: g.purpose.trim(),
        can_download: g.canDownload ?? false,
        expires_at: new Date(Date.now() + g.days * DAY),
        granted_by: actor.userId,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    await tx.insertInto("core.consent_records").values({ owner_tenant_id: actor.actingTenantId!, grant_id: row.id, given_by: actor.userId, purpose: g.purpose.trim(), scope: JSON.stringify(g.scope ?? {}), data_classes: g.dataClasses ?? [], terms_version: g.termsVersion }).execute();
    await audit(tx, actor, { action: "grant.create", objectType: "external_grant", objectId: row.id, ownerTenantId: actor.actingTenantId, projectId: g.projectId, after: { recipient: g.recipientTenantId, role: g.role, days: g.days, canDownload: g.canDownload ?? false } });
    await enqueue(tx, "mail.grant", { grantId: row.id, recipientTenantId: g.recipientTenantId }, { ownerTenantId: actor.actingTenantId, dedupeKey: `grant:${row.id}` });
    return row.id;
  });
}

export async function revokeGrant(actor: Actor, grantId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "grant.manage");
    const r = await tx.updateTable("core.external_grants").set({ revoked_at: new Date(), revoked_by: actor.userId }).where("id", "=", grantId).where("owner_tenant_id", "=", actor.actingTenantId!).where("revoked_at", "is", null).returning(["id", "project_id"]).executeTakeFirst();
    if (!r) throw notFound();
    await audit(tx, actor, { action: "grant.revoke", objectType: "external_grant", objectId: grantId, ownerTenantId: actor.actingTenantId, projectId: r.project_id });
  });
}

export async function listGrants(actor: Actor) {
  return withActor(actor, async (tx) =>
    tx
      .selectFrom("core.external_grants as g")
      .innerJoin("core.projects as p", "p.id", "g.project_id")
      .select(["g.id", "g.owner_tenant_id", "g.recipient_tenant_id", "g.project_id", "p.name as project_name", "g.role", "g.purpose", "g.expires_at", "g.revoked_at", "g.can_download", "g.created_at"])
      .orderBy("g.created_at", "desc")
      .execute(),
  );
}

// ---------------------------------------------------------------- provisional client (path D) and claim (G1-08)

export async function createProvisionalClient(actor: Actor, input: { name: string; contactEmail: string }): Promise<{ tenantId: string; invitationToken: string }> {
  const name = input.name.trim();
  const email = input.contactEmail.trim().toLowerCase();
  if (!name) throw new HttpError(422, "invalid_name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(422, "invalid_email");
  // permission check runs under RLS as the actor before the privileged write
  await withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "client.create");
    const k = await tx.selectFrom("core.tenants").select("kind").where("id", "=", actor.actingTenantId!).executeTakeFirst();
    if (k?.kind !== "advisory") throw forbidden("advisory_only");
  });
  return withSystem("advisory opens a provisional client (path D)", async (tx) => {
    const t = await tx.insertInto("core.tenants").values({ name, kind: "company", lifecycle: "provisional", created_by: actor.userId, steward_tenant_id: actor.actingTenantId }).returning("id").executeTakeFirstOrThrow();
    const token = newToken();
    const inv = await tx
      .insertInto("core.invitations")
      .values({ tenant_id: t.id, email, role: "owner", kind: "claim", token_hash: tokenHash(token), invited_by: actor.userId, expires_at: new Date(Date.now() + 30 * DAY) })
      .returning("id")
      .executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "client.provisional_create", objectType: "tenant", objectId: t.id, ownerTenantId: t.id, after: { name, steward: actor.actingTenantId, contact: email } });
    await enqueue(tx, "mail.claim", { invitationId: inv.id, email, sealedToken: seal(token, `invitation:${inv.id}`) }, { ownerTenantId: t.id, dedupeKey: `invitation:${inv.id}` });
    return { tenantId: t.id, invitationToken: token };
  });
}

/**
 * The customer's representative takes ownership: the tenant becomes active and the steward's access continues
 * only through explicit, expiring grants on the projects it prepared (90 days, revocable by the new owner).
 */
async function claimTenant(tx: Tx, actor: Actor, tenantId: string): Promise<void> {
  const t = await tx.selectFrom("core.tenants").selectAll().where("id", "=", tenantId).forUpdate().executeTakeFirstOrThrow();
  if (t.lifecycle !== "provisional" || !t.steward_tenant_id) return;
  await tx.updateTable("core.tenants").set({ lifecycle: "active", claimed_at: new Date(), claimed_by: actor.userId }).where("id", "=", tenantId).execute();
  const projects = await tx.selectFrom("core.projects").select("id").where("owner_tenant_id", "=", tenantId).execute();
  for (const p of projects) {
    const g = await tx
      .insertInto("core.external_grants")
      .values({ owner_tenant_id: tenantId, recipient_tenant_id: t.steward_tenant_id, project_id: p.id, role: "preparer", purpose: "Geçici dönemde hazırlanan projenin devamı", expires_at: new Date(Date.now() + 90 * DAY), granted_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    await tx.insertInto("core.consent_records").values({ owner_tenant_id: tenantId, grant_id: g.id, given_by: actor.userId, purpose: "Geçici dönemde hazırlanan projenin devamı", scope: JSON.stringify({}), data_classes: [], terms_version: "claim-v1" }).execute();
  }
  await audit(tx, actor, { action: "tenant.claim", objectType: "tenant", objectId: tenantId, ownerTenantId: tenantId, before: { lifecycle: "provisional", steward: t.steward_tenant_id }, after: { lifecycle: "active", continuationGrants: projects.length } });
}

/** A provisional client cannot publish (plan 03 Yol D): callers of release paths check this. */
export async function isProvisional(tx: Tx, tenantId: string): Promise<boolean> {
  const t = await tx.selectFrom("core.tenants").select("lifecycle").where("id", "=", tenantId).executeTakeFirst();
  return t?.lifecycle === "provisional";
}

// ---------------------------------------------------------------- tenant settings and audit (G1-10, G1-12)

export async function tenantProfile(actor: Actor) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "project.read");
    return tx.selectFrom("core.tenants").select(["id", "name", "kind", "lifecycle", "require_mfa", "steward_tenant_id", "claimed_at", "row_version"]).where("id", "=", actor.actingTenantId!).executeTakeFirstOrThrow();
  });
}

/** Name and security policy; optimistic concurrency through row_version (If-Match). */
export async function updateTenantSettings(actor: Actor, input: { name?: string; requireMfa?: boolean }, expectedVersion?: number): Promise<number> {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    const cur = await tx.selectFrom("core.tenants").select(["name", "require_mfa", "row_version"]).where("id", "=", actor.actingTenantId!).forUpdate().executeTakeFirstOrThrow();
    if (expectedVersion !== undefined && Number(cur.row_version) !== expectedVersion) throw new HttpError(409, "version_conflict");
    const name = input.name?.trim();
    if (name !== undefined && (!name || name.length > 200)) throw new HttpError(422, "invalid_name");
    const r = await tx
      .updateTable("core.tenants")
      .set({ ...(name !== undefined ? { name } : {}), ...(input.requireMfa !== undefined ? { require_mfa: input.requireMfa } : {}) })
      .where("id", "=", actor.actingTenantId!)
      .returning("row_version")
      .executeTakeFirstOrThrow();
    await audit(tx, actor, { action: "tenant.settings", objectType: "tenant", objectId: actor.actingTenantId!, ownerTenantId: actor.actingTenantId, before: { name: cur.name, requireMfa: cur.require_mfa }, after: { name: name ?? cur.name, requireMfa: input.requireMfa ?? cur.require_mfa } });
    return Number(r.row_version);
  });
}

export async function listAudit(actor: Actor, opts: { limit?: number; beforeId?: number; projectId?: string } = {}) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "audit.read");
    let q = tx
      .selectFrom("core.audit_events as a")
      .leftJoin("user as u", "u.id", "a.actor_user_id")
      .select(["a.id", "a.action", "a.object_type", "a.object_id", "a.project_id", "a.acting_tenant_id", "a.occurred_at", "a.hash", "a.payload", "u.name as actor_name", "u.email as actor_email"])
      .where("a.owner_tenant_id", "=", actor.actingTenantId!)
      .orderBy("a.id", "desc")
      .limit(Math.min(Math.max(opts.limit ?? 50, 1), 200));
    if (opts.beforeId) q = q.where("a.id", "<", opts.beforeId);
    if (opts.projectId) q = q.where("a.project_id", "=", opts.projectId);
    return q.execute();
  });
}

export async function auditChainStatus(actor: Actor) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "audit.read");
    return verifyChain(tx, actor.actingTenantId!);
  });
}

// ---------------------------------------------------------------- screens: pending invitations, stewarded clients, project access

export async function listInvitations(actor: Actor) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    return tx
      .selectFrom("core.invitations")
      .select(["id", "email", "role", "kind", "expires_at", "created_at"])
      .where("tenant_id", "=", actor.actingTenantId!)
      .where("accepted_at", "is", null)
      .where("revoked_at", "is", null)
      .orderBy("created_at", "desc")
      .execute();
  });
}

/** Provisional clients this advisory workspace prepares (path D), with whether the claim is still pending. */
export async function listStewardedClients(actor: Actor) {
  return withActor(actor, async (tx) =>
    tx
      .selectFrom("core.tenants")
      .select(["id", "name", "lifecycle", "created_at"])
      .where("steward_tenant_id", "=", actor.actingTenantId!)
      .where("lifecycle", "=", "provisional")
      .orderBy("name")
      .execute(),
  );
}

/** One project with the way the actor reaches it (member, steward or grant) — the context bar names the owner. */
type GrantRow = { id: string; recipient_tenant_id: string; role: string; purpose: string; expires_at: string; revoked_at: string | null; can_download: boolean };

export async function projectOverview(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    // the project, the person's role for the access rules (projectAccess, as requireProjectAction) and the project's
    // grants, newest first, in one statement: every project page starts here (G8-07 load test)
    const r = await tx
      .selectFrom("core.projects as p")
      .innerJoin("core.tenants as t", "t.id", "p.owner_tenant_id")
      .select([
        "p.id",
        "p.name",
        "p.status",
        "p.created_at",
        "p.updated_at",
        "p.row_version",
        "p.organization_id",
        "p.engagement_id",
        "p.description",
        "t.name as owner_name",
        "t.lifecycle as owner_lifecycle",
        "t.id as owner_id",
        roleInActingTenant(actor),
        sql<GrantRow[]>`(select coalesce(json_agg(g order by g.created_at desc), '[]'::json) from (select id, recipient_tenant_id, role, purpose, expires_at, revoked_at, can_download, created_at from core.external_grants where project_id = p.id) g)`.as("grants"),
      ])
      .where("p.id", "=", projectId)
      .executeTakeFirst();
    const access = await projectAccess(tx, actor, r && { id: r.id, owner_tenant_id: r.owner_id, role: r.role }, "project.read");
    const p = r!;
    const project = { id: p.id, name: p.name, status: p.status, created_at: p.created_at, updated_at: p.updated_at, row_version: p.row_version, organization_id: p.organization_id, engagement_id: p.engagement_id, description: p.description, owner_name: p.owner_name, owner_lifecycle: p.owner_lifecycle, owner_id: p.owner_id };
    // the sharing list is for the owner's own people
    const grants = access.via === "member" ? p.grants.map((g) => ({ id: g.id, recipient_tenant_id: g.recipient_tenant_id, role: g.role, purpose: g.purpose, expires_at: new Date(g.expires_at), revoked_at: g.revoked_at === null ? null : new Date(g.revoked_at), can_download: g.can_download })) : [];
    return { project, access, grants };
  });
}

/** Names of tenants this workspace has a relationship with (grant counterparties); ids alone mean nothing to people. */
export async function counterpartNames(actor: Actor, ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  // a counterparty of an existing grant may be invisible under RLS (e.g. the recipient for the granting tenant);
  // the system path returns names only for tenants that actually share a grant with the acting tenant
  return withSystem("screens: names of grant counterparties", async (tx) => {
    const rows = await tx
      .selectFrom("core.tenants as t")
      .select(["t.id", "t.name"])
      .where("t.id", "in", unique)
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom("core.external_grants as g")
            .select("g.id")
            .where((w) => w.or([w.and([w("g.owner_tenant_id", "=", actor.actingTenantId!), w("g.recipient_tenant_id", "=", w.ref("t.id"))]), w.and([w("g.recipient_tenant_id", "=", actor.actingTenantId!), w("g.owner_tenant_id", "=", w.ref("t.id"))])])),
        ),
      )
      .execute();
    return Object.fromEntries(rows.map((r) => [r.id, r.name]));
  });
}
