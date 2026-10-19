/**
 * G4 gate (plan 13): one emission metric and one finance metric recomputed from all their inputs, with the exact
 * factor version and source; idempotent runs; blockers vs warnings with a reviewer's reason; four-eyes approval;
 * a project factor choice that changes the result as a new revision; lineage from fact to evidence.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ETKB_EDITIONS } from "@/lib/calc/ghg";
import { trialBalanceCsv } from "@/lib/trial-balance";
import { closeDb, systemDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { runOnce } from "../jobs/worker";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, approveBoundary, createProjectWizard, proposeBoundary } from "../projects/service";
import { acceptInvitation, createTenant, inviteMember } from "../tenancy/service";
import { acceptTask, assignRequests, closeRequest, createCampaign, linkEvidence, listRequests, saveDraft, sendRequests, submitTask, type DraftInput } from "../data/service";
import { addCustomSet, chooseFactor, listChoices, listFactorSets } from "./factors";
import { approveFact, approveRun, factLineage, getRun, listFacts, listIssues, listRuns, rejectFact, reproduceRun, resolveIssue, runCalculation } from "./service";
import { calculationsView } from "./view";
import { listBoundaries } from "../projects/service";

let ayse: Actor, selin: Actor, mehmet: Actor, zeynep: Actor, outsider: Actor;
let company: string, projectId: string, cycleId: string, campaignId: string;
let gebze: string, dilovasi: string;
let ghgRun1: string, finRun: string;

const KEEP = ["ghg_stationary", "ghg_electricity", "ghg_refrigerants", "ghg_certificates", "net_sales", "tb_export"];
const etkb2023 = ETKB_EDITIONS.find((e) => e.year === 2023)!;
const TB = trialBalanceCsv(
  [
    ["600", "Yurt İçi Satışlar", 0, 1_250_000_000],
    ["610", "Satıştan İadeler (-)", 12_500_000, 0],
    ["100", "Kasa", 1_237_500_000, 0],
  ],
  "Anadolu Metal A.Ş. Mizan 01.01.2026 - 31.12.2026",
);

async function member(label: string, role: "data_owner" | "contributor" | "project_lead") {
  const u = await makeUser(label);
  await acceptInvitation(u, (await inviteMember(ayse, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: company } as Actor;
}

beforeAll(async () => {
  await ensureBucket();
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Anadolu Metal", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  selin = await member("Selin", "project_lead");
  mehmet = await member("Mehmet", "data_owner");
  zeynep = await member("Zeynep", "contributor");
  const o = await makeUser("Other");
  outsider = { userId: o.userId, actingTenantId: await createTenant(o, { name: "Başka A.Ş.", kind: "company", termsVersion: "t" }) };

  const org = await createOrganization(ayse, { name: "Anadolu Metal Grubu" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Metal A.Ş.", isReportingParent: true });
  gebze = await createFacility(ayse, { legalEntityId: parent, name: "Gebze", gridConnection: "transmission" });
  dilovasi = await createFacility(ayse, { legalEntityId: parent, name: "Dilovası" });
  const p = await createProjectWizard(ayse, { name: "2026 TSRS", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  cycleId = p.cycleId;
  for (const [who, role] of [
    [selin, "project_lead"],
    [mehmet, "data_owner"],
    [zeynep, "contributor"],
  ] as const)
    await addParticipant(ayse, projectId, { userId: who.userId, memberTenantId: company, raciRole: role });
  const b = await proposeBoundary(ayse, cycleId, "ghg_operational_control");
  await approveBoundary(ayse, b.boundaryId);

  campaignId = (await createCampaign(ayse, cycleId, { title: "2026 iklim ve finans", templateIds: ["gri", "ar_ttk"] })).campaignId;
  const rows = await listRequests(ayse, campaignId);
  // what this company does not have is closed with a reason; mobile fuel stays open on purpose (a blocker later)
  for (const r of rows.filter((x) => !KEEP.includes(x.metric_code) && x.metric_code !== "ghg_mobile")) await closeRequest(ayse, r.id, "not_applicable", "Bu kalem 2026 kapsamında yok (test).");
  const keep = rows.filter((x) => KEEP.includes(x.metric_code) || x.metric_code === "ghg_mobile");
  await assignRequests(ayse, keep.map((r) => r.id), { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId, dueOn: "2027-01-31" });
  await sendRequests(ayse, keep.map((r) => r.id));

  const proof = await uploadEvidence(zeynep, projectId, { filename: "sayac-fatura-2026.pdf", bytes: new TextEncoder().encode("%PDF-1.4\n% faturalar\n%%EOF\n") });
  const tbFile = await uploadEvidence(zeynep, projectId, { filename: "mizan-2026.csv", bytes: new TextEncoder().encode(TB) });
  const entries: [string, string | null, DraftInput][] = [
    ["ghg_stationary", gebze, { lines: [{ key: "natural_gas", value: "1.000.000", unit: "m3" }, { key: "diesel", value: "20000", unit: "L" }], quality: "measured" }],
    ["ghg_stationary", dilovasi, { lines: [{ key: "natural_gas", value: "250000", unit: "m3" }], quality: "measured" }],
    ["ghg_electricity", gebze, { value: "8000", unit: "MWh", quality: "measured" }],
    ["ghg_electricity", dilovasi, { value: "2000", unit: "MWh", quality: "measured" }],
    ["ghg_refrigerants", gebze, { lines: [{ key: "R-410A", value: "12", unit: "kg" }], quality: "estimated" }],
    ["ghg_refrigerants", dilovasi, { lines: [{ key: "R-134a", value: "5", unit: "kg" }], quality: "estimated" }],
    ["ghg_certificates", null, { value: "1000", unit: "MWh", quality: "measured" }],
    ["net_sales", null, { value: "1.237,5", unit: "mTRY", quality: "measured" }],
    ["tb_export", null, { text: "2026 yıl sonu kesin mizanı (TDHP)" }],
  ];
  for (const [metric, fac, d] of entries) {
    const r = rows.find((x) => x.metric_code === metric && x.facility_id === fac)!;
    await saveDraft(zeynep, r.id, d);
    await linkEvidence(zeynep, r.id, metric === "tb_export" ? tbFile.id : proof.id);
    await submitTask(zeynep, r.id);
    await acceptTask(mehmet, r.id);
  }
  await runOnce(100); // evidence scan (ClamAV) and notifications
}, 120_000);

afterAll(async () => {
  await closeDb();
});

describe("G4 calculations", () => {
  it("only people with calc.run may run; another tenant does not see the cycle", async () => {
    await expect(runCalculation(zeynep, cycleId, { kind: "ghg" })).rejects.toMatchObject({ status: 403 });
    await expect(runCalculation(outsider, cycleId, { kind: "ghg" })).rejects.toMatchObject({ status: 404 });
  });

  it("G4-07: a pending input is a blocker — facts stay 'validating', the blocker cannot be waved through", async () => {
    const r = await runCalculation(selin, cycleId, { kind: "ghg" });
    ghgRun1 = r.runId;
    expect(r.reused).toBe(false);
    expect(r.blockers).toBe(1);
    const { facts, issues } = await getRun(selin, r.runId);
    expect(new Set(facts.map((f) => f.status))).toEqual(new Set(["validating"]));
    const blocker = issues.find((i) => i.severity === "blocker")!;
    expect(blocker.rule_id).toBe("input_not_accepted");
    await expect(resolveIssue(mehmet, blocker.id, { decision: "resolved", resolution: "Araç yakıtı yok sayılsın lütfen." })).rejects.toMatchObject({ code: "blocker_requires_rerun" });
    await expect(approveFact(mehmet, facts[0].id)).rejects.toMatchObject({ code: "invalid_transition" });
  });

  it("G4-02/03: the fixed input runs clean; the same inputs reuse the same run (idempotent)", async () => {
    const mobile = (await listRequests(ayse, campaignId)).find((x) => x.metric_code === "ghg_mobile")!;
    await closeRequest(ayse, mobile.id, "not_applicable", "Şirketin araç filosu yok; kiralık araçlar kapsam 3.");
    const r = await runCalculation(selin, cycleId, { kind: "ghg" });
    expect(r.reused).toBe(false);
    expect(r.blockers).toBe(0);
    const again = await runCalculation(selin, cycleId, { kind: "ghg" });
    expect(again).toMatchObject({ runId: r.runId, reused: true });
    // the first run's blocker was superseded by the new run's findings
    expect((await listIssues(selin, cycleId)).some((i) => i.run_id === ghgRun1)).toBe(false);
    ghgRun1 = r.runId;

    const { run, facts } = await getRun(selin, r.runId);
    expect(run.boundary_id).not.toBeNull();
    const fact = (k: string, f: string | null = null) => Number(facts.find((x) => x.metric_key === k && x.facility_id === f)!.value_num);
    // scope 2 location: Gebze 8 000 MWh × transmission + Dilovası 2 000 MWh × distribution (ETKB 2023, the latest
    // edition before 2026); market: 1 000 MWh certificates spread by consumption (800 / 200)
    const tr = etkb2023.factors["TR-transmission"].tco2e;
    const dist = etkb2023.factors["TR-distribution"].tco2e;
    expect(fact("ghg.scope2.location")).toBeCloseTo(8000 * tr + 2000 * dist, 6);
    expect(fact("ghg.scope2.market")).toBeCloseTo(7200 * tr + 1800 * dist, 6);
    expect(fact("ghg.scope2.location", gebze)).toBeCloseTo(8000 * tr, 6);
    // fugitive: 12 kg R-410A × 2 255.5 + 5 kg R-134a × 1 530 (AR6), in tonnes
    expect(fact("ghg.scope1.fugitive")).toBeCloseTo((12 * 2255.5 + 5 * 1530) / 1000, 6);
    expect(fact("ghg.scope1")).toBeGreaterThan(fact("ghg.scope1.stationary"));
    expect(facts.find((f) => f.metric_key === "ghg.scope1" && f.facility_id === null)!.status).toBe("ready_for_review");
  });

  it("G4-07/08: four eyes — the performer cannot approve or resolve; warnings need a reviewer's reason", async () => {
    const { facts, issues } = await getRun(selin, ghgRun1);
    const s1 = facts.find((f) => f.metric_key === "ghg.scope1" && f.facility_id === null)!;
    expect(issues.map((i) => i.rule_id).sort()).toEqual(expect.arrayContaining(["factor_edition_fallback", "market_residual_proxy"]));
    await expect(approveFact(mehmet, s1.id)).rejects.toMatchObject({ code: "open_issues" });
    await expect(resolveIssue(selin, issues[0].id, { decision: "accepted_exception", resolution: "Kendi hesabımı onaylıyorum." })).rejects.toMatchObject({ code: "own_calculation" });
    await expect(resolveIssue(mehmet, issues[0].id, { decision: "accepted_exception", resolution: "kısa" })).rejects.toMatchObject({ code: "reason_required" });
    for (const i of issues) await resolveIssue(mehmet, i.id, { decision: "accepted_exception", resolution: `${i.rule_id}: 2026 ETKB faktörü henüz yayımlanmadı; rapor notunda açıklanacak.` });
    await expect(approveFact(selin, s1.id)).rejects.toMatchObject({ code: "own_calculation" });
    const a = await approveRun(mehmet, ghgRun1);
    expect(a.approved).toBe(facts.length);
    expect((await listFacts(selin, cycleId)).filter((f) => f.run_id === ghgRun1).every((f) => f.status === "approved")).toBe(true);
  });

  it("G4 gate — emission metric: lineage names the exact factor version and source, and the run reproduces", async () => {
    const facts = await listFacts(selin, cycleId);
    const s2 = facts.find((f) => f.metric_key === "ghg.scope2.location" && f.facility_id === null)!;
    const l = await factLineage(selin, s2.id);
    expect(l.run.engine_version).toMatch(/^isoline-calc /);
    expect(l.run.boundary_kind).toBe("ghg_operational_control");
    const grid = l.factors.find((f) => f.target === "grid:transmission")!;
    expect(grid).toMatchObject({ code: "etkb_2023", edition_year: 2023, licence: "public_sector" });
    expect(Number(grid.value)).toBe(etkb2023.factors["TR-transmission"].tco2e);
    expect(grid.publisher).toContain("Enerji ve Tabii Kaynaklar");
    expect(grid.content_sha256).toMatch(/^[0-9a-f]{64}$/);
    const el = l.observations.filter((o) => o.metric_code === "ghg_electricity");
    expect(el.map((o) => o.facility_name).sort()).toEqual(["Dilovası", "Gebze"]);
    expect(el.every((o) => o.entered_by_name === "Zeynep" && o.decided_by_name === "Mehmet")).toBe(true);
    expect(l.evidence.map((e) => e.filename)).toContain("sayac-fatura-2026.pdf");
    const rep = await reproduceRun(mehmet, ghgRun1);
    expect(rep).toMatchObject({ matches: true, inputsMatch: true, factorsMatch: true });
    expect(rep.recomputed).toBe(rep.outputDigest);
  });

  it("G4 gate — finance metric: net sales from the trial balance, reconciled and reproducible from the file", async () => {
    const r = await runCalculation(selin, cycleId, { kind: "finance" });
    finRun = r.runId;
    expect(r.blockers).toBe(0);
    const { run, facts, issues } = await getRun(selin, r.runId);
    expect(facts.map((f) => [f.metric_key, Number(f.value_num), f.unit])).toEqual([["finance.net_sales", 1_237_500_000, "TRY"]]);
    expect(issues.map((i) => i.rule_id)).toEqual([]); // 1 237,5 mTRY reported = TB net sales
    const recon = (run.result as { reconciliation: { relative: number } }).reconciliation;
    expect(recon.relative).toBe(0);
    const l = await factLineage(selin, facts[0].id);
    expect(l.evidence.map((e) => e.filename)).toContain("mizan-2026.csv");
    expect(l.observations.map((o) => o.metric_code)).toEqual(["net_sales"]);
    expect(await reproduceRun(mehmet, finRun)).toMatchObject({ matches: true, inputsMatch: true, evidence: 2 }); // the trial balance and the net sales source
    await approveFact(mehmet, facts[0].id);
  });

  it("G4-01: a project factor choice is a new run and a new revision; the approved one stays until the new is approved", async () => {
    await expect(chooseFactor(zeynep, projectId, "fuel:natural_gas", "00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({ status: 403 });
    const tuik = await systemDb().selectFrom("core.factor_values as v").innerJoin("core.factor_sets as s", "s.id", "v.set_id").select(["v.id", "v.value"]).where("s.code", "=", "tuik_nir_2024").where("v.key", "=", "natural_gas").executeTakeFirstOrThrow();
    await chooseFactor(selin, projectId, "fuel:natural_gas", tuik.id, "Ulusal envanter (TÜİK NIR 2026) NCV ve EF değerleri");
    expect((await listChoices(selin, projectId)).map((c) => [c.target, c.code])).toEqual([["fuel:natural_gas", "tuik_nir_2024"]]);
    const before = (await listFacts(selin, cycleId)).find((f) => f.metric_key === "ghg.scope1.stationary" && f.facility_id === null)!;
    const r = await runCalculation(selin, cycleId, { kind: "ghg" });
    expect(r.reused).toBe(false);
    const now = await listFacts(selin, cycleId);
    const versions = now.filter((f) => f.metric_key === "ghg.scope1.stationary" && f.facility_id === null);
    expect(versions.map((v) => [v.revision, v.status])).toEqual([
      [before.revision + 1, "ready_for_review"],
      [before.revision, "approved"],
    ]);
    expect(Number(versions[0].value_num)).not.toBeCloseTo(Number(before.value_num), 3);
    const l = await factLineage(selin, versions[0].id);
    expect(l.factors.find((f) => f.target === "fuel:natural_gas")).toMatchObject({ code: "tuik_nir_2024", chosen: true });
    // every revision is kept: the blocked first run's draft, the approved one, the new one
    expect(l.history.map((h) => h.status)).toEqual(["ready_for_review", "approved", "superseded"]);
    // the reviewer rejects the revision with a reason; the approved figure stays in force
    await expect(rejectFact(mehmet, versions[0].id, "kısa")).rejects.toMatchObject({ code: "reason_required" });
    await rejectFact(mehmet, versions[0].id, "Gebze doğal gaz NCV'si tedarikçi faturasından alınmalı.");
    expect((await listFacts(selin, cycleId)).find((f) => f.id === before.id)!.status).toBe("approved");
  });

  it("licensed factor data needs a rights confirmation; the set is private to its tenant", async () => {
    const csv = "kind;key;label;value;unit\nscope3;steel_hrc;Sıcak haddelenmiş çelik;1.9;t";
    await expect(addCustomSet(selin, { code: "ecoinvent_test", name: "Lisanslı", publisher: "Vendor", licence: "user_licensed", csv, rightsConfirmed: false })).rejects.toMatchObject({ code: "rights_confirmation_required" });
    const s = await addCustomSet(selin, { code: "ecoinvent_test", name: "Lisanslı", publisher: "Vendor", licence: "user_licensed", csv, rightsConfirmed: true });
    expect(s.factors).toBe(1);
    const visible = await systemDb().selectFrom("core.factor_sets").select("owner_tenant_id").where("id", "=", s.setId).executeTakeFirstOrThrow();
    expect(visible.owner_tenant_id).toBe(company);
    await expect(factLineage(outsider, (await listFacts(selin, cycleId))[0].id)).rejects.toMatchObject({ status: 404 });
  });

  it("G8-07: the calculations page reads in one statement what the list services return", async () => {
    // by now the cycle has fact revisions (approved, rejected, superseded), open and resolved findings, several runs,
    // a factor choice, an approved boundary and a tenant's private factor set
    for (const who of [selin, mehmet, ayse]) {
      const view = await calculationsView(who, projectId, cycleId, { factorSets: true });
      expect(view.facts.length).toBeGreaterThan(5);
      expect(view.facts).toEqual(await listFacts(who, cycleId));
      expect(view.runs).toEqual(await listRuns(who, projectId, cycleId));
      expect(view.choices).toEqual(await listChoices(who, projectId));
      const issues = await listIssues(who, cycleId);
      expect(view.issues).toEqual(issues.map((i) => ({ id: i.id, rule_id: i.rule_id, severity: i.severity, status: i.status, target_type: i.target_type, target_id: i.target_id, observed: i.observed, resolution: i.resolution, resolved_by_name: i.resolved_by_name, run_kind: i.run_kind })));
      const boundaries = await listBoundaries(who, cycleId);
      expect(view.approvedBoundaries).toEqual([...new Set(boundaries.filter((b) => b.status === "approved").map((b) => b.kind))]);
      const sets = await listFactorSets(who);
      expect(view.factorSets).toEqual(sets.filter((x) => x.status === "active").map((x) => ({ id: x.id, code: x.code, name: x.name, edition_year: x.edition_year, licence: x.licence })));
      expect(view.factorSets.length).toBeGreaterThan(3);
    }
    expect((await calculationsView(selin, projectId, cycleId, { factorSets: false })).factorSets).toEqual([]);
    // the same access answers as the list services: another tenant, a cycle that is not the project's
    await expect(calculationsView(outsider, projectId, cycleId, { factorSets: false })).rejects.toMatchObject({ status: 404 });
    await expect(calculationsView(selin, projectId, "00000000-0000-4000-8000-000000000000", { factorSets: false })).rejects.toMatchObject({ status: 404, code: "cycle_not_found" });
  });
});
