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
import { acceptInvitation, createProvisionalClient, createTenant, grantProjectAccess, inviteMember, type Identity } from "../tenancy/service";
import { addOwnershipEdge, createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addDeliverable, addParticipant, approveBoundary, createEngagement, createProjectWizard, listPlan, proposeBoundary, updateWorkPackage } from "../projects/service";
import { acceptTask, assignRequests, closeRequest, createCampaign, linkEvidence, listRequests, saveDraft, sendRequests, submitTask, type DraftInput } from "../data/service";
import { processScan, uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { runCalculation } from "../calc/service";
import { submitElimination, submitEntityFinancial } from "../close/service";
import type { MemberRole } from "../policy/policy";

export const DEMO_DOMAIN = "ornek.test";

export const PEOPLE = {
  ayse: { name: "Ayşe Yılmaz", email: `ayse@${DEMO_DOMAIN}` },
  mehmet: { name: "Mehmet Kaya", email: `mehmet@${DEMO_DOMAIN}` },
  zeynep: { name: "Zeynep Demir", email: `zeynep@${DEMO_DOMAIN}` },
  can: { name: "Can Öztürk", email: `can@${DEMO_DOMAIN}` },
  deniz: { name: "Deniz Arslan", email: `deniz@${DEMO_DOMAIN}` },
  elif: { name: "Elif Şahin", email: `elif@${DEMO_DOMAIN}` },
  selin: { name: "Selin Aksoy", email: `selin@${DEMO_DOMAIN}` },
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
 * for the app and system roles, so the reset runs with the administrator connection — a local development
 * operation only.
 */
export async function resetDemo(): Promise<void> {
  if (process.env.NODE_ENV === "production") throw new Error("demo reset is not available in production");
  const { Kysely, PostgresDialect } = await import("kysely");
  const pg = (await import("pg")).default;
  // FORCE RLS applies to the schema owner too, so the reset runs as the cluster administrator on the app database
  const admin = new URL(process.env.DATABASE_ADMIN_URL!);
  admin.pathname = new URL(process.env.DATABASE_URL!).pathname;
  const owner = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: admin.toString(), max: 1 }) }) });
  try {
    await owner.transaction().execute(async (tx) => {
      const users = sql`(select id from "user" where email like ${"%@" + DEMO_DOMAIN})`;
      // demo tenants: flagged sample, or created by a demo person (a run that stopped before flagging)
      const ids = sql`(select id from core.tenants where sample or created_by in ${users})`;
      // children before parents: G4 facts and runs, G3 observations and requests, then the G1/G2 tables
      await sql`delete from core.factor_choices where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.factor_values where set_id in (select id from core.factor_sets where owner_tenant_id in ${ids})`.execute(tx);
      await sql`delete from core.snapshot_facts where owner_tenant_id in ${ids}`.execute(tx);
      const byOwnerFirst = ["cycle_events", "cycle_snapshots", "entity_financials", "intercompany_eliminations", "quality_issues", "metric_fact_versions", "run_inputs", "calculation_runs", "factor_sets", "notifications", "request_comments", "evidence_links", "observation_versions", "source_imports", "data_requests", "data_campaigns"];
      for (const t of byOwnerFirst) await sql`delete from ${sql.table(`core.${t}`)} where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.notifications where user_id in ${users}`.execute(tx);
      const byOwner = ["evidence_access_log", "evidence_objects", "consent_records", "outbox_events", "retention_rules", "work_package_deps", "work_packages", "project_participants", "applicability_assessments", "boundary_members", "reporting_boundaries", "reporting_cycles", "deliverables"];
      for (const t of byOwner) await sql`delete from ${sql.table(`core.${t}`)} where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.external_grants where owner_tenant_id in ${ids} or recipient_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.audit_events where owner_tenant_id in ${ids} or acting_tenant_id in ${ids} or actor_user_id in ${users}`.execute(tx);
      await sql`delete from core.projects where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.engagements where owner_tenant_id in ${ids} or advisory_tenant_id in ${ids}`.execute(tx);
      for (const t of ["facilities", "ownership_edges", "legal_entities", "organizations", "legacy_imports"]) await sql`delete from ${sql.table(`core.${t}`)} where owner_tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.invitations where tenant_id in ${ids}`.execute(tx);
      await sql`delete from core.memberships where tenant_id in ${ids} or user_id in ${users}`.execute(tx);
      await sql`update core.tenants set steward_tenant_id = null, lifecycle = 'active' where id in ${ids}`.execute(tx);
      await sql`delete from core.tenants where id in ${ids}`.execute(tx);
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
  await invite("selin", "project_lead");
  // G0-06 journey 1 step 3: holding → one legal entity → two plants (Gebze, Dilovası)
  const org = await createOrganization(ayse, { name: "Anadolu Gıda Grubu (örnek)", sectorCode: "C10", fiscalYearStartMonth: 1 });
  const holding = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Gıda Holding A.Ş.", entityType: "listed", isReportingParent: true });
  const uretim = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Gıda Üretim A.Ş." });
  await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: uretim, sharePct: 100, control: "financial", validFrom: "2020-01-01", sourceNote: "Örnek veri" });
  await createFacility(ayse, { legalEntityId: uretim, name: "Gebze Fabrikası", kind: "plant", city: "Kocaeli", gridConnection: "transmission" });
  await createFacility(ayse, { legalEntityId: uretim, name: "Dilovası Fabrikası", kind: "plant", city: "Kocaeli" });
  const eng = await createEngagement(ayse, { title: "2026 raporlama (örnek)", startsOn: "2026-03-01", endsOn: "2027-06-30" });
  const wiz = await createProjectWizard(ayse, { name: "2026 TSRS + Faaliyet Raporu", organizationId: org, engagementId: eng, cycle: { reportingYear: 2026, publishDue: "2027-05-31" }, planStart: "2026-03-01" });
  const companyProject = wiz.projectId;
  await addDeliverable(ayse, eng, { title: "TSRS sürdürülebilirlik raporu", reportKind: "tsrs", dueOn: "2027-05-31", projectId: companyProject });
  await addDeliverable(ayse, eng, { title: "Yıllık faaliyet raporu", reportKind: "annual_report", dueOn: "2027-03-31", projectId: companyProject });
  const boundary = await proposeBoundary(ayse, wiz.cycleId, "ghg_operational_control");
  await approveBoundary(ayse, boundary.boundaryId);
  await addParticipant(ayse, companyProject, { userId: people.mehmet, memberTenantId: companyTenant, raciRole: "data_owner", responsibilities: "Enerji ve yakıt verileri" });
  await addParticipant(ayse, companyProject, { userId: people.zeynep, memberTenantId: companyTenant, raciRole: "contributor", responsibilities: "Gebze fabrikası verileri" });
  await addParticipant(ayse, companyProject, { userId: people.elif, memberTenantId: companyTenant, raciRole: "management_signer" });
  await addParticipant(ayse, companyProject, { userId: people.selin, memberTenantId: companyTenant, raciRole: "project_lead", responsibilities: "Hesaplama ve metodoloji" });
  // G3: a climate data campaign — Gebze to Zeynep, Dilovası and organisation-wide items to Mehmet
  const cmp = await createCampaign(ayse, wiz.cycleId, { title: "2026 iklim verisi (örnek)", templateIds: ["tsrs_climate_first"], dueOn: "2027-01-31" });
  const reqs = await listRequests(ayse, cmp.campaignId);
  const gebzeFac = reqs.find((r) => r.facility_name === "Gebze Fabrikası")?.facility_id;
  await assignRequests(ayse, reqs.filter((r) => r.facility_id === gebzeFac).map((r) => r.id), { assigneeUserId: people.zeynep, reviewerUserId: people.mehmet });
  await assignRequests(ayse, reqs.filter((r) => r.facility_id !== gebzeFac).map((r) => r.id), { assigneeUserId: people.mehmet, reviewerUserId: people.ayse });
  await sendRequests(ayse, reqs.map((r) => r.id));
  const zeynepActor = { userId: people.zeynep, actingTenantId: companyTenant };
  const mehmetActor = { userId: people.mehmet, actingTenantId: companyTenant };
  // G3 → G4: the year's climate data entered with a source document and accepted by the other person (sample values)
  await ensureBucket();
  // each person attaches their own file: a file still being scanned is visible to its uploader only
  const pdf = (label: string) => new TextEncoder().encode(`%PDF-1.4\n% ${label} (kurgusal)\n%%EOF\n`);
  const proofZ = await uploadEvidence(zeynepActor, companyProject, { filename: "gebze-fatura-ozeti-2026.pdf", bytes: pdf("Gebze fatura özeti") });
  const proofM = await uploadEvidence(mehmetActor, companyProject, { filename: "dilovasi-ve-filo-2026.pdf", bytes: pdf("Dilovası ve filo özeti") });
  const dil = reqs.find((r) => r.facility_name === "Dilovası Fabrikası")?.facility_id ?? null;
  const entries: [string, string | null, DraftInput][] = [
    ["ghg_stationary", gebzeFac ?? null, { lines: [{ key: "natural_gas", value: "1.200.000", unit: "m3" }, { key: "diesel", value: "15000", unit: "L" }], quality: "measured", sourceRef: "BOTAŞ faturaları (örnek)" }],
    ["ghg_electricity", gebzeFac ?? null, { value: "1.250.000", unit: "kWh", quality: "measured", sourceRef: "Örnek fatura özeti" }],
    ["ghg_refrigerants", gebzeFac ?? null, { lines: [{ key: "R-410A", value: "8", unit: "kg" }], quality: "estimated", methodNote: "Servis formlarındaki ilave dolum miktarı" }],
    ["ghg_stationary", dil, { lines: [{ key: "natural_gas", value: "600000", unit: "m3" }], quality: "measured" }],
    ["ghg_electricity", dil, { value: "900000", unit: "kWh", quality: "measured" }],
    ["ghg_mobile", null, { lines: [{ key: "diesel", value: "42000", unit: "L" }], quality: "calculated", methodNote: "Akaryakıt kartı dökümü" }],
    ["ghg_certificates", null, { value: "300", unit: "MWh", quality: "measured", sourceRef: "YEK-G belgesi (örnek)" }],
  ];
  for (const [metric, fac, d] of entries) {
    const r = reqs.find((x) => x.metric_code === metric && x.facility_id === fac);
    if (!r) continue;
    const enterer = r.facility_id === gebzeFac ? zeynepActor : mehmetActor;
    await saveDraft(enterer, r.id, d);
    await linkEvidence(enterer, r.id, enterer === zeynepActor ? proofZ.id : proofM.id);
    await submitTask(enterer, r.id);
    await acceptTask(enterer === zeynepActor ? mehmetActor : ayse, r.id);
  }
  for (const r of await listRequests(ayse, cmp.campaignId)) if (["created", "assigned", "sent"].includes(r.status)) await closeRequest(ayse, r.id, "not_applicable", "Örnek şirkette bu kalem 2026 için yok.");
  // the files are scanned before the calculation so the run's lineage lists them (the worker would do it shortly)
  for (const e of [proofZ.id, proofM.id]) await processScan(e);
  // Selin runs the GHG calculation; Mehmet reviews it in the app (four eyes)
  await runCalculation({ userId: people.selin, actingTenantId: companyTenant }, wiz.cycleId, { kind: "ghg" });
  // G5: the financial reporting boundary and the revenue of each company, waiting for Ayşe's approval (sample figures)
  await approveBoundary(ayse, (await proposeBoundary(ayse, wiz.cycleId, "financial_reporting")).boundaryId);
  await submitEntityFinancial(mehmetActor, wiz.cycleId, { legalEntityId: holding, netSales: "185000000" });
  await submitEntityFinancial(mehmetActor, wiz.cycleId, { legalEntityId: uretim, netSales: "1240000000" });
  await submitElimination(mehmetActor, wiz.cycleId, { sellerEntityId: uretim, buyerEntityId: holding, amount: "42500000", description: "Holding'e grup içi ürün satışı (örnek)" });
  // the first three gates are behind the team already (intake, organisation, scope decision)
  for (const gate of ["G0", "G1", "G2"]) {
    const wp = (await listPlan(ayse, wiz.cycleId)).find((w) => w.gate === gate)!;
    for (const status of ["active", "review", "done"] as const) await updateWorkPackage(ayse, wp.id, { status, ...(status === "active" ? { responsibleUserId: people.ayse } : {}) });
  }

  // Journey 2: the advisory starts (Can), Deniz joins as reviewer
  const advisoryTenant = await createTenant(id("can"), { name: "Yeşil Eşik Danışmanlık (örnek)", kind: "advisory", termsVersion: "terms-2026-10" });
  const can = { userId: people.can, actingTenantId: advisoryTenant };
  await acceptInvitation(id("deniz"), (await inviteMember(can, { email: PEOPLE.deniz.email, role: "reviewer" })).token);
  const provisional = await createProvisionalClient(can, { name: "X Kimya A.Ş. (örnek)", contactEmail: `yetkili@xkimya.${DEMO_DOMAIN}` });
  const xorg = await createOrganization(can, { name: "X Kimya (örnek)", sectorCode: "C20", ownerTenantId: provisional.tenantId });
  const xparent = await createLegalEntity(can, { organizationId: xorg, name: "X Kimya A.Ş.", isReportingParent: true });
  await createFacility(can, { legalEntityId: xparent, name: "Aliağa Tesisi", kind: "plant", city: "İzmir", cbamInstallation: true });
  const provisionalProject = (await createProjectWizard(can, { name: "2026 Sürdürülebilirlik Raporu (taslak)", ownerTenantId: provisional.tenantId, organizationId: xorg, cycle: { reportingYear: 2026, publishDue: "2027-06-30" }, planStart: "2026-04-01" })).projectId;

  // Journey 1 step 9: the company grants the advisory "preparer" access to its project for 90 days
  const grantToAdvisory = await grantProjectAccess(ayse, { projectId: companyProject, recipientTenantId: advisoryTenant, role: "preparer", purpose: "2026 rapor hazırlığı (örnek)", days: 90, termsVersion: "grant-2026-10" });

  await withSystem("seed: label demo tenants as sample", (tx) => tx.updateTable("core.tenants").set({ sample: true }).where("id", "in", [companyTenant, advisoryTenant, provisional.tenantId]).execute());

  const file = opts.credentialsFile === undefined ? join(process.cwd(), ".demo-users.local.json") : opts.credentialsFile;
  if (file) writeFileSync(file, JSON.stringify({ note: "Yalnız yerel demo. Bu dosya git'e girmez.", password, people: Object.values(PEOPLE).map((p) => p.email) }, null, 2) + "\n");
  if (file) console.log(`demo sign-in details written to ${file}`);
  return { people, companyTenant, advisoryTenant, provisionalTenant: provisional.tenantId, companyProject, provisionalProject, grantToAdvisory };
}
