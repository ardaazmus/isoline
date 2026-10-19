/**
 * Builds the database of the browser and load suites (npm run e2e:prepare): a fresh "isoline_e2e" database,
 * migrated, with the reference data, the demo tenants of the two journeys (src/server/seed/demo.ts), plus
 *   - two open data requests for Zeynep (reviewer Mehmet): one stays open for the accessibility scan of the task
 *     form, the other is submitted and accepted by keyboard in e2e/keyboard.spec.ts;
 *   - 20 provisional clients with a project each under the advisory, the G8-07 portfolio scale;
 *   - 200 background tenants nobody in the demo can see, each with a project, its plan and a climate data campaign:
 *     what the demo people do must not get slower as other customers' data grows (RLS filters, indexes).
 * Fixture ids and the generated password go to e2e/.state/ (git-ignored); nothing secret is printed.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { E2E_DATABASE, FIXTURE_FILE, e2eEnv, ensureStateDir } from "./env";

Object.assign(process.env, e2eEnv());

const CLIENTS = Number(process.env.E2E_CLIENTS ?? 20);
const BACKGROUND = Number(process.env.E2E_BACKGROUND_TENANTS ?? 200);

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

async function main() {
  const { bootstrapCluster } = await import("../../src/server/db/bootstrap");
  const { migrateToLatest } = await import("../../src/server/db/migrator");
  await bootstrapCluster({
    adminUrl: need("DATABASE_ADMIN_URL"),
    database: E2E_DATABASE,
    passwords: { owner: need("DB_OWNER_PASSWORD"), app: need("DB_APP_PASSWORD"), system: need("DB_SYSTEM_PASSWORD") },
    recreate: true,
  });
  await migrateToLatest(need("DATABASE_OWNER_URL"));
  const { syncCatalog } = await import("../../src/server/data/catalog-sync");
  const { syncBuiltinFactors } = await import("../../src/server/calc/factors");
  const { syncReferenceVersions } = await import("../../src/server/reference/updater");
  await syncCatalog();
  await syncBuiltinFactors();
  await syncReferenceVersions();

  ensureStateDir();
  const credentialsFile = join(FIXTURE_FILE, "..", "demo-users.json");
  const { seedDemo, PEOPLE } = await import("../../src/server/seed/demo");
  const ids = await seedDemo({ credentialsFile });
  if (!ids) throw new Error("demo seed did not run on a fresh database");
  const { password } = JSON.parse(readFileSync(credentialsFile, "utf8")) as { password: string };
  rmSync(credentialsFile);

  const { METRIC } = await import("../../src/server/data/catalog");
  const { assignRequests, createCampaign, listCampaigns, listRequests, sendRequests } = await import("../../src/server/data/service");
  const ayse = { userId: ids.people.ayse, actingTenantId: ids.companyTenant };
  const [campaign] = await listCampaigns(ayse, ids.companyProject);
  // the GRI template adds facility-level environmental items to the climate campaign
  await createCampaign(ayse, campaign.cycle_id, { title: campaign.title, templateIds: ["gri"] }, campaign.id);
  const single = (code: string) => {
    const m = METRIC.get(code);
    return !!m && !m.multiline && !m.dimensions.includes("none");
  };
  const open = (await listRequests(ayse, campaign.id)).filter((r) => r.status === "created" && r.facility_name === "Gebze Fabrikası" && single(r.metric_code));
  if (open.length < 2) throw new Error(`expected two open single-value Gebze requests, found ${open.length}`);
  const [scanTask, keyboardTask] = open;
  await assignRequests(ayse, [scanTask.id, keyboardTask.id], { assigneeUserId: ids.people.zeynep, reviewerUserId: ids.people.mehmet });
  await sendRequests(ayse, [scanTask.id, keyboardTask.id]);

  const { createProvisionalClient, createTenant } = await import("../../src/server/tenancy/service");
  const { createProjectWizard } = await import("../../src/server/projects/service");
  const can = { userId: ids.people.can, actingTenantId: ids.advisoryTenant };
  for (let i = 0; i < CLIENTS; i++) {
    const cl = await createProvisionalClient(can, { name: `Ölçek müşterisi ${i + 1} (örnek)`, contactEmail: `olcek${i + 1}@musteri.ornek.test` });
    await createProjectWizard(can, { name: `2026 rapor ${i + 1}`, ownerTenantId: cl.tenantId, cycle: { reportingYear: 2026 }, planStart: "2026-04-01" });
  }

  const { withSystem, closeDb } = await import("../../src/server/db/client");
  const owner = await withSystem("e2e fixture: owner of the background tenants", (tx) =>
    tx.insertInto("user").values({ name: "Arka plan sahibi", email: "arka-plan@hacim.ornek.test", emailVerified: true, updatedAt: new Date() }).returning("id").executeTakeFirstOrThrow(),
  );
  const background = async (i: number) => {
    const tenant = await createTenant({ userId: owner.id, email: "arka-plan@hacim.ornek.test", emailVerified: true }, { name: `Arka plan kiracısı ${i + 1} (örnek)`, kind: "company", termsVersion: "terms-2026-10" });
    const a = { userId: owner.id, actingTenantId: tenant };
    const wiz = await createProjectWizard(a, { name: "2026 raporu", cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
    await createCampaign(a, wiz.cycleId, { title: "2026 iklim verisi", templateIds: ["tsrs_climate_first"] });
  };
  for (let i = 0; i < BACKGROUND; i += 8) await Promise.all(Array.from({ length: Math.min(8, BACKGROUND - i) }, (_, k) => background(i + k)));

  const lookups = await withSystem("e2e fixture: ids of the seeded demo objects", async (tx) => {
    const report = await tx.selectFrom("core.reports").select("id").where("project_id", "=", ids.companyProject).executeTakeFirstOrThrow();
    const fact = await tx.selectFrom("core.metric_fact_versions").select("id").where("project_id", "=", ids.companyProject).orderBy("created_at").executeTakeFirstOrThrow();
    const run = await tx.selectFrom("core.calculation_runs").select("id").where("project_id", "=", ids.companyProject).orderBy("performed_at").executeTakeFirstOrThrow();
    return { reportId: report.id, factId: fact.id, runId: run.id };
  });
  await closeDb();

  const people = Object.fromEntries(Object.entries(PEOPLE).map(([k, p]) => [k, p.email]));
  writeFileSync(
    FIXTURE_FILE,
    JSON.stringify(
      {
        note: "e2e fixture: generated by scripts/e2e/prepare.ts, git-ignored",
        password,
        people,
        ids: {
          companyTenant: ids.companyTenant,
          advisoryTenant: ids.advisoryTenant,
          companyProject: ids.companyProject,
          cycleId: campaign.cycle_id,
          campaignId: campaign.id,
          scanTaskId: scanTask.id,
          keyboardTaskId: keyboardTask.id,
          ...lookups,
        },
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`e2e database ${E2E_DATABASE} ready: demo tenants, 2 open tasks, ${CLIENTS} scale clients, ${BACKGROUND} background tenants`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
