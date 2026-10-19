/**
 * G8-01 / G8-07: a controlled connector pulls an ERP export over HTTP into a campaign (scanned, validated,
 * submitted for review), the same payload twice changes nothing, a failing source is retried through the outbox
 * and ends in the dead-letter state; then the portfolio and review queue stay fast over 20 clients.
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, systemDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { ensureBucket } from "../evidence/storage";
import { MAX_ATTEMPTS, runOnce } from "../jobs/worker";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, createProjectWizard, portfolio } from "../projects/service";
import { acceptInvitation, createProvisionalClient, createTenant, inviteMember } from "../tenancy/service";
import { assignRequests, createCampaign, listRequests, sendRequests } from "../data/service";
import { reviewQueue } from "../close/service";
import { portfolioKpis } from "../portfolio/kpis";
import { createConnector, listConnectors, pullConnector, triggerConnector } from "./service";

let ayse: Actor, mehmet: Actor, zeynep: Actor, can: Actor;
let company: string, projectId: string, campaignId: string;
let server: Server, base: string;
let payload = "";
let status = 200;

beforeAll(async () => {
  await ensureBucket();
  server = createServer((req, res) => {
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "http://example.test/" });
      res.end();
      return;
    }
    if (req.headers.authorization !== "Bearer erp-test-token") {
      res.writeHead(401);
      res.end();
      return;
    }
    res.writeHead(status, { "content-type": "text/csv" });
    res.end(status === 200 ? payload : "down");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "ERP Şirketi", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  const m = await makeUser("Mehmet");
  await acceptInvitation(m, (await inviteMember(ayse, { email: m.email, role: "data_owner" })).token);
  mehmet = { userId: m.userId, actingTenantId: company };
  const z = await makeUser("Zeynep");
  await acceptInvitation(z, (await inviteMember(ayse, { email: z.email, role: "contributor" })).token);
  zeynep = { userId: z.userId, actingTenantId: company };
  const org = await createOrganization(ayse, { name: "ERP Grubu" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "ERP A.Ş.", isReportingParent: true });
  await createFacility(ayse, { legalEntityId: parent, name: "Bursa" });
  const p = await createProjectWizard(ayse, { name: "2026", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  await addParticipant(ayse, projectId, { userId: mehmet.userId, memberTenantId: company, raciRole: "data_owner" });
  await addParticipant(ayse, projectId, { userId: zeynep.userId, memberTenantId: company, raciRole: "contributor" });
  campaignId = (await createCampaign(ayse, p.cycleId, { title: "ERP", templateIds: ["tsrs_climate_first"] })).campaignId;
  const rows = await listRequests(ayse, campaignId);
  await assignRequests(ayse, rows.map((r) => r.id), { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId });
  await sendRequests(ayse, rows.map((r) => r.id));
  const c = await makeUser("Can");
  can = { userId: c.userId, actingTenantId: await createTenant(c, { name: "Danışman", kind: "advisory", termsVersion: "t" }) };
}, 120_000);

afterAll(async () => {
  server.close();
  await closeDb();
});

describe("G8-01 controlled connectors", () => {
  let connectorId: string;

  it("is set up by a member of the owning company; the secret is sealed, the host fixed", async () => {
    await expect(createConnector(zeynep, campaignId, { name: "Logo ERP", kind: "http_csv", url: `${base}/export.csv` })).rejects.toMatchObject({ status: 403 });
    await expect(createConnector(ayse, campaignId, { name: "x", kind: "http_csv", url: "ftp://erp/x" })).rejects.toMatchObject({ code: "invalid_url" });
    connectorId = (await createConnector(ayse, campaignId, { name: "Logo ERP", kind: "http_csv", url: `${base}/export.csv`, secret: "erp-test-token" })).id;
    const row = await systemDb().selectFrom("core.connectors").select(["secret_sealed", "allowed_host"]).where("id", "=", connectorId).executeTakeFirstOrThrow();
    expect(row.secret_sealed).not.toContain("erp-test-token");
    expect(row.allowed_host).toBe(new URL(base).host);
  });

  it("pulls rows into the campaign as submitted versions (reviewed later); the same payload again is 'unchanged'", async () => {
    payload = ["Metrik;Tesis;Değer;Birim", "ghg_electricity;Bursa;1.250,5;MWh", "ghg_electricity;Ankara;1;MWh"].join("\n");
    const r = await pullConnector(connectorId, ayse.userId);
    expect(r).toMatchObject({ status: "succeeded", rows: 2, valid: 1 });
    const el = (await listRequests(ayse, campaignId)).find((x) => x.metric_code === "ghg_electricity")!;
    expect(el.status).toBe("submitted"); // a reviewer still decides
    expect((await pullConnector(connectorId, ayse.userId)).status).toBe("unchanged");
    const runs = (await listConnectors(ayse, projectId))[0].runs;
    expect(runs.map((x) => x.status)).toEqual(["unchanged", "succeeded"]);
  });

  it("a failing source is retried by the outbox and ends as a dead event; every attempt is logged", async () => {
    status = 503;
    await triggerConnector(ayse, connectorId);
    // drive the retries: make the event due again after each failure
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await systemDb().updateTable("core.outbox_events").set({ next_attempt_at: new Date(0) }).where("kind", "=", "connector.pull").where("status", "=", "pending").execute();
      await runOnce(50);
    }
    const ev = await systemDb().selectFrom("core.outbox_events").select(["status", "attempts", "last_error"]).where("kind", "=", "connector.pull").orderBy("id", "desc").executeTakeFirstOrThrow();
    expect(ev).toMatchObject({ status: "dead", attempts: MAX_ATTEMPTS });
    expect(ev.last_error).toContain("http_503");
    const failed = (await listConnectors(ayse, projectId))[0].runs.filter((x) => x.status === "failed");
    expect(failed.length).toBe(MAX_ATTEMPTS > 10 ? 10 : MAX_ATTEMPTS);
    status = 200;
  });

  it("refuses redirects and other hosts", async () => {
    const r = await createConnector(ayse, campaignId, { name: "yönlendiren", kind: "http_csv", url: `${base}/redirect`, secret: "erp-test-token" });
    await expect(pullConnector(r.id, ayse.userId)).rejects.toThrow(/redirect_refused|http_401/);
    await systemDb().updateTable("core.connectors").set({ url: "http://example.test/x" }).where("id", "=", r.id).execute();
    await expect(pullConnector(r.id, ayse.userId)).rejects.toThrow("host_not_allowed");
  });
});

describe("G8-07 scale: 20 clients", () => {
  it("the advisory's portfolio, KPIs and review queue stay fast over 20 provisional clients", async () => {
    for (let i = 0; i < 20; i++) {
      const cl = await createProvisionalClient(can, { name: `Müşteri ${i + 1}`, contactEmail: `m${i}@ornek.test` });
      await createProjectWizard(can, { name: `2026 rapor ${i + 1}`, ownerTenantId: cl.tenantId, cycle: { reportingYear: 2026 }, planStart: "2026-04-01" });
    }
    const t0 = performance.now();
    const rows = await portfolio(can);
    const kpis = await portfolioKpis(can);
    const q = await reviewQueue(can);
    const ms = performance.now() - t0;
    expect(rows.length).toBe(20);
    expect(kpis.length).toBe(20);
    expect(q.facts).toEqual([]);
    expect(ms).toBeLessThan(3000);
  });
});
