/**
 * G5 gate (plan 13): two subsidiaries and two facilities over two cycles; GHG operational control and equity share
 * kept apart (a mid-year sale is day-weighted); revenue consolidated under IFRS 10 with an intercompany
 * elimination; reconciliation; four-eyes review queue; freeze → reopen with a reason → correction → new snapshot
 * that lists the restatement, while the closed snapshot does not change.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ETKB_EDITIONS } from "@/lib/calc/ghg";
import { closeDb, systemDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { addOwnershipEdge, createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addCycle, addParticipant, approveBoundary, createProjectWizard, listBoundaries, proposeBoundary } from "../projects/service";
import { acceptInvitation, createTenant, inviteMember } from "../tenancy/service";
import { acceptTask, assignRequests, closeRequest, createCampaign, linkEvidence, listRequests, saveDraft, sendRequests, submitTask } from "../data/service";
import { approveRun, getRun, listIssues, resolveIssue, runCalculation } from "../calc/service";
import { closeChecklist, consolidationInputs, decideConsolidationInput, freezeCycle, getSnapshot, ghgByBoundary, reopenCycle, reopenRequest, reviewQueue, runFinancialConsolidation, runReconciliation, submitElimination, submitEntityFinancial } from "./service";

let ayse: Actor, selin: Actor, mehmet: Actor, zeynep: Actor;
let company: string, projectId: string, c2025: string, c2026: string;
let holding: string, s1: string, s2: string, f1: string, f2: string;
let proof: string;
const etkb = ETKB_EDITIONS.find((e) => e.year === 2023)!;
const TR = etkb.factors["TR-transmission"].tco2e;
const DIST = etkb.factors["TR-distribution"].tco2e;

async function member(label: string, role: "data_owner" | "contributor" | "project_lead") {
  const u = await makeUser(label);
  await acceptInvitation(u, (await inviteMember(ayse, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: company } as Actor;
}

/** Electricity for both facilities; everything else in the climate template is closed as not applicable. */
async function collect(cycleId: string, mwh: { f1: number; f2: number }) {
  const cmp = await createCampaign(ayse, cycleId, { title: "iklim", templateIds: ["tsrs_climate_first"] });
  const rows = await listRequests(ayse, cmp.campaignId);
  const keep = rows.filter((r) => r.metric_code === "ghg_electricity");
  for (const r of rows.filter((x) => !keep.includes(x))) await closeRequest(ayse, r.id, "not_applicable", "Bu kalem test şirketinde yok.");
  await assignRequests(ayse, keep.map((r) => r.id), { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId });
  await sendRequests(ayse, keep.map((r) => r.id));
  for (const r of keep) {
    await saveDraft(zeynep, r.id, { value: String(r.facility_id === f1 ? mwh.f1 : mwh.f2), unit: "MWh" });
    await linkEvidence(zeynep, r.id, proof);
    await submitTask(zeynep, r.id);
    await acceptTask(mehmet, r.id);
  }
  return keep;
}

/** Selin calculates; Mehmet explains the warnings and approves (four eyes). */
async function calculateAndApprove(cycleId: string, boundaryKind: "ghg_operational_control" | "ghg_equity_share") {
  const r = await runCalculation(selin, cycleId, { kind: "ghg", boundaryKind });
  expect(r.blockers).toBe(0);
  for (const i of (await getRun(selin, r.runId)).issues.filter((x) => x.status === "open")) await resolveIssue(mehmet, i.id, { decision: "accepted_exception", resolution: "Test: bulgu açıklandı ve rapor notuna eklendi." });
  await approveRun(mehmet, r.runId);
  return r.runId;
}

const scope2 = async (cycleId: string, boundary: string) => {
  const g = await ghgByBoundary(selin, cycleId);
  return Number(g.facts.find((f) => f.metric_key === "ghg.scope2.location" && f.facility_id === null && f.boundary_kind === boundary)!.value_num);
};

