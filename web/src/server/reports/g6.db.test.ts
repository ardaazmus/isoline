/**
 * G6 gate (plan 13): a company loads data and produces two reports; an outside consultant drafts the text; the
 * technical reviewer, the customer and the management sign off; a DOCX / chart / asset-manifest package comes
 * out; a design agency sees the release only; when a source changes later, the old release stays as it was and
 * the correction is an amended release.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, approveBoundary, createProjectWizard, proposeBoundary } from "../projects/service";
import { acceptInvitation, createTenant, grantProjectAccess, inviteMember, type Identity } from "../tenancy/service";
import { acceptTask, assignRequests, closeRequest, createCampaign, linkEvidence, listRequests, saveDraft, sendRequests, submitTask } from "../data/service";
import { approveRun, getRun, listFacts, resolveIssue, runCalculation } from "../calc/service";
import { freezeCycle, reopenCycle, reopenRequest, runReconciliation } from "../close/service";
import { unzipStored } from "./zip";
import { assetBytes, createReport, crossReportCheck, decideProof, decideStage, getReport, handoffReleases, releaseAssets, releaseReport, requestReview, reviewSection, saveSection, submitSection, uploadProof } from "./service";

let ayse: Actor, selin: Actor, mehmet: Actor, zeynep: Actor, elif: Actor, can: Actor, designer: Actor;
let company: string, projectId: string, cycleId: string, elecRequest: string;
let tsrs: string, gri: string, release1: string;

async function member(tenant: string, inviter: Actor, label: string, role: Parameters<typeof inviteMember>[1]["role"]): Promise<Actor> {
  const u: Identity = await makeUser(label);
  await acceptInvitation(u, (await inviteMember(inviter, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: tenant };
}

async function calculateApprove() {
  const r = await runCalculation(selin, cycleId, { kind: "ghg" });
  for (const i of (await getRun(selin, r.runId)).issues.filter((x) => x.status === "open")) await resolveIssue(mehmet, i.id, { decision: "accepted_exception", resolution: "Test: bulgu açıklandı, rapor notuna eklendi." });
  if (!r.reused) await approveRun(mehmet, r.runId);
  await runReconciliation(selin, cycleId);
}

/** Can (the consultant, through a preparer grant) drafts; Selin approves each section. */
async function writeAll(reportId: string, special: Record<string, string> = {}) {
  const rep = await getReport(selin, reportId);
  for (const s of rep.sections) {
    const body = special[s.key] ?? `# ${s.title}\n\nBu bölüm ${s.key} gerekliliklerini karşılar; yöntem ve sınırlar açıklanmıştır.`;
    await saveSection(can, s.id, { body });
    await submitSection(can, s.id);
    await reviewSection(selin, s.id, { decision: "approve" });
  }
}

async function chain(reportId: string) {
  await requestReview(can, reportId);
  await decideStage(selin, reportId, { decision: "approved" });
  await decideStage(ayse, reportId, { decision: "approved" });
  await decideStage(elif, reportId, { decision: "approved" });
}

