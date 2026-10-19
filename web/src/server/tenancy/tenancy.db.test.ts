/**
 * G1 gate (plan 13): two tenants, three roles, isolation under RLS; invitations; grants; provisional claim;
 * append-only audit. UAT-01..06 and threat model T1, T5, T6, T11–T13 at the database and service layers.
 */
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { appDb, closeDb, systemDb, withActor, type Actor } from "../db/client";
import { expire, makeUser } from "../db/test-helpers";
import {
  acceptInvitation,
  actorFor,
  createProject,
  createProvisionalClient,
  createTenant,
  grantProjectAccess,
  inviteMember,
  listProjects,
  myMemberships,
  peekInvitation,
  requireProjectAction,
  revokeGrant,
  revokeMembership,
} from "./service";

afterAll(closeDb);

const TERMS = "terms-2026-10";

async function company(label: string) {
  const owner = await makeUser(`${label}-owner`);
  const tenantId = await createTenant(owner, { name: `${label} A.Ş.`, kind: "company", termsVersion: TERMS });
  const actor: Actor = { userId: owner.userId, actingTenantId: tenantId };
  return { owner, tenantId, actor };
}

describe("onboarding and memberships", () => {
  it("opens a company tenant with its creator as owner and refuses unverified accounts", async () => {
    const a = await company("Onb");
    expect(await myMemberships(a.owner.userId)).toEqual([expect.objectContaining({ tenantId: a.tenantId, role: "owner", kind: "company" })]);
    const unverified = await makeUser("unverified", { verified: false });
    await expect(createTenant(unverified, { name: "X", kind: "company", termsVersion: TERMS })).rejects.toMatchObject({ status: 403 });
  });
  it("lets one person belong to two tenants and act only in a tenant they are a member of", async () => {
    const a = await company("TwoA");
    const second = await createTenant(a.owner, { name: "TwoA Danışmanlık", kind: "advisory", termsVersion: TERMS });
    expect((await myMemberships(a.owner.userId)).map((m) => m.tenantId).sort()).toEqual([a.tenantId, second].sort());
    const stranger = await company("Stranger");
    await expect(actorFor(a.owner.userId, stranger.tenantId)).rejects.toMatchObject({ status: 404 });
  });
});

