/**
 * G8-07 load-test fixes keep their meaning:
 *   - lists across projects first narrow to the reachable projects (reachableProjectIds): always a superset of what
 *     RLS shows, so the portfolio is exactly the RLS-visible set;
 *   - the review queue's batch permission check (projectsAllowing) agrees with requireProjectAction for every
 *     project and action;
 *   - the number of SQL statements of the portfolio, its KPIs and the review queue does not grow with other
 *     customers' data or with the number of projects checked;
 *   - the one-query workspace check (tenantActor) still answers 404 for a foreign or malformed workspace and 403 when
 *     the workspace demands MFA.
 */
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, withActor, withSystem, type Actor } from "../db/client";
import { expire, makeUser } from "../db/test-helpers";
import { reviewQueue } from "../close/service";
import { createCampaign } from "../data/service";
import { tenantActor, type Session } from "../http/api";
import { ACTIONS } from "../policy/policy";
import { createProjectWizard, portfolio } from "../projects/service";
import { acceptInvitation, createProvisionalClient, createTenant, grantProjectAccess, inviteMember, projectsAllowing, reachableProjectIds, requireProjectAction } from "../tenancy/service";
import { portfolioKpis } from "./kpis";

type Named = { name: string; actor: Actor };
let people: Named[] = [];
let can: Actor;
const allProjects: string[] = [];

// statements sent by any pool client (Kysely's PostgresDialect uses pg.Pool clients)
let statements = 0;
const original = pg.Client.prototype.query;
const countStatements = async (fn: () => Promise<unknown>) => {
  const before = statements;
  await fn();
  return statements - before;
};