beforeAll(async () => {
  await ensureBucket();
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Anadolu Enerji", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  selin = await member(company, ayse, "Selin", "project_lead");
  mehmet = await member(company, ayse, "Mehmet", "data_owner");
  zeynep = await member(company, ayse, "Zeynep", "contributor");
  elif = await member(company, ayse, "Elif", "management_signer");
  const c = await makeUser("Can");
  const advisory = await createTenant(c, { name: "Yeşil Eşik Danışmanlık", kind: "advisory", termsVersion: "t" });
  can = { userId: c.userId, actingTenantId: advisory };
  const d = await makeUser("Deniz");
  const agency = await createTenant(d, { name: "Tasarım Atölyesi", kind: "advisory", termsVersion: "t" });
  designer = { userId: d.userId, actingTenantId: agency };

  const org = await createOrganization(ayse, { name: "Anadolu Enerji Grubu" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Enerji A.Ş.", isReportingParent: true });
  await createFacility(ayse, { legalEntityId: parent, name: "Bursa", gridConnection: "distribution" });
  const p = await createProjectWizard(ayse, { name: "2026 raporları", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  cycleId = p.cycleId;
  for (const [who, role] of [
    [selin, "project_lead"],
    [mehmet, "data_owner"],
    [zeynep, "contributor"],
  ] as const)
    await addParticipant(ayse, projectId, { userId: who.userId, memberTenantId: company, raciRole: role });
  await approveBoundary(ayse, (await proposeBoundary(ayse, cycleId, "ghg_operational_control")).boundaryId);
  await grantProjectAccess(ayse, { projectId, recipientTenantId: advisory, role: "preparer", purpose: "Rapor metni hazırlığı", days: 90, termsVersion: "t" });
  await grantProjectAccess(ayse, { projectId, recipientTenantId: agency, role: "design", purpose: "Rapor tasarımı", days: 90, termsVersion: "t" });

  // the company loads its data: electricity for the plant, accepted by someone else
  const cmp = await createCampaign(ayse, cycleId, { title: "iklim", templateIds: ["tsrs_climate_first"] });
  const rows = await listRequests(ayse, cmp.campaignId);
  const el = rows.find((r) => r.metric_code === "ghg_electricity")!;
  elecRequest = el.id;
  for (const r of rows.filter((x) => x.id !== el.id)) await closeRequest(ayse, r.id, "not_applicable", "Bu kalem test şirketinde yok.");
  await assignRequests(ayse, [el.id], { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId });
  await sendRequests(ayse, [el.id]);
  const proof = await uploadEvidence(zeynep, projectId, { filename: "fatura.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% g6\n%%EOF\n") });
  await saveDraft(zeynep, el.id, { value: "4000", unit: "MWh" });
  await linkEvidence(zeynep, el.id, proof.id);
  await submitTask(zeynep, el.id);
  await acceptTask(mehmet, el.id);
  await calculateApprove();
}, 180_000);

afterAll(async () => {
  await closeDb();
});

describe("G6 report studio and release", () => {
  it("G6-01/02: two reports from one cycle; numbers are bound tokens, never typed digits", async () => {
    tsrs = (await createReport(selin, cycleId, { templateId: "tsrs_climate_first" })).reportId;
    gri = (await createReport(can, cycleId, { templateId: "gri", language: "en" })).reportId;
    const rep = await getReport(selin, tsrs);
    expect(rep.sections.length).toBeGreaterThan(3);
    const ghgSection = rep.sections.find((s) => s.key === "ghg_s12")!;
    const saved = await saveSection(can, ghgSection.id, { body: "# Emisyonlar\n\nKapsam 2 (lokasyon bazlı) {{ghg.scope2.location}} oldu; {{env.waste_t}} henüz yok.\n\n[[table:ghg]]\n[[chart:ghg_scopes]]" });
    expect(saved.unresolved).toEqual(["{{env.waste_t}}"]);
    await expect(submitSection(can, ghgSection.id)).rejects.toMatchObject({ code: "unresolved_tokens" });
    // optimistic locking: a stale base version is refused
    await expect(saveSection(selin, ghgSection.id, { body: "x", baseVersion: 0 })).rejects.toMatchObject({ code: "version_conflict" });
    await writeAll(tsrs, { ghg_s12: "# Emisyonlar\n\nKapsam 2 (lokasyon bazlı) {{ghg.scope2.location}} oldu.\n\n[[table:ghg]]\n[[chart:ghg_scopes]]\n> Kaynak: ETKB 2023, IPCC AR6" });
    const after = await getReport(selin, tsrs);
    const ref = after.sections.find((s) => s.key === "ghg_s12")!.references[0];
    expect(ref.rendered).toMatch(/tCO₂e$/);
    expect(after.coverage).toMatchObject({ met: after.sections.length, pending: 0 });
  });

  it("G6-05: the author never approves her own section; stages run in order on the same candidate", async () => {
    const rep = await getReport(selin, gri);
    const first = rep.sections[0];
    await saveSection(can, first.id, { body: "Scope 1 and 2: {{ghg.scope2.location}}." });
    await submitSection(can, first.id);
    await expect(reviewSection(can, first.id, { decision: "approve" })).rejects.toMatchObject({ status: 403 });
    await reviewSection(selin, first.id, { decision: "reject", note: "Yöntem notu eksik, ekleyin." });
    await writeAll(gri, { [first.key]: "Our scope 2 (location-based) was {{ghg.scope2.location}}. Our products are carbon neutral." });
    await requestReview(can, gri);
    await decideStage(selin, gri, { decision: "approved" });
    // a grant never signs for the customer
    await expect(decideStage(can, gri, { decision: "approved" })).rejects.toMatchObject({ status: 403 });
    await decideStage(ayse, gri, { decision: "approved" });
    await expect(decideStage(selin, gri, { decision: "approved" })).rejects.toMatchObject({ status: 403 }); // sign-off needs report.release
    await decideStage(elif, gri, { decision: "approved" });
  });

  it("G6-08: no release before the cycle is frozen; a blocking green claim stops the release", async () => {
    await chain(tsrs);
    await expect(releaseReport(elif, tsrs)).rejects.toMatchObject({ code: "cycle_not_frozen" });
    await freezeCycle(selin, cycleId);
    await expect(releaseReport(elif, gri)).rejects.toMatchObject({ code: "claims_blocked" });
    await expect(releaseReport(can, tsrs)).rejects.toMatchObject({ status: 403 });
  });

  it("G6-04/06: the package — DOCX, CSV, XLSX, SVG, index, notes, manifest, hand-off ZIP — carries one number everywhere", async () => {
    const r = await releaseReport(elif, tsrs);
    release1 = r.releaseId;
    expect(r.version).toBe(1);
    const { release, assets } = await releaseAssets(selin, release1);
    expect(assets.map((a) => a.path).sort()).toEqual(["asset-manifest.json", "charts/ghg_scopes.svg", "content.docx", "disclosure-index-draft.csv", "handoff.zip", "review-notes.md", "tables/facts.csv", "tables/facts.xlsx"]);
    const text = async (p: string) => new TextDecoder().decode((await assetBytes(selin, assets.find((a) => a.path === p)!.id)).data);
    const manifest = JSON.parse(await text("asset-manifest.json"));
    const s2 = manifest.facts.find((f: { key: string }) => f.key === "ghg.scope2.location");
    const shown = (await getReport(selin, tsrs)).sections.find((s) => s.key === "ghg_s12")!.references[0].rendered!;
    expect(await text("tables/facts.csv")).toContain(shown);
    expect(await text("charts/ghg_scopes.svg")).toContain(shown);
    const docx = unzipStored((await assetBytes(selin, assets.find((a) => a.path === "handoff.zip")!.id)).data).find((f) => f.path === "content.docx")!;
    expect(docx.crcOk).toBe(true);
    expect(s2.id).toBeTruthy();
    expect(release.manifest_sha256).toMatch(/^[0-9a-f]{64}$/);
    for (const a of assets) expect((await assetBytes(selin, a.id)).intact).toBe(true);
  });

  it("G6-07: the design agency sees the release only — no project data — and the customer decides its proofs", async () => {
    await expect(listFacts(designer, cycleId)).rejects.toMatchObject({ status: 404 });
    await expect(getReport(designer, tsrs)).rejects.toMatchObject({ status: 404 });
    expect((await handoffReleases(designer)).map((r) => r.id)).toEqual([release1]);
    expect((await releaseAssets(designer, release1)).assets.length).toBe(8);
    const pdf = new TextEncoder().encode("%PDF-1.4\n% prova 1\n%%EOF\n");
    await expect(uploadProof(designer, release1, { filename: "prova.png", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) })).rejects.toMatchObject({ code: "pdf_required" });
    await expect(uploadProof(can, release1, { filename: "p.pdf", bytes: pdf })).rejects.toMatchObject({ status: 404 }); // not a design grant
    const p = await uploadProof(designer, release1, { filename: "prova-1.pdf", bytes: pdf });
    await expect(decideProof(ayse, p.proofId, { decision: "changes_requested", note: "kısa" })).rejects.toMatchObject({ code: "reason_required" });
    await decideProof(ayse, p.proofId, { decision: "changes_requested", note: "Kapakta logo eski sürüm; güncelleyin." });
  });

  it("G6-09: the same metric in two reports is the same fact", async () => {
    const x = await crossReportCheck(selin, cycleId);
    const s2 = x.find((r) => r.key.startsWith("ghg.scope2.location"))!;
    expect(s2.reports.length).toBe(2);
    expect(s2.consistent).toBe(true);
  });

  it("G6 gate: a later source change leaves release 1 untouched; the correction is an amended release", async () => {
    const before = await releaseAssets(selin, release1);
    await reopenCycle(selin, cycleId, "Bursa elektrik faturasında düzeltme (TEDAŞ iade faturası).");
    await reopenRequest(ayse, elecRequest, "Düzeltme faturası eklenecek.");
    await saveDraft(zeynep, elecRequest, { value: "4200", unit: "MWh" });
    await submitTask(zeynep, elecRequest);
    await acceptTask(mehmet, elecRequest);
    await calculateApprove();
    // the report's numbers are now stale and the release cannot be repeated
    const stale = await getReport(selin, tsrs);
    expect(stale.sections.find((s) => s.key === "ghg_s12")!.references[0].stale).toBe(true);
    await freezeCycle(selin, cycleId);
    // re-bind: a new version of the section with the same text, approved again, then the whole chain
    const sec = stale.sections.find((s) => s.key === "ghg_s12")!;
    await saveSection(can, sec.id, { body: sec.body });
    await submitSection(can, sec.id);
    await reviewSection(selin, sec.id, { decision: "approve" });
    await chain(tsrs);
    await expect(releaseReport(elif, tsrs)).rejects.toMatchObject({ code: "amendment_reason_required" });
    const r2 = await releaseReport(elif, tsrs, { amendmentReason: "Bursa elektrik tüketimi düzeltildi; kapsam 2 yeniden hesaplandı." });
    expect(r2.version).toBe(2);
    const after = await releaseAssets(selin, release1);
    expect(after.release.status).toBe("superseded");
    expect(after.release.manifest_sha256).toBe(before.release.manifest_sha256);
    expect(after.assets.map((a) => a.sha256)).toEqual(before.assets.map((a) => a.sha256));
    for (const a of after.assets) expect((await assetBytes(selin, a.id)).intact).toBe(true);
    const m2 = (await releaseAssets(selin, r2.releaseId)).release.manifest as { amendmentOf: string; facts: { key: string; value: string }[] };
    expect(m2.amendmentOf).toBe(release1);
    const m1 = before.release.manifest as { facts: { key: string; value: string }[] };
    const v = (m: typeof m1) => Number(m.facts.find((f) => f.key === "ghg.scope2.location")!.value);
    expect(v(m2)).toBeCloseTo(v(m1) * 4200 / 4000, 6);
  });
});
