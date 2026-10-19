/**
 * G7 gate (plan 13): an advisory runs two clients — one started its report itself, the other was started by the
 * advisory for a provisional client; revoking the advisory's grant does not touch the report it helped write.
 * Also: the portfolio's operational KPIs (no ESG grade), the assurance room (questions and evidence, data never
 * changes), the cement industry pack (clinker ratio, Tier 1 calcination), separate internal and external review.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, approveBoundary, createProjectWizard, portfolio, proposeBoundary } from "../projects/service";
import { acceptInvitation, createProvisionalClient, createTenant, grantProjectAccess, inviteMember, revokeGrant, type Identity } from "../tenancy/service";
import { acceptTask, assignRequests, closeRequest, createCampaign, linkEvidence, listRequests, saveDraft, sendRequests, submitTask } from "../data/service";
import { approveFact, listFacts, runCalculation } from "../calc/service";
import { createReport, getReport, reviewSection, saveSection, submitSection } from "../reports/service";
import { answerQuestion, askQuestion, assuranceRoom, closeQuestion, createEngagement, setEngagementStatus } from "../assurance/service";
import { portfolioKpis } from "../portfolio/kpis";
import { addPackRequests, enablePack, projectPacks, runIndustry } from "./service";

let ayse: Actor, selin: Actor, mehmet: Actor, zeynep: Actor, can: Actor, ece: Actor;
let companyA: string, advisory: string, projectA: string, cycleA: string, plant: string, grantId: string;
let projectB: string, cycleB: string;

async function member(tenant: string, inviter: Actor, label: string, role: Parameters<typeof inviteMember>[1]["role"]): Promise<Actor> {
  const u: Identity = await makeUser(label);
  await acceptInvitation(u, (await inviteMember(inviter, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: tenant };
}

beforeAll(async () => {
  await ensureBucket();
  const c = await makeUser("Can");
  advisory = await createTenant(c, { name: "Yeşil Eşik Danışmanlık", kind: "advisory", termsVersion: "t" });
  can = { userId: c.userId, actingTenantId: advisory };
  const a = await makeUser("Ayse");
  companyA = await createTenant(a, { name: "Ege Çimento", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: companyA };
  selin = await member(companyA, ayse, "Selin", "project_lead");
  mehmet = await member(companyA, ayse, "Mehmet", "data_owner");
  zeynep = await member(companyA, ayse, "Zeynep", "contributor");
  const e = await makeUser("Ece");
  const auditFirm = await createTenant(e, { name: "Bağımsız Denetim A.Ş.", kind: "advisory", termsVersion: "t" });
  ece = { userId: e.userId, actingTenantId: auditFirm };

  // client A started itself
  const org = await createOrganization(ayse, { name: "Ege Çimento Grubu", sectorCode: "C23" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "Ege Çimento A.Ş.", isReportingParent: true });
  plant = await createFacility(ayse, { legalEntityId: parent, name: "Aliağa Fabrikası", naceCode: "23.51", cbamInstallation: true });
  const p = await createProjectWizard(ayse, { name: "2026 TSRS", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectA = p.projectId;
  cycleA = p.cycleId;
  for (const [who, role] of [
    [selin, "project_lead"],
    [mehmet, "data_owner"],
    [zeynep, "contributor"],
  ] as const)
    await addParticipant(ayse, projectA, { userId: who.userId, memberTenantId: companyA, raciRole: role });
  await approveBoundary(ayse, (await proposeBoundary(ayse, cycleA, "ghg_operational_control")).boundaryId);
  grantId = await grantProjectAccess(ayse, { projectId: projectA, recipientTenantId: advisory, role: "preparer", purpose: "Rapor hazırlığı", days: 90, termsVersion: "t" });
  await grantProjectAccess(ayse, { projectId: projectA, recipientTenantId: auditFirm, role: "assurance", purpose: "Sınırlı güvence (ISAE 3000)", days: 60, canDownload: true, termsVersion: "t" });

  // client B: a provisional client the advisory opened and runs as steward
  const b = await createProvisionalClient(can, { name: "Kuzey Lojistik A.Ş.", contactEmail: "yetkili@kuzey.example.test" });
  const borg = await createOrganization(can, { name: "Kuzey Lojistik", ownerTenantId: b.tenantId });
  const bparent = await createLegalEntity(can, { organizationId: borg, name: "Kuzey Lojistik A.Ş.", isReportingParent: true });
  await createFacility(can, { legalEntityId: bparent, name: "Gebze Depo", naceCode: "52.10" });
  const pb = await createProjectWizard(can, { name: "2026 Sürdürülebilirlik", ownerTenantId: b.tenantId, organizationId: borg, cycle: { reportingYear: 2026 }, planStart: "2026-04-01" });
  projectB = pb.projectId;
  cycleB = pb.cycleId;
}, 180_000);

afterAll(async () => {
  await closeDb();
});

describe("G7 advisory scale, industry packs, external review", () => {
  it("G7-01/08: one portfolio over both clients with operational KPIs — and no ESG grade", async () => {
    const rows = await portfolio(can);
    expect(rows.map((r) => [r.id, r.access]).sort()).toEqual(
      [
        [projectA, "grant"],
        [projectB, "steward"],
      ].sort(),
    );
    const kpis = await portfolioKpis(can);
    expect(kpis.map((k) => k.projectId).sort()).toEqual([projectA, projectB].sort());
    expect(Object.keys(kpis[0]).some((k) => /score|grade|rating/i.test(k))).toBe(false);
  });

  it("G7-04/05: the cement pack is suggested from NACE 23.51, adds its data items, computes clinker ratio and Tier 1 calcination", async () => {
    const packs = await projectPacks(ayse, projectA);
    expect(packs.packs.filter((p) => p.suggested).map((p) => p.id)).toEqual(["cement"]);
    await expect(enablePack(zeynep, projectA, "cement", [plant])).rejects.toMatchObject({ status: 403 });
    await enablePack(ayse, projectA, "cement", [plant]);
    const cmp = await createCampaign(ayse, cycleA, { title: "iklim + çimento", templateIds: ["tsrs_climate_first"] });
    expect((await addPackRequests(ayse, cmp.campaignId)).created).toBeGreaterThanOrEqual(2);
    const rows = await listRequests(ayse, cmp.campaignId);
    const clinker = rows.find((r) => r.metric_code === "ind_clinker_production" && r.facility_id === plant)!;
    const cement = rows.find((r) => r.metric_code === "ind_cement_production" && r.facility_id === plant)!;
    expect((clinker.traces as unknown as { pack: string }[])[0].pack).toBe("cement");
    for (const r of rows.filter((x) => x.id !== clinker.id && x.id !== cement.id)) await closeRequest(ayse, r.id, "not_applicable", "Bu testte yalnız klinker ve çimento üretimi.");
    await assignRequests(ayse, [clinker.id, cement.id], { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId });
    await sendRequests(ayse, [clinker.id, cement.id]);
    const proof = await uploadEvidence(zeynep, projectA, { filename: "uretim-raporu.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% g7\n%%EOF\n") });
    for (const [r, v] of [
      [clinker, "800000"],
      [cement, "1000000"],
    ] as const) {
      await saveDraft(zeynep, r.id, { value: v, unit: "t" });
      await linkEvidence(zeynep, r.id, proof.id);
      await submitTask(zeynep, r.id);
      await acceptTask(mehmet, r.id);
    }
    const run = await runIndustry(selin, cycleA);
    expect(run.reused).toBe(false);
    expect((await runIndustry(selin, cycleA)).reused).toBe(true);
    const facts = await listFacts(selin, cycleA);
    expect(Number(facts.find((f) => f.metric_key === "ind.cement.clinker_ratio")!.value_num)).toBeCloseTo(0.8, 9);
    const calc = facts.find((f) => f.metric_key === "ind.cement.calcination_tco2")!;
    expect(Number(calc.value_num)).toBeCloseTo(800_000 * 0.52 * 1.02, 4);
    expect(Number(calc.estimated_share)).toBe(1);
  });

  it("G7-03/09: the assurer reads and asks, never changes; the company answers with evidence; the assurer closes", async () => {
    const facts = await listFacts(ece, cycleA);
    expect(facts.length).toBeGreaterThan(0);
    const ratio = facts.find((f) => f.metric_key === "ind.cement.clinker_ratio")!;
    await expect(runCalculation(ece, cycleA, { kind: "ghg" })).rejects.toMatchObject({ status: 403 });
    await expect(approveFact(ece, ratio.id)).rejects.toMatchObject({ status: 403 }); // assurance is not internal review
    await expect(askQuestion(selin, cycleA, { targetType: "fact", targetId: ratio.id, question: "Klinker oranının kaynağı nedir?" })).rejects.toMatchObject({ status: 403 }); // only an assurance grant asks
    const q = await askQuestion(ece, cycleA, { targetType: "fact", targetId: ratio.id, question: "Klinker üretimi hangi tartı kayıtlarından alındı?" });
    await expect(answerQuestion(ece, q.id, { answer: "Kendi sorumu yanıtlıyorum burada." })).rejects.toMatchObject({ status: 403 });
    const doc = await uploadEvidence(mehmet, projectA, { filename: "kantar-kayitlari.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% kantar\n%%EOF\n") });
    await answerQuestion(mehmet, q.id, { answer: "Kantar fişleri aylık özetlendi; ekte 12 aylık döküm.", evidenceIds: [doc.id] });
    await closeQuestion(ece, q.id);
    const room = await assuranceRoom(ece, cycleA);
    expect(room.questions.map((x) => x.status)).toEqual(["closed"]);
    expect(room.access).toMatchObject({ via: "grant", grantRole: "assurance" });
    // the engagement and the opinion are the company's record; the opinion needs the provider's file
    const eng = await createEngagement(ayse, cycleA, { standard: "isae3000", level: "limited" });
    await expect(createEngagement(ece, cycleA, { standard: "isae3000", level: "limited" })).rejects.toMatchObject({ status: 403 });
    await expect(setEngagementStatus(ayse, eng.id, { status: "opinion_received" })).rejects.toMatchObject({ code: "opinion_file_required" });
    const opinion = await uploadEvidence(ayse, projectA, { filename: "guvence-raporu.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% opinion\n%%EOF\n") });
    await setEngagementStatus(ayse, eng.id, { status: "opinion_received", opinionEvidenceId: opinion.id });
    expect((await assuranceRoom(ayse, cycleA)).engagement!.status).toBe("opinion_received");
  });

  it("G7 gate: the advisory writes for client A and starts client B's report; revoking A's grant leaves A's report intact", async () => {
    // client A started its report itself; the consultant writes a section through the grant
    const repA = await createReport(selin, cycleA, { templateId: "tsrs_climate_first" });
    const sec = (await getReport(can, repA.reportId)).sections[0];
    await saveSection(can, sec.id, { body: "Danışman taslağı: yönetişim yapısı ve sorumluluklar." });
    await submitSection(can, sec.id);
    // client B: the advisory started the report as steward of the provisional client
    const repB = await createReport(can, cycleB, { templateId: "tsrs_climate_first" });
    expect((await getReport(can, repB.reportId)).sections.length).toBeGreaterThan(0);
    // A ends the engagement: the advisory loses access, the text it wrote stays and A carries on with it
    await revokeGrant(ayse, grantId);
    await expect(getReport(can, repA.reportId)).rejects.toMatchObject({ status: 404 });
    await reviewSection(selin, sec.id, { decision: "approve" });
    const after = await getReport(selin, repA.reportId);
    const s = after.sections.find((x) => x.id === sec.id)!;
    expect([s.status, s.authorName, s.body]).toEqual(["approved", "Can", "Danışman taslağı: yönetişim yapısı ve sorumluluklar."]);
    // client B is untouched by A's decision
    expect((await getReport(can, repB.reportId)).report.id).toBe(repB.reportId);
    expect((await portfolio(can)).map((r) => r.id)).toEqual([projectB]);
  });
});
