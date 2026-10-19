/**
 * Demo data for the two reference journeys (G0-06). Everything is fictional and flagged `sample`. People sign in
 * with one generated password written to web/.demo-users.local.json (git-ignored); it is never printed.
 * Re-running is safe: an existing demo is left as it is unless `reset` is passed.
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "better-auth/crypto";
import { sql } from "kysely";
import { withSystem } from "../db/client";
import { acceptInvitation, createProject, createProvisionalClient, createTenant, grantProjectAccess, inviteMember, type Identity } from "../tenancy/service";
import type { MemberRole } from "../policy/policy";

export const DEMO_DOMAIN = "ornek.test";

export const PEOPLE = {
  ayse: { name: "Ayşe Yılmaz", email: `ayse@${DEMO_DOMAIN}` },
  mehmet: { name: "Mehmet Kaya", email: `mehmet@${DEMO_DOMAIN}` },
  zeynep: { name: "Zeynep Demir", email: `zeynep@${DEMO_DOMAIN}` },
  can: { name: "Can Öztürk", email: `can@${DEMO_DOMAIN}` },
  deniz: { name: "Deniz Arslan", email: `deniz@${DEMO_DOMAIN}` },
  elif: { name: "Elif Şahin", email: `elif@${DEMO_DOMAIN}` },
} as const;
export type Person = keyof typeof PEOPLE;

export type DemoIds = {
  people: Record<Person, string>;
  companyTenant: string;
  advisoryTenant: string;
  provisionalTenant: string;
  companyProject: string;
  provisionalProject: string;
  grantToAdvisory: string;
};

async function createPerson(name: string, email: string, passwordHash: string): Promise<string> {
  return withSystem("seed: demo person", async (tx) => {
    const u = await tx.insertInto("user").values({ name, email, emailVerified: true, updatedAt: new Date() }).returning("id").executeTakeFirstOrThrow();
    await tx.insertInto("account").values({ accountId: u.id, providerId: "credential", userId: u.id, password: passwordHash, updatedAt: new Date() }).execute();
    return u.id;
  });
}

async function existingDemo(): Promise<boolean> {
  return withSystem("seed: look for an existing demo", async (tx) => {
    const r = await tx.selectFrom("user").select("id").where("email", "like", `%@${DEMO_DOMAIN}`).executeTakeFirst();
    return Boolean(r);
  });
}

/**
 * Removes the demo tenants and people (only rows marked sample or on the demo domain). Audit rows are append-only
 * for the app and system roles, so the reset runs as the database owner — a local development operation only.
 */
export async function resetDemo(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("demo reset is not available in production");
  const { Kysely, PostgresDialect } = await import("kysely");
  const pg = (await import("pg")).default;
  const owner = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 }) }) });
  try {
    await owner.transaction().execute(async (tx) => {
      const ids = sql`(select id from core.tenants where sample)`;
      const users = sql`(select id from "user" where email like ${"%@" + DEMO_DOMAIN})`;
      await sql`delete from core.evidence_access_log where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.evidence_objects where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.consent_records where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.external_grants where owner_tenant_id in ${ids} or recipient_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.outbox_events where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.audit_events where owner_tenant_id in ${ids} or acting_tenant_id in ${ids} or actor_user_id in ${users}`.execute(tx);
      await sql`delete from core.retention_rules where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.projects where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.invitations where tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.memberships where tenant_id in ${ids}`.execute(tx);
      await sql`update core.tenants set steward_tenant_id = null, lifecycle = 'active' where sample`.execute(tx);
      await sql`delete from core.tenants where sample`.execute(tx);
      await sql`delete from core.idempotency_keys where user_id in ${users}`.execute(tx);
      await sql`delete from "user" where email like ${"%@" + DEMO_DOMAIN}`.execute(tx);
    });
  } finally {
    await owner.destroy();
  }
}

export async function seedDemo(opts: { reset?: boolean; credentialsFile?: string | null } = {}): Promise<DemoIds | null> {
  if (await existingDemo()) {
    if (!opts.reset) {
      console.log("demo already present (npm run db:seed -- --reset to rebuild)");
      return null;
    }
    await resetDemo();
  }
  const password = randomBytes(12).toString("base64url");
  const hash = await hashPassword(password);
  const people = {} as Record<Person, string>;
  for (const [k, p] of Object.entries(PEOPLE) as [Person, (typeof PEOPLE)[Person]][]) people[k] = await createPerson(p.name, p.email, hash);
  const id = (k: Person): Identity => ({ userId: people[k], email: PEOPLE[k].email, emailVerified: true });

  // Journey 1: the company starts (Ayşe), invites Mehmet and Zeynep
  const companyTenant = await createTenant(id("ayse"), { name: "Anadolu Gıda Holding A.Ş. (örnek)", kind: "company", termsVersion: "terms-2026-10" });
  const ayse = { userId: people.ayse, actingTenantId: companyTenant };
  const invite = async (who: Person, role: MemberRole) => acceptInvitation(id(who), (await inviteMember(ayse, { email: PEOPLE[who].email, role })).token);
  await invite("mehmet", "data_owner");
  await invite("zeynep", "contributor");
  await invite("elif", "management_signer");
  const companyProject = await createProject(ayse, { name: "2026 TSRS + Faaliyet Raporu" });

  // Journey 2: the advisory starts (Can), Deniz joins as reviewer
  const advisoryTenant = await createTenant(id("can"), { name: "Yeşil Eşik Danışmanlık (örnek)", kind: "advisory", termsVersion: "terms-2026-10" });
  const can = { userId: people.can, actingTenantId: advisoryTenant };
  await acceptInvitation(id("deniz"), (await inviteMember(can, { email: PEOPLE.deniz.email, role: "reviewer" })).token);
  const provisional = await createProvisionalClient(can, { name: "X Kimya A.Ş. (örnek)", contactEmail: `yetkili@xkimya.${DEMO_DOMAIN}` });
  const provisionalProject = await createProject(can, { name: "2026 Sürdürülebilirlik Raporu (taslak)", ownerTenantId: provisional.tenantId });

  // Journey 1 step 9: the company grants the advisory "preparer" access to its project for 90 days
  const grantToAdvisory = await grantProjectAccess(ayse, { projectId: companyProject, recipientTenantId: advisoryTenant, role: "preparer", purpose: "2026 rapor hazırlığı (örnek)", days: 90, termsVersion: "grant-2026-10" });

  await withSystem("seed: label demo tenants as sample", (tx) => tx.updateTable("core.tenants").set({ sample: true }).where("id", "in", [companyTenant, advisoryTenant, provisional.tenantId]).execute());

  const file = opts.credentialsFile === undefined ? join(process.cwd(), ".demo-users.local.json") : opts.credentialsFile;
  if (file) writeFileSync(file, JSON.stringify({ note: "Yalnız yerel demo. Bu dosya git'e girmez.", password, people: Object.values(PEOPLE).map((p) => p.email) }, null, 2) + "\n");
  if (file) console.log(`demo sign-in details written to ${file}`);
  return { people, companyTenant, advisoryTenant, provisionalTenant: provisional.tenantId, companyProject, provisionalProject, grantToAdvisory };
}