beforeAll(async () => {
  await ensureBucket();
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Anadolu Metal Holding", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  selin = await member("Selin", "project_lead");
  mehmet = await member("Mehmet", "data_owner");
  zeynep = await member("Zeynep", "contributor");
  const org = await createOrganization(ayse, { name: "Anadolu Metal Grubu" });
  holding = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Metal Holding A.Ş.", isReportingParent: true });
  s1 = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Çelik A.Ş." });
  s2 = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Döküm A.Ş." });
  await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: s1, sharePct: 100, control: "financial", validFrom: "2020-01-01" });
  const e = await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: s2, sharePct: 100, control: "financial", validFrom: "2020-01-01" });
  // 1 July 2026: 40 % of the foundry is sold; the holding keeps 60 % and control
  const { endOwnershipEdge } = await import("../orgs/service");
  await endOwnershipEdge(ayse, e, "2026-06-30");
  await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: s2, sharePct: 60, control: "financial", validFrom: "2026-07-01", sourceNote: "Pay devri" });
  f1 = await createFacility(ayse, { legalEntityId: s1, name: "Gebze Çelik", gridConnection: "transmission" });
  f2 = await createFacility(ayse, { legalEntityId: s2, name: "Manisa Döküm" });
  const p = await createProjectWizard(ayse, { name: "2026 TSRS", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  c2026 = p.cycleId;
  c2025 = (await addCycle(ayse, projectId, { reportingYear: 2025, label: "2025", planStart: "2026-03-01" })).cycleId;
  for (const [who, role] of [
    [selin, "project_lead"],
    [mehmet, "data_owner"],
    [zeynep, "contributor"],
  ] as const)
    await addParticipant(ayse, projectId, { userId: who.userId, memberTenantId: company, raciRole: role });
  for (const c of [c2025, c2026])
    for (const kind of ["ghg_operational_control", "ghg_equity_share"] as const) await approveBoundary(ayse, (await proposeBoundary(ayse, c, kind)).boundaryId);
  await approveBoundary(ayse, (await proposeBoundary(ayse, c2026, "financial_reporting")).boundaryId);
  proof = (await uploadEvidence(zeynep, projectId, { filename: "faturalar.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% g5\n%%EOF\n") })).id;
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe("G5 consolidation and close", () => {
  it("G5-01: operational control and equity share are separate, dated results (mid-year sale day-weighted)", async () => {
    await collect(c2025, { f1: 1000, f2: 500 });
    await collect(c2026, { f1: 1100, f2: 520 });
    for (const c of [c2025, c2026]) for (const k of ["ghg_operational_control", "ghg_equity_share"] as const) await calculateAndApprove(c, k);
    expect(await scope2(c2025, "ghg_operational_control")).toBeCloseTo(1000 * TR + 500 * DIST, 6);
    expect(await scope2(c2025, "ghg_equity_share")).toBeCloseTo(1000 * TR + 500 * DIST, 6);
    const share2026 = Number((await listBoundaries(ayse, c2026)).find((b) => b.kind === "ghg_equity_share" && b.status === "approved")!.members.find((m) => m.facility_id === f2)!.inclusion_pct);
    expect(share2026).toBeCloseTo((100 * 181 + 60 * 184) / 365, 3);
    expect(await scope2(c2026, "ghg_operational_control")).toBeCloseTo(1100 * TR + 520 * DIST, 6);
    expect(await scope2(c2026, "ghg_equity_share")).toBeCloseTo(1100 * TR + 520 * DIST * (share2026 / 100), 4);
  });

  it("G5-02: revenue consolidated under IFRS 10 — subsidiaries at 100 %, intercompany sales eliminated, exact", async () => {
    const inputs = await consolidationInputs(selin, c2026);
    expect(inputs.members.map((m) => [m.name, Number(m.inclusion_pct)]).sort()).toEqual([
      ["Anadolu Çelik A.Ş.", 100],
      ["Anadolu Döküm A.Ş.", 100],
      ["Anadolu Metal Holding A.Ş.", 100],
    ].sort());
    await expect(runFinancialConsolidation(zeynep, c2026)).rejects.toMatchObject({ status: 403 });
    const ids: string[] = [];
    for (const [entity, sales] of [
      [holding, "1.000.000,10"],
      [s1, "500000.20"],
      [s2, "300000"],
    ] as const)
      ids.push((await submitEntityFinancial(mehmet, c2026, { legalEntityId: entity, netSales: sales })).id);
    const el = await submitElimination(mehmet, c2026, { sellerEntityId: s1, buyerEntityId: holding, amount: "100000.05", description: "Çelik satışı (grup içi)" });
    // not approved yet: a blocker, no figure to report
    const early = await runFinancialConsolidation(selin, c2026);
    expect(early.blockers).toBeGreaterThan(0);
    await expect(decideConsolidationInput(mehmet, "financial", ids[0], "approve")).rejects.toMatchObject({ code: "own_work" });
    for (const id of ids) await decideConsolidationInput(ayse, "financial", id, "approve");
    await decideConsolidationInput(ayse, "elimination", el.id, "approve");
    const r = await runFinancialConsolidation(selin, c2026);
    expect(r).toMatchObject({ blockers: 0, consolidatedRevenue: "1700000.25" });
    const fact = (await getRun(selin, r.runId)).facts.find((f) => f.metric_key === "finance.consolidated_net_sales")!;
    expect(fact.value_num).toBe("1700000.250000000000");
    await approveRun(mehmet, r.runId);
  });

  it("G5-03/05: reconciliation runs; the review queue shows only what this person may decide", async () => {
    for (const c of [c2025, c2026]) {
      const r = await runReconciliation(selin, c);
      expect(r.blockers).toBe(0);
      expect(r.checks.find((x) => x.rule === "U8")!.note).toBe("in_runs");
      expect(r.checks.find((x) => x.rule === "U10")!.status).toBe("na");
      // the same facts again: the same run
      expect((await runReconciliation(selin, c)).reused).toBe(true);
    }
    // a corrected figure entered by Mehmet waits for someone else
    await submitEntityFinancial(mehmet, c2026, { legalEntityId: s2, netSales: "300000" });
    expect((await reviewQueue(ayse)).inputs.map((i) => i.entity_name)).toEqual(["Anadolu Döküm A.Ş."]);
    expect((await reviewQueue(mehmet)).inputs).toEqual([]);
    expect((await reviewQueue(zeynep)).inputs).toEqual([]); // no data.review
  });

  it("G5-06/07: the checklist names what blocks the freeze; freezing locks the facts in a digested snapshot", async () => {
    const before = await closeChecklist(selin, c2025);
    expect(before.items.find((i) => i.id === "requests_closed")!.ok).toBe(true);
    expect(before.canFreeze).toBe(true);
    await expect(freezeCycle(mehmet, c2025)).rejects.toMatchObject({ status: 403 }); // cycle.close: owner or project lead
    const s = await freezeCycle(selin, c2025);
    expect(s.version).toBe(1);
    const snap = await getSnapshot(mehmet, s.snapshotId);
    expect(snap.intact).toBe(true);
    expect(snap.snapshot.content_sha256).toBe(s.digest);
    const locked = await systemDb().selectFrom("core.metric_fact_versions").select(["id", "status"]).where("cycle_id", "=", c2025).where("status", "=", "locked").execute();
    expect(locked.length).toBe(snap.facts.length);
    // frozen: no data, no runs, no decisions; a locked fact cannot change even past the service (trigger)
    await expect(runCalculation(selin, c2025, { kind: "ghg" })).rejects.toMatchObject({ code: "cycle_frozen" });
    const req = (await systemDb().selectFrom("core.data_requests").select("id").where("cycle_id", "=", c2025).where("metric_code", "=", "ghg_electricity").where("facility_id", "=", f1).executeTakeFirstOrThrow()).id;
    await expect(reopenRequest(ayse, req, "Fatura düzeltmesi geldi.")).rejects.toMatchObject({ code: "cycle_frozen" });
    await expect(systemDb().updateTable("core.metric_fact_versions").set({ value_num: "1" }).where("id", "=", locked[0].id).execute()).rejects.toMatchObject({ code: "23514" });
  });

  it("G5 gate: reopen with a reason → correction → new snapshot lists the restatement; the closed snapshot is unchanged", async () => {
    const first = (await closeChecklist(selin, c2025)).snapshots[0];
    const v1Before = await getSnapshot(selin, first.id);
    await expect(reopenCycle(selin, c2025, "kısa")).rejects.toMatchObject({ code: "reason_required" });
    await reopenCycle(selin, c2025, "Gebze Çelik Aralık faturası düzeltildi (TEDAŞ iade faturası).");
    const req = (await systemDb().selectFrom("core.data_requests").select("id").where("cycle_id", "=", c2025).where("metric_code", "=", "ghg_electricity").where("facility_id", "=", f1).executeTakeFirstOrThrow()).id;
    await reopenRequest(ayse, req, "Aralık düzeltme faturası eklenecek.");
    await saveDraft(zeynep, req, { value: "1050", unit: "MWh" });
    await submitTask(zeynep, req);
    expect((await reviewQueue(mehmet)).requests.map((r) => r.id)).toEqual([req]);
    expect((await reviewQueue(zeynep)).requests).toEqual([]);
    // while a request is open the checklist says so
    expect((await closeChecklist(selin, c2025)).items.find((i) => i.id === "requests_closed")).toMatchObject({ ok: false, count: 1 });
    await expect(freezeCycle(selin, c2025)).rejects.toMatchObject({ code: "close_checklist_incomplete" });
    await acceptTask(mehmet, req);
    for (const k of ["ghg_operational_control", "ghg_equity_share"] as const) await calculateAndApprove(c2025, k);
    expect(await scope2(c2025, "ghg_operational_control")).toBeCloseTo(1050 * TR + 500 * DIST, 6);
    await runReconciliation(selin, c2025);
    const s2v = await freezeCycle(selin, c2025);
    expect(s2v.version).toBe(2);
    expect(s2v.restated).toBeGreaterThan(0);
    const v2 = await getSnapshot(selin, s2v.snapshotId);
    expect(((v2.snapshot.restated as { metric: string }[]) ?? []).map((r) => r.metric)).toContain("ghg.scope2.location");
    // the first snapshot: same rows, same values, same digest, still intact
    const v1After = await getSnapshot(selin, first.id);
    expect(v1After.intact).toBe(true);
    expect(v1After.snapshot.content_sha256).toBe(v1Before.snapshot.content_sha256);
    expect(v1After.facts.map((f) => [f.metric_key, f.value_num])).toEqual(v1Before.facts.map((f) => [f.metric_key, f.value_num]));
    expect(v1After.snapshot.status).toBe("superseded");
    const oldS2 = v1After.facts.find((f) => f.metric_key === "ghg.scope2.location" && f.facility_id === null && f.boundary_kind === "ghg_operational_control")!;
    expect(Number(oldS2.value_num)).toBeCloseTo(1000 * TR + 500 * DIST, 6);
    const events = (await closeChecklist(selin, c2025)).events.map((e) => e.action);
    expect(events).toEqual(["freeze", "reopen", "freeze"]);
    expect((await listIssues(selin, c2025)).length).toBe(0);
  });
});
