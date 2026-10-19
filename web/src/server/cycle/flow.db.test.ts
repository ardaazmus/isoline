/**
 * The seven-step cycle and the single inbox over a real database (UX review 19.10.2026): a reporting cycle goes
 * from scope to freeze and, at every point, the derived step, the close checklist and each person's inbox agree
 * with what was recorded — the contributor sees what to enter, the reviewer what to accept, the approver every
 * metric of a run including facility-level ones, and nobody sees their own work for approval.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, approveBoundary, createProjectWizard, proposeBoundary } from "../projects/service";
import { acceptInvitation, createTenant, inviteMember } from "../tenancy/service";
import { acceptTask, assignRequests, closeRequest, createCampaign, linkEvidence, listRequests, saveDraft, sendRequests, submitTask } from "../data/service";
import { approveRun, getRun, resolveIssue, runCalculation } from "../calc/service";
import { closeChecklist, freezeCycle, runReconciliation } from "../close/service";
import { myInbox } from "../inbox/service";
import { cycleProgress, latestCycles } from "./progress";

let ayse: Actor, selin: Actor, mehmet: Actor, zeynep: Actor;
let company: string, projectId: string, cycle: string, proof: string;
let keep: { id: string }[] = [];

async function member(label: string, role: "data_owner" | "contributor" | "project_lead") {
  const u = await makeUser(label);
  await acceptInvitation(u, (await inviteMember(ayse, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: company } as Actor;
}

const states = async () => {
  const p = (await cycleProgress(ayse, cycle))!;
  return { current: p.current, by: Object.fromEntries(p.steps.map((s) => [s.id, s.state])) as Record<string, string>, p };
};

beforeAll(async () => {
  await ensureBucket();
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Akış Gıda A.Ş.", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  selin = await member("Selin", "project_lead");
  mehmet = await member("Mehmet", "data_owner");
  zeynep = await member("Zeynep", "contributor");
  const org = await createOrganization(ayse, { name: "Akış Grubu" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "Akış Gıda A.Ş.", isReportingParent: true });
  await createFacility(ayse, { legalEntityId: parent, name: "Bursa Fabrikası", gridConnection: "distribution" });
  await createFacility(ayse, { legalEntityId: parent, name: "Konya Fabrikası", gridConnection: "distribution" });
  const p = await createProjectWizard(ayse, { name: "2026 TSRS", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  cycle = p.cycleId;
  for (const [who, role] of [
    [selin, "project_lead"],
    [mehmet, "data_owner"],
    [zeynep, "contributor"],
  ] as const)
    await addParticipant(ayse, projectId, { userId: who.userId, memberTenantId: company, raciRole: role });
  proof = (await uploadEvidence(zeynep, projectId, { filename: "fatura.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% flow\n%%EOF\n") })).id;
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe("seven-step cycle and the single inbox", () => {
  it("starts at scope; nothing to collect or calculate yet", async () => {
    const s = await states();
    expect(s.current).toBe("scope");
    expect(s.by).toMatchObject({ scope: "not_started", collect: "not_started", calculate: "waiting", close: "waiting", assurance: "optional" });
    // the plan's dates and owners travel with the steps
    expect(s.p.steps.find((x) => x.id === "calculate")!.dueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("an approved GHG boundary finishes scope; collection becomes the next step", async () => {
    await approveBoundary(ayse, (await proposeBoundary(ayse, cycle, "ghg_operational_control")).boundaryId);
    const s = await states();
    expect(s.by.scope).toBe("done");
    expect(s.by.collect).toBe("ready");
    expect(s.current).toBe("collect");
  });

  it("the contributor's inbox lists what to enter; the reviewer's what to accept", async () => {
    const cmp = await createCampaign(ayse, cycle, { title: "iklim", templateIds: ["tsrs_climate_first"] });
    const rows = await listRequests(ayse, cmp.campaignId);
    keep = rows.filter((r) => r.metric_code === "ghg_electricity");
    expect(keep.length).toBe(2);
    for (const r of rows.filter((x) => !keep.some((k) => k.id === x.id))) await closeRequest(ayse, r.id, "not_applicable", "Bu kalem test şirketinde yok.");
    await assignRequests(ayse, keep.map((r) => r.id), { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId });
    await sendRequests(ayse, keep.map((r) => r.id));
    expect((await states()).by.collect).toBe("active");
    expect((await myInbox(zeynep)).enter.map((x) => x.id).sort()).toEqual(keep.map((r) => r.id).sort());
    expect((await myInbox(mehmet)).reviewData).toEqual([]);
    for (const r of keep) {
      await saveDraft(zeynep, r.id, { value: "800", unit: "MWh" });
      await linkEvidence(zeynep, r.id, proof);
      await submitTask(zeynep, r.id);
    }
    const m = await myInbox(mehmet);
    expect(m.reviewData.length).toBe(2);
    expect(m.total).toBeGreaterThanOrEqual(2);
    expect((await myInbox(zeynep)).enter).toEqual([]);
    for (const r of keep) await acceptTask(mehmet, r.id);
    const s = await states();
    expect(s.by.collect).toBe("done");
    expect(s.by.calculate).toBe("ready");
  });

  it("after a run the approver sees every metric of it, facility-level included; the performer sees none", async () => {
    const r = await runCalculation(selin, cycle, { kind: "ghg", boundaryKind: "ghg_operational_control" });
    const run = await getRun(selin, r.runId);
    const waiting = run.facts.filter((f) => f.status === "ready_for_review");
    expect(waiting.some((f) => f.facility_id !== null)).toBe(true);
    const m = await myInbox(mehmet);
    const box = m.runs.find((x) => x.runId === r.runId)!;
    expect(box.count).toBe(waiting.length);
    expect(box.facilityLevel).toBe(waiting.filter((f) => f.facility_id !== null).length);
    expect((await myInbox(selin)).runs.find((x) => x.runId === r.runId)).toBeUndefined();
    expect((await myInbox(zeynep)).runs).toEqual([]);

    const s = await states();
    expect(s.current).toBe("calculate");
    expect(s.by.calculate).toBe("active");
    // the close checklist and the step count the same metrics
    expect((await closeChecklist(selin, cycle)).items.find((i) => i.id === "facts_approved")!.count).toBe(s.p.signals.facts.notApproved);

    for (const i of run.issues.filter((x) => x.status === "open")) await resolveIssue(mehmet, i.id, { decision: "accepted_exception", resolution: "Test: bulgu açıklandı ve rapor notuna eklendi." });
    await approveRun(mehmet, r.runId);
    expect((await myInbox(mehmet)).runs).toEqual([]);
    const after = await states();
    expect(after.by.calculate).toBe("done");
    expect(after.current).toBe("controls");
    expect(after.p.steps.find((x) => x.id === "controls")!.summary).toBe("todo_reconcile");
  });

  it("reconciliation finishes controls; the close becomes ready, then done; the home view agrees", async () => {
    await runReconciliation(selin, cycle);
    let s = await states();
    expect(s.by.controls).toBe("done");
    expect(s.by.close).toBe("ready");
    expect(s.p.checklist.canFreeze).toBe(true);
    expect((await closeChecklist(selin, cycle)).canFreeze).toBe(true);
    await freezeCycle(selin, cycle);
    s = await states();
    expect(s.by.close).toBe("done");
    expect(s.current).toBe("report");
    const home = await latestCycles(ayse);
    expect(home.get(projectId)!.progress.current).toBe("report");
    // the contributor reads the same state (project.read), never more
    expect((await latestCycles(zeynep)).get(projectId)!.progress.current).toBe("report");
  });
});