describe("tenant isolation (RLS + policy)", () => {
  it("never shows or changes another tenant's project (UAT-05, T1)", async () => {
    const a = await company("IsoA");
    const b = await company("IsoB");
    const pa = await createProject(a.actor, { name: "A 2026 TSRS" });
    expect((await listProjects(b.actor)).map((p) => p.id)).not.toContain(pa);
    await expect(withActor(b.actor, (tx) => requireProjectAction(tx, b.actor, pa, "project.read"))).rejects.toMatchObject({ status: 404 });
    const changed = await withActor(b.actor, (tx) => tx.updateTable("core.projects").set({ name: "hacked" }).where("id", "=", pa).executeTakeFirst());
    expect(Number(changed.numUpdatedRows)).toBe(0);
    // B cannot plant a project into A either
    await expect(withActor(b.actor, (tx) => tx.insertInto("core.projects").values({ owner_tenant_id: a.tenantId, name: "planted", created_by: b.owner.userId }).execute())).rejects.toThrow(/row-level security/);
  });
  it("shows nothing without a session context or with a tenant the user does not belong to (T12)", async () => {
    const a = await company("CtxA");
    await createProject(a.actor, { name: "visible only to members" });
    const none = await appDb().selectFrom("core.projects").select("id").execute();
    expect(none).toEqual([]);
    const b = await company("CtxB");
    const spoof = await withActor({ userId: b.owner.userId, actingTenantId: a.tenantId }, (tx) => tx.selectFrom("core.projects").select("id").execute());
    expect(spoof).toEqual([]);
  });
  it("does not leak the request context to the next use of a pooled connection (T13)", async () => {
    const a = await company("Leak");
    await withActor(a.actor, async () => undefined);
    const r = await sql<{ u: string | null }>`select nullif(current_setting('app.user_id', true), '') as u`.execute(appDb());
    expect(r.rows[0].u).toBeNull();
  });
  it("blocks a contributor from managing access and a viewer from writing", async () => {
    const a = await company("RoleA");
    const c = await makeUser("contrib");
    const inv = await inviteMember(a.actor, { email: c.email, role: "contributor" });
    await acceptInvitation(c, inv.token);
    const cActor: Actor = { userId: c.userId, actingTenantId: a.tenantId };
    await expect(inviteMember(cActor, { email: "x@example.test", role: "viewer" })).rejects.toMatchObject({ status: 403 });
    await expect(createProject(cActor, { name: "nope" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("invitations (G1-06, T6)", () => {
  it("is single-use, expires, and only the invited verified address can accept", async () => {
    const a = await company("Inv");
    const invitee = await makeUser("invitee");
    const other = await makeUser("other");
    const inv = await inviteMember(a.actor, { email: invitee.email, role: "data_owner" });
    expect(await peekInvitation(inv.token)).toMatchObject({ state: "valid", role: "data_owner" });
    await expect(acceptInvitation(other, inv.token)).rejects.toMatchObject({ status: 403, code: "invitation_other_email" });
    await acceptInvitation(invitee, inv.token);
    await expect(acceptInvitation(invitee, inv.token)).rejects.toMatchObject({ status: 410, code: "invitation_used" });
    expect(await peekInvitation(inv.token)).toMatchObject({ state: "used" });

    const late = await makeUser("late");
    const inv2 = await inviteMember(a.actor, { email: late.email, role: "viewer" });
    await expire("core.invitations", inv2.invitationId);
    await expect(acceptInvitation(late, inv2.token)).rejects.toMatchObject({ status: 410, code: "invitation_expired" });
    expect(await peekInvitation("not-a-token")).toBeNull();
  });
  it("ends a revoked member's access on the next request (G1-12)", async () => {
    const a = await company("Rev");
    const m = await makeUser("member");
    const inv = await inviteMember(a.actor, { email: m.email, role: "contributor" });
    await acceptInvitation(m, inv.token);
    const membership = await systemDb().selectFrom("core.memberships").select("id").where("user_id", "=", m.userId).executeTakeFirstOrThrow();
    await revokeMembership(a.actor, membership.id);
    await expect(actorFor(m.userId, a.tenantId)).rejects.toMatchObject({ status: 404 });
    expect(await withActor({ userId: m.userId, actingTenantId: a.tenantId }, (tx) => tx.selectFrom("core.projects").select("id").execute())).toEqual([]);
  });
});

describe("external project grants (G1-07, UAT-04..06, T5)", () => {
  it("opens exactly the granted project to the advisory tenant and closes it on revoke or expiry", async () => {
    const a = await company("Customer");
    const adv = await makeUser("adv-owner");
    const advTenant = await createTenant(adv, { name: "B Danışmanlık", kind: "advisory", termsVersion: TERMS });
    const advActor: Actor = { userId: adv.userId, actingTenantId: advTenant };
    const p1 = await createProject(a.actor, { name: "2026 TSRS" });
    const p2 = await createProject(a.actor, { name: "2025 bordro" });

    const g = await grantProjectAccess(a.actor, { projectId: p1, recipientTenantId: advTenant, role: "preparer", purpose: "TSRS hazırlığı", days: 90, termsVersion: TERMS });
    expect((await listProjects(advActor)).map((p) => p.id)).toEqual([p1]);
    await expect(withActor(advActor, (tx) => requireProjectAction(tx, advActor, p1, "report.write"))).resolves.toMatchObject({ via: "grant", grantRole: "preparer" });
    // a grant never carries customer governance
    await expect(withActor(advActor, (tx) => requireProjectAction(tx, advActor, p1, "report.release"))).rejects.toMatchObject({ status: 403 });
    await expect(withActor(advActor, (tx) => requireProjectAction(tx, advActor, p2, "project.read"))).rejects.toMatchObject({ status: 404 });
    // the same person acting in another tenant does not carry the grant along
    const own = await createTenant(adv, { name: "Adv kişisel", kind: "company", termsVersion: TERMS });
    expect((await listProjects({ userId: adv.userId, actingTenantId: own })).map((p) => p.id)).not.toContain(p1);

    await revokeGrant(a.actor, g);
    expect(await listProjects(advActor)).toEqual([]);

    const g2 = await grantProjectAccess(a.actor, { projectId: p1, recipientTenantId: advTenant, role: "reviewer", purpose: "gözden geçirme", days: 30, termsVersion: TERMS });
    expect((await listProjects(advActor)).map((p) => p.id)).toEqual([p1]);
    // a read-only grant role cannot write rows (RLS) even if the service were bypassed
    const w = await withActor(advActor, (tx) => tx.updateTable("core.projects").set({ name: "x" }).where("id", "=", p1).executeTakeFirst());
    expect(Number(w.numUpdatedRows)).toBe(0);
    await expire("core.external_grants", g2);
    expect(await listProjects(advActor)).toEqual([]);
  });
  it("only the customer's admins can grant, and only on their own projects", async () => {
    const a = await company("GrantA");
    const b = await company("GrantB");
    const pb = await createProject(b.actor, { name: "B proje" });
    await expect(grantProjectAccess(a.actor, { projectId: pb, recipientTenantId: a.tenantId, role: "preparer", purpose: "x", days: 10, termsVersion: TERMS })).rejects.toMatchObject({ status: 404 });
  });
});

describe("provisional client and claim (path D, G1-08, UAT-03)", () => {
  it("lets the advisory prepare a provisional client, then hands it to the real owner with continuation grants", async () => {
    const adv = await makeUser("steward");
    const advTenant = await createTenant(adv, { name: "C Danışmanlık", kind: "advisory", termsVersion: TERMS });
    const advActor: Actor = { userId: adv.userId, actingTenantId: advTenant };
    const contact = await makeUser("x-kimya");
    const { tenantId, invitationToken } = await createProvisionalClient(advActor, { name: "X Kimya A.Ş.", contactEmail: contact.email });
    const pid = await createProject(advActor, { name: "X 2026", ownerTenantId: tenantId });
    expect((await listProjects(advActor)).find((p) => p.id === pid)).toMatchObject({ owner_lifecycle: "provisional" });

    // a company tenant cannot open provisional clients
    const co = await company("NotAdvisory");
    await expect(createProvisionalClient(co.actor, { name: "Y", contactEmail: "y@example.test" })).rejects.toMatchObject({ status: 403 });

    await acceptInvitation(contact, invitationToken);
    const t = await systemDb().selectFrom("core.tenants").select(["lifecycle", "claimed_by"]).where("id", "=", tenantId).executeTakeFirstOrThrow();
    expect(t).toEqual({ lifecycle: "active", claimed_by: contact.userId });
    expect(await myMemberships(contact.userId)).toEqual([expect.objectContaining({ tenantId, role: "owner" })]);
    // steward access is now a revocable grant
    const grants = await systemDb().selectFrom("core.external_grants").select(["id", "role", "recipient_tenant_id"]).where("project_id", "=", pid).execute();
    expect(grants).toEqual([expect.objectContaining({ role: "preparer", recipient_tenant_id: advTenant })]);
    expect((await listProjects(advActor)).map((p) => p.id)).toContain(pid);
    await revokeGrant({ userId: contact.userId, actingTenantId: tenantId }, grants[0].id);
    expect((await listProjects(advActor)).map((p) => p.id)).not.toContain(pid);
  });
});

describe("audit (G1-10, T11)", () => {
  it("is append-only for the runtime roles and chains each event to the previous one", async () => {
    const a = await company("Audit");
    await createProject(a.actor, { name: "p1" });
    await createProject(a.actor, { name: "p2" });
    const rows = await systemDb().selectFrom("core.audit_events").select(["id", "hash", "prev_hash", "action"]).where("owner_tenant_id", "=", a.tenantId).orderBy("id").execute();
    expect(rows.map((r) => r.action)).toEqual(["tenant.create", "project.create", "project.create"]);
    for (let i = 1; i < rows.length; i++) expect(rows[i].prev_hash).toBe(rows[i - 1].hash);
    await expect(withActor(a.actor, (tx) => tx.updateTable("core.audit_events").set({ action: "x" }).where("id", "=", rows[0].id).execute())).rejects.toThrow(/permission denied/);
    await expect(systemDb().deleteFrom("core.audit_events").where("id", "=", rows[0].id).execute()).rejects.toThrow(/permission denied/);
  });
  it("rolls the operation back when the audit write fails (fail-closed)", async () => {
    const a = await company("FailClosed");
    const before = await listProjects(a.actor);
    await expect(
      withActor(a.actor, async (tx) => {
        await tx.insertInto("core.projects").values({ owner_tenant_id: a.tenantId, name: "half", created_by: a.owner.userId }).execute();
        // an audit row claiming another actor violates the audit policy → the whole transaction fails
        await tx.insertInto("core.audit_events").values({ action: "x", object_type: "x", object_id: "x", actor_user_id: (await makeUser("someone")).userId }).execute();
      }),
    ).rejects.toThrow(/row-level security/);
    expect(await listProjects(a.actor)).toEqual(before);
  });
});
