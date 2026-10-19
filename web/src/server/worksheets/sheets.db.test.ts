/**
 * UX Faz 3 over a real database: cycle worksheets are versioned and approved by a second person; the taxonomy run
 * turns the approved sheet into metrics that wait for approval; U6 reads the approved taxonomy and the transition
 * plan; submitted sheets reach the approver's inbox; an annual report checklist binds to its report; quick
 * calculation inputs become drafts of the person's own data requests only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { ensureBucket } from "../evidence/storage";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, approveBoundary, createProjectWizard, proposeBoundary } from "../projects/service";
import { acceptInvitation, createTenant, inviteMember } from "../tenancy/service";
import { assignRequests, closeRequest, createCampaign, listRequests, sendRequests } from "../data/service";
import { getRun } from "../calc/service";
import { runReconciliation } from "../close/service";
import { createReport } from "../reports/service";
import { myInbox } from "../inbox/service";
import { quickTargets, saveQuickDrafts } from "../quick/service";
import { approveWorksheet, getWorksheet, returnWorksheet, runTaxonomy, saveWorksheet, submitWorksheet } from "./service";

let ayse: Actor, selin: Actor, mehmet: Actor, zeynep: Actor;
let company: string, projectId: string, cycle: string;

async function member(label: string, role: "data_owner" | "contributor" | "project_lead") {
  const u = await makeUser(label);
  await acceptInvitation(u, (await inviteMember(ayse, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: company } as Actor;
}

const materiality = { threshold: 3, topics: [{ id: "E1", name: "İklim değişikliği", pillar: "E", positive: false, scale: 4, scope: 4, irremediability: 3, impactLikelihood: 5, magnitude: 4, financialLikelihood: 4 }] };
const taxonomy = {
  totals: { turnover: 1000, capex: 400, opex: 100 },
  activities: [{ id: "a1", name: "Çatı güneş enerjisi santrali", code: "4.1", turnover: 0, capex: 300, opex: 0, eligible: true, aligned: true }],
  notAssessed: [],
};

beforeAll(async () => {
  await ensureBucket();
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Sayfa Gıda A.Ş.", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  selin = await member("Selin", "project_lead");
  mehmet = await member("Mehmet", "data_owner");
  zeynep = await member("Zeynep", "contributor");
  const org = await createOrganization(ayse, { name: "Sayfa Grubu" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "Sayfa Gıda A.Ş.", isReportingParent: true });
  await createFacility(ayse, { legalEntityId: parent, name: "İzmir Fabrikası", gridConnection: "distribution" });
  const p = await createProjectWizard(ayse, { name: "2026 TSRS", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  cycle = p.cycleId;
  for (const [who, role] of [
    [selin, "project_lead"],
    [mehmet, "data_owner"],
    [zeynep, "contributor"],
  ] as const)
    await addParticipant(ayse, projectId, { userId: who.userId, memberTenantId: company, raciRole: role });
  await approveBoundary(ayse, (await proposeBoundary(ayse, cycle, "ghg_operational_control")).boundaryId);
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe("cycle worksheets", () => {
  it("materiality: saved by one person, approved by another member, never by its author", async () => {
    await expect(saveWorksheet(zeynep, cycle, "materiality", materiality)).rejects.toMatchObject({ status: 403 });
    await expect(saveWorksheet(selin, cycle, "materiality", { threshold: 9, topics: [] })).rejects.toMatchObject({ code: "invalid_worksheet" });
    const v1 = await saveWorksheet(selin, cycle, "materiality", materiality);
    expect(v1.version).toBe(1);
    await expect(approveWorksheet(ayse, v1.id)).rejects.toMatchObject({ code: "invalid_transition" }); // a draft is submitted first
    await submitWorksheet(selin, v1.id);
    await expect(approveWorksheet(selin, v1.id)).rejects.toMatchObject({ code: "own_work" });
    await returnWorksheet(ayse, v1.id, "Konu kapsamı eksik, S1 de eklenmeli.");
    const v2 = await saveWorksheet(selin, cycle, "materiality", { ...materiality, topics: [...materiality.topics, { ...materiality.topics[0], id: "S1", name: "Kendi işgücü", pillar: "S" }] });
    await submitWorksheet(selin, v2.id);
    await approveWorksheet(ayse, v2.id);
    const w = await getWorksheet(zeynep, cycle, "materiality");
    expect(w.approved).toMatchObject({ version: 2, status: "approved" });
    expect(w.versions).toBe(2);
  });

  it("taxonomy: the approved sheet becomes twelve metrics awaiting approval; the same version reuses the run", async () => {
    await expect(runTaxonomy(selin, cycle)).rejects.toMatchObject({ code: "worksheet_not_approved" });
    const s = await saveWorksheet(mehmet, cycle, "taxonomy", taxonomy);
    await submitWorksheet(mehmet, s.id);
    // the approver's inbox lists the submitted sheet; the author's does not
    expect((await myInbox(selin)).sheets.map((x) => x.id)).toContain(s.id);
    expect((await myInbox(mehmet)).sheets.map((x) => x.id)).not.toContain(s.id);
    await approveWorksheet(selin, s.id);
    expect((await myInbox(selin)).sheets.map((x) => x.id)).not.toContain(s.id);
    const r = await runTaxonomy(selin, cycle);
    expect(r).toMatchObject({ reused: false, facts: 12, blockers: 0 });
    const run = await getRun(selin, r.runId);
    const aligned = run.facts.find((f) => f.metric_key === "taxonomy.capex.aligned")!;
    expect(Number(aligned.value_num)).toBeCloseTo(0.75, 10);
    expect(run.facts.every((f) => f.status === "ready_for_review")).toBe(true);
    expect((await runTaxonomy(selin, cycle)).reused).toBe(true);
  });

  it("U6: a material aligned investment without a matching transition-plan measure is a warning until the plan names it", async () => {
    const first = await runReconciliation(selin, cycle);
    expect(first.checks.find((c) => c.rule === "U6")).toMatchObject({ status: "fail", severity: "warning", items: ["Çatı güneş enerjisi santrali"] });
    // a scenario sheet needs no approval: the saved plan is what U6 reads
    await saveWorksheet(selin, cycle, "pathway", { baseYear: 2024, baseScope12: 5000, baseScope3: null, scope2Share: null, targetYear: 2030, bauGrowth: 0, measures: [{ id: "m1", name: "Güneş enerjisi santrali (çatı)", abatement: 400, cost: -10, startYear: 2026, rampYears: 1 }] });
    const second = await runReconciliation(selin, cycle);
    expect(second.checks.find((c) => c.rule === "U6")!.status).toBe("pass");
  });

  it("annual report checklist binds to an annual report only", async () => {
    const tsrs = await createReport(selin, cycle, { templateId: "tsrs_climate_first" });
    await expect(saveWorksheet(selin, cycle, "annual_report", { profile: "ttk", items: {} }, { reportId: tsrs.reportId })).rejects.toMatchObject({ code: "not_annual_report" });
    const ar = await createReport(selin, cycle, { templateId: "ar_ttk" });
    await expect(saveWorksheet(selin, cycle, "annual_report", { profile: "ttk", items: {} })).rejects.toMatchObject({ code: "report_required" });
    const s = await saveWorksheet(selin, cycle, "annual_report", { profile: "ttk", items: { principles: { status: "met" } } }, { reportId: ar.reportId });
    await submitWorksheet(selin, s.id);
    await approveWorksheet(ayse, s.id);
    expect((await getWorksheet(selin, cycle, "annual_report", ar.reportId)).approved?.version).toBe(1);
  });

  it("quick calculation inputs become drafts of the person's own open requests only", async () => {
    const cmp = await createCampaign(ayse, cycle, { title: "iklim", templateIds: ["tsrs_climate_first"] });
    const rows = await listRequests(ayse, cmp.campaignId);
    const elec = rows.filter((r) => r.metric_code === "ghg_electricity");
    for (const r of rows.filter((x) => x.metric_code !== "ghg_electricity")) await closeRequest(ayse, r.id, "not_applicable", "Bu kalem test şirketinde yok.");
    await assignRequests(ayse, elec.map((r) => r.id), { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId });
    await sendRequests(ayse, elec.map((r) => r.id));
    const targets = await quickTargets(zeynep, ["ghg_electricity", "ghg_stationary"]);
    expect(targets.map((x) => x.id).sort()).toEqual(elec.map((r) => r.id).sort());
    expect(await quickTargets(mehmet, ["ghg_electricity"])).toEqual([]);
    const draft = { metric: "ghg_electricity", value: 1200, unit: "MWh" };
    expect(await saveQuickDrafts(zeynep, [{ requestId: elec[0].id, draft }])).toEqual([{ requestId: elec[0].id, ok: true }]);
    const other = await saveQuickDrafts(mehmet, [{ requestId: elec[0].id, draft }]);
    expect(other[0].ok).toBe(false);
  });
});