async function project(actor: Actor, name: string, ownerTenantId?: string) {
  const p = await createProjectWizard(actor, { name, ...(ownerTenantId ? { ownerTenantId } : {}), cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  allProjects.push(p.projectId);
  return p;
}

async function unrelatedCustomers(n: number) {
  for (let i = 0; i < n; i++) {
    const u = await makeUser("Yabanci");
    const t = await createTenant(u, { name: `Yabancı ${i}`, kind: "company", termsVersion: "t" });
    const a = { userId: u.userId, actingTenantId: t };
    const p = await project(a, `Yabancı proje ${i}`);
    await createCampaign(a, p.cycleId, { title: "Veri", templateIds: ["tsrs_climate_first"] });
  }
}

beforeAll(async () => {
  pg.Client.prototype.query = function (this: pg.Client, ...args: unknown[]) {
    statements++;
    return (original as (...a: unknown[]) => unknown).apply(this, args);
  } as typeof original;

  // company A: owner and contributor, two projects; one granted to the advisory as preparer
  const a = await makeUser("Ayse");
  const tenantA = await createTenant(a, { name: "Şirket A", kind: "company", termsVersion: "t" });
  const ayse = { userId: a.userId, actingTenantId: tenantA };
  const z = await makeUser("Zeynep");
  await acceptInvitation(z, (await inviteMember(ayse, { email: z.email, role: "contributor" })).token);
  const pA1 = await project(ayse, "A1");
  await project(ayse, "A2");
  // company B: one project granted to the advisory for design only, one with an expired grant
  const b = await makeUser("Bora");
  const tenantB = await createTenant(b, { name: "Şirket B", kind: "company", termsVersion: "t" });
  const bora = { userId: b.userId, actingTenantId: tenantB };
  const pB1 = await project(bora, "B1");
  const pB2 = await project(bora, "B2");
  // advisory C: owner and reviewer, a provisional client with a project
  const c = await makeUser("Can");
  const tenantC = await createTenant(c, { name: "Danışman C", kind: "advisory", termsVersion: "t" });
  can = { userId: c.userId, actingTenantId: tenantC };
  const d = await makeUser("Deniz");
  await acceptInvitation(d, (await inviteMember(can, { email: d.email, role: "reviewer" })).token);
  const client = await createProvisionalClient(can, { name: "Geçici müşteri", contactEmail: "yetkili@musteri.example.test" });
  await project(can, "Geçici", client.tenantId);

  await grantProjectAccess(ayse, { projectId: pA1.projectId, recipientTenantId: tenantC, role: "preparer", purpose: "Rapor hazırlığı", days: 30, termsVersion: "t" });
  await grantProjectAccess(bora, { projectId: pB1.projectId, recipientTenantId: tenantC, role: "design", purpose: "Tasarım", days: 30, termsVersion: "t" });
  await expire("core.external_grants", await grantProjectAccess(bora, { projectId: pB2.projectId, recipientTenantId: tenantC, role: "preparer", purpose: "Süresi geçti", days: 30, termsVersion: "t" }));

  await unrelatedCustomers(3);
  people = [
    { name: "owner", actor: ayse },
    { name: "contributor", actor: { userId: z.userId, actingTenantId: tenantA } },
    { name: "other company", actor: bora },
    { name: "advisory owner", actor: can },
    { name: "advisory reviewer", actor: { userId: d.userId, actingTenantId: tenantC } },
  ];
});

afterAll(async () => {
  pg.Client.prototype.query = original;
  await closeDb();
});

describe("G8-07 reachable projects", () => {
  it("is a superset of the RLS-visible projects, and the portfolio is exactly the RLS-visible set", async () => {
    for (const { name, actor } of people) {
      const visible = (await withActor(actor, (tx) => tx.selectFrom("core.projects").select("id").execute())).map((r) => r.id).sort();
      const reachable = new Set(await withActor(actor, (tx) => reachableProjectIds(tx, actor)));
      expect(visible.filter((id) => !reachable.has(id)), name).toEqual([]);
      expect((await portfolio(actor)).map((p) => p.id).sort(), name).toEqual(visible);
      expect((await portfolioKpis(actor)).map((k) => k.projectId).sort(), name).toEqual(visible);
    }
  });

  it("the batch permission check agrees with requireProjectAction for every project and action", async () => {
    for (const { name, actor } of people) {
      const batch = await withActor(actor, (tx) => projectsAllowing(tx, actor, allProjects, [...ACTIONS]));
      for (const action of ACTIONS) {
        const one: string[] = [];
        for (const id of allProjects) if (await withActor(actor, (tx) => requireProjectAction(tx, actor, id, action).then(() => true, () => false))) one.push(id);
        expect([...batch[action]].sort(), `${name} ${action}`).toEqual(one.sort());
      }
    }
  });

  it("statement counts do not grow with other customers' data or with the projects checked", async () => {
    const before = { portfolio: await countStatements(() => portfolio(can)), kpis: await countStatements(() => portfolioKpis(can)), queue: await countStatements(() => reviewQueue(can)) };
    await unrelatedCustomers(5);
    const after = { portfolio: await countStatements(() => portfolio(can)), kpis: await countStatements(() => portfolioKpis(can)), queue: await countStatements(() => reviewQueue(can)) };
    expect(after).toEqual(before);
    const one = await countStatements(() => withActor(can, (tx) => projectsAllowing(tx, can, allProjects.slice(0, 1), ["quality.review", "data.review"])));
    const many = await countStatements(() => withActor(can, (tx) => projectsAllowing(tx, can, allProjects, ["quality.review", "data.review"])));
    expect(many).toBeLessThanOrEqual(one + 2); // the steward and grant lookups join in once there are foreign projects
  });
});

describe("G8-07 one-query workspace check", () => {
  const session = (userId: string): Session => ({ identity: { userId, email: "x@example.test", emailVerified: true }, name: "x", sessionId: "s", twoFactorEnabled: false });

  it("acts for a live membership with its role", async () => {
    const t = await tenantActor(session(can.userId), can.actingTenantId, "r");
    expect(t).toMatchObject({ userId: can.userId, actingTenantId: can.actingTenantId, role: "owner", requireMfa: false });
    expect(await tenantActor(session(can.userId), null, "r")).toMatchObject({ actingTenantId: null, role: null });
  });

  it("answers 404 for a foreign or malformed workspace and 403 when the workspace demands MFA", async () => {
    const other = people.find((p) => p.name === "other company")!.actor;
    await expect(tenantActor(session(can.userId), other.actingTenantId, "r")).rejects.toMatchObject({ status: 404 });
    await expect(tenantActor(session(can.userId), "not-a-uuid", "r")).rejects.toMatchObject({ status: 404 });
    // an upper-case id is the same workspace; the actor carries the id as stored, which the services compare with
    expect(await tenantActor(session(can.userId), can.actingTenantId!.toUpperCase(), "r")).toMatchObject({ actingTenantId: can.actingTenantId });
    await withSystem("test: workspace demands MFA", (tx) => tx.updateTable("core.tenants").set({ require_mfa: true }).where("id", "=", can.actingTenantId!).execute());
    await expect(tenantActor(session(can.userId), can.actingTenantId, "r")).rejects.toMatchObject({ status: 403, code: "mfa_required" });
    expect(await tenantActor({ ...session(can.userId), twoFactorEnabled: true }, can.actingTenantId, "r")).toMatchObject({ requireMfa: true });
    await withSystem("test: MFA rule back off", (tx) => tx.updateTable("core.tenants").set({ require_mfa: false }).where("id", "=", can.actingTenantId!).execute());
  });
});
