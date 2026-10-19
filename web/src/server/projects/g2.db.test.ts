/**
 * G2 gate (plan 13): company-first and advisory-first journeys on one data spine — organisation tree with dated
 * ownership, boundaries, engagements, cycles, applicability with a named decision, team/RACI, plan, portfolio.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_CLIENT } from "@/data/sample";
import { closeDb, systemDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { addOwnershipEdge, createFacility, createLegalEntity, createOrganization, endOwnershipEdge, organizationTree } from "../orgs/service";
import { acceptInvitation, createProvisionalClient, createTenant, grantProjectAccess, inviteMember, revokeGrant } from "../tenancy/service";
import {
  addCycle,
  addDeliverable,
  addDependency,
  addParticipant,
  approveBoundary,
  confirmApplicability,
  createEngagement,
  createProjectWizard,
  decideApplicability,
  listApplicability,
  listBoundaries,
  listEngagements,
  listParticipants,
  listPlan,
  moveEngagement,
  participantCandidates,
  portfolio,
  proposeBoundary,
  runApplicability,
  setBoundaryMember,
  updateWorkPackage,
} from "./service";

let ayse: Actor; // company owner
let zeynep: Actor; // company contributor
let can: Actor; // advisory owner
let canId: { userId: string };
let company: string;
let advisory: string;

beforeAll(async () => {
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Anadolu Holding", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  const z = await makeUser("Zeynep");
  await acceptInvitation(z, (await inviteMember(ayse, { email: z.email, role: "contributor" })).token);
  zeynep = { userId: z.userId, actingTenantId: company };
  const c = await makeUser("Can");
  advisory = await createTenant(c, { name: "Yeşil Danışmanlık", kind: "advisory", termsVersion: "t" });
  can = { userId: c.userId, actingTenantId: advisory };
  canId = { userId: c.userId };
});

afterAll(async () => {
  await closeDb();
});

describe("G2: company-first journey", () => {
  let org: string, holding: string, sub1: string, sub2: string, gebze: string, dilovasi: string, izmir: string;
  let projectId: string, cycle2026: string;

  it("G2-01: holding, two subsidiaries, three facilities; contributors cannot change the tree", async () => {
    org = await createOrganization(ayse, { name: "Anadolu Grubu", sectorCode: "C24", fiscalYearStartMonth: 1 });
    holding = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Holding A.Ş.", entityType: "listed", isReportingParent: true });
    sub1 = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Çelik A.Ş." });
    sub2 = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Lojistik A.Ş." });
    gebze = await createFacility(ayse, { legalEntityId: sub1, name: "Gebze", kind: "plant", cbamInstallation: true });
    dilovasi = await createFacility(ayse, { legalEntityId: sub1, name: "Dilovası", kind: "plant" });
    izmir = await createFacility(ayse, { legalEntityId: sub2, name: "İzmir Depo", kind: "warehouse" });
    await expect(createLegalEntity(ayse, { organizationId: org, name: "İkinci ana", isReportingParent: true })).rejects.toMatchObject({ code: "parent_exists" });
    await expect(createFacility(zeynep, { legalEntityId: sub1, name: "X" })).rejects.toMatchObject({ status: 403 });
    const tree = await organizationTree(ayse);
    expect(tree.entities).toHaveLength(3);
    expect(tree.facilities).toHaveLength(3);
  });

  it("G2-02: ownership changes within the year are tracked; overlaps, loops and >100 % are refused", async () => {
    await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: sub1, sharePct: 100, control: "financial", validFrom: "2020-01-01" });
    const e = await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: sub2, sharePct: 100, control: "financial", validFrom: "2020-01-01" });
    // 1 July 2026: 40 % of the logistics company is sold; the holding keeps 60 % and control
    await endOwnershipEdge(ayse, e, "2026-06-30");
    await addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: sub2, sharePct: 60, control: "financial", validFrom: "2026-07-01", sourceNote: "Pay devri sözleşmesi" });
    await expect(addOwnershipEdge(ayse, { parentEntityId: holding, childEntityId: sub2, sharePct: 10, control: "financial", validFrom: "2026-08-01" })).rejects.toMatchObject({ code: "ownership_overlap" });
    await expect(addOwnershipEdge(ayse, { parentEntityId: sub1, childEntityId: holding, sharePct: 5, control: "none", validFrom: "2026-01-01" })).rejects.toMatchObject({ code: "ownership_cycle" });
    await expect(addOwnershipEdge(ayse, { parentEntityId: sub1, childEntityId: sub2, sharePct: 50, control: "none", validFrom: "2026-09-01" })).rejects.toMatchObject({ code: "shares_exceed_100" });
    const before = await organizationTree(ayse, { asOf: "2026-03-31" });
    const after = await organizationTree(ayse, { asOf: "2026-12-31" });
    const share = (t: typeof before) => t.edges.filter((x) => x.alive && x.child_entity_id === sub2).map((x) => Number(x.share_pct));
    expect(share(before)).toEqual([100]);
    expect(share(after)).toEqual([60]);
  });

  it("G2-05: project wizard opens 2026 with a 13-gate plan; 2025 can be added; overlapping periods are refused", async () => {
    const r = await createProjectWizard(ayse, { name: "2026 TSRS + Faaliyet", organizationId: org, cycle: { reportingYear: 2026, publishDue: "2027-05-31" }, planStart: "2026-03-01" });
    projectId = r.projectId;
    cycle2026 = r.cycleId;
    await addCycle(ayse, projectId, { reportingYear: 2025, label: "2025 (karşılaştırma)", planStart: "2026-03-01" });
    await expect(addCycle(ayse, projectId, { reportingYear: 2026, periodStart: "2026-06-01", periodEnd: "2027-05-31" })).rejects.toMatchObject({ code: "cycle_overlap" });
    const plan = await listPlan(ayse, cycle2026);
    expect(plan.map((p) => p.gate)).toEqual(["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12"]);
    expect(plan.find((p) => p.gate === "G3")!.deps).toHaveLength(2);
    expect(plan.some((p) => p.critical)).toBe(true);
  });

  it("G2-03 / G5-01: four boundary kinds are separate; the mid-year sale is day-weighted; a manual change needs a reason", async () => {
    const op = await proposeBoundary(ayse, cycle2026, "ghg_operational_control");
    const eq = await proposeBoundary(ayse, cycle2026, "ghg_equity_share");
    await proposeBoundary(ayse, cycle2026, "financial_reporting");
    await proposeBoundary(ayse, cycle2026, "cbam_facility_product");
    const all = await listBoundaries(ayse, cycle2026);
    expect(new Set(all.map((b) => b.kind)).size).toBe(4);
    const eqB = all.find((b) => b.id === eq.boundaryId)!;
    // 100 % for 181 days, 60 % for 184 days (sale on 1 July): the year-end share is not applied to the whole year
    const sub2Eq = eqB.members.find((m) => m.legal_entity_id === sub2)!;
    expect(Number(sub2Eq.inclusion_pct)).toBeCloseTo((100 * 181 + 60 * 184) / 365, 3);
    expect(sub2Eq.reason).toBe("time_weighted");
    const cbamB = all.find((b) => b.kind === "cbam_facility_product")!;
    expect(cbamB.members.filter((m) => m.included).map((m) => m.facility_id)).toEqual([gebze]);
    const opB = all.find((b) => b.id === op.boundaryId)!;
    const izmirMember = opB.members.find((m) => m.facility_id === izmir)!;
    await expect(setBoundaryMember(ayse, izmirMember.id, { inclusionPct: 0 })).rejects.toMatchObject({ code: "reason_required" });
    await setBoundaryMember(ayse, izmirMember.id, { inclusionPct: 0, reason: "Depo 2026'da kiraya verildi; işletmesi kiracıda" });
    await approveBoundary(ayse, op.boundaryId);
    await expect(setBoundaryMember(ayse, izmirMember.id, { inclusionPct: 100 })).rejects.toMatchObject({ code: "boundary_not_draft" });
    // a new revision keeps the approved one in force until it is approved itself
    const r2 = await proposeBoundary(ayse, cycle2026, "ghg_operational_control");
    expect(r2.revision).toBe(2);
    await approveBoundary(ayse, r2.boundaryId);
    const after = await listBoundaries(ayse, cycle2026);
    expect(after.filter((b) => b.kind === "ghg_operational_control").map((b) => [b.revision, b.status])).toEqual([
      [2, "approved"],
      [1, "superseded"],
    ]);
    expect(dilovasi).toBeTruthy();
  });

  it("G2-04: one engagement, several deliverables; the advisory sees the engagement naming it", async () => {
    const eng = await createEngagement(ayse, { title: "2026 raporlama hizmeti", advisoryTenantId: advisory, startsOn: "2026-03-01", endsOn: "2027-06-30" });
    await addDeliverable(ayse, eng, { title: "TSRS sürdürülebilirlik raporu", reportKind: "tsrs", dueOn: "2027-05-31", projectId });
    await addDeliverable(ayse, eng, { title: "Yıllık faaliyet raporu", reportKind: "annual_report", dueOn: "2027-03-31", projectId });
    await moveEngagement(ayse, eng, "accepted");
    await expect(moveEngagement(ayse, eng, "closed")).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(moveEngagement(can, eng, "active")).rejects.toMatchObject({ status: 403 });
    const mine = await listEngagements(ayse);
    expect(mine.find((e) => e.id === eng)!.deliverables).toHaveLength(2);
    expect((await listEngagements(can)).map((e) => e.id)).toContain(eng);
  });

  it("G2-06/07: the advisory gets a grant, decides applicability with a reason; the customer confirms", async () => {
    await grantProjectAccess(ayse, { projectId, recipientTenantId: advisory, role: "preparer", purpose: "2026 raporu", days: 120, termsVersion: "g" });
    const r = await runApplicability(can, cycle2026, { ...SAMPLE_CLIENT.profile });
    expect(r.assessments).toBeGreaterThanOrEqual(8);
    const list = await listApplicability(can, cycle2026);
    const tsrs = list.find((a) => a.regime === "tsrs")!;
    expect(tsrs.framework_id).toBe("tsrs@2024");
    expect(tsrs.source_ids).toContain("kgk_scope_2026");
    await expect(decideApplicability(can, tsrs.id, { decision: "in_scope", rationale: "kısa" })).rejects.toMatchObject({ code: "rationale_required" });
    await expect(decideApplicability(zeynep, tsrs.id, { decision: "in_scope", rationale: "Katılımcı karar veremez, yetkisi yok" })).rejects.toMatchObject({ status: 403 });
    await decideApplicability(can, tsrs.id, { decision: "in_scope", rationale: "BIST'te işlem gören, iki yıl üst üste eşiklerin ikisini aşıyor", decisionSource: "KGK 13.01.2026 kararı" });
    let row = (await listApplicability(ayse, cycle2026)).find((a) => a.id === tsrs.id)!;
    expect(row.decided_by_name).toBe("Can");
    expect(row.confirmed_at).toBeNull(); // advisor's decision waits for the customer
    await expect(confirmApplicability(can, tsrs.id)).rejects.toMatchObject({ code: "owner_decision" });
    await confirmApplicability(ayse, tsrs.id);
    row = (await listApplicability(ayse, cycle2026)).find((a) => a.id === tsrs.id)!;
    expect(row.confirmed_by_name).toBe("Ayse");

    // team: the advisor joins as preparer through the grant; a stranger cannot; management signer must be in-house
    const candidates = await participantCandidates(ayse, projectId);
    expect(candidates.map((c) => c.user_id)).toEqual(expect.arrayContaining([canId.userId, zeynep.userId]));
    await addParticipant(ayse, projectId, { userId: canId.userId, memberTenantId: advisory, raciRole: "advisor_preparer", responsibilities: "Veri talebi ve hesaplar" });
    await expect(addParticipant(ayse, projectId, { userId: canId.userId, memberTenantId: advisory, raciRole: "management_signer" })).rejects.toMatchObject({ code: "role_not_allowed_for_access" });
    const stranger = await makeUser("Stranger");
    await expect(addParticipant(ayse, projectId, { userId: stranger.userId, memberTenantId: company, raciRole: "contributor" })).rejects.toMatchObject({ code: "not_a_project_member" });
    await addParticipant(ayse, projectId, { userId: zeynep.userId, memberTenantId: company, raciRole: "contributor", responsibilities: "Gebze verileri" });
    expect((await listParticipants(can, projectId)).map((p) => p.raci_role).sort()).toEqual(["advisor_preparer", "contributor", "project_lead"]);
  });

  it("G2-08: the plan's state machine, dependencies, If-Match and critical path", async () => {
    let plan = await listPlan(ayse, cycle2026);
    const g = (k: string) => plan.find((p) => p.gate === k)!;
    await expect(updateWorkPackage(ayse, g("G1").id, { status: "active" })).rejects.toMatchObject({ code: "invalid_transition" });
    await expect(updateWorkPackage(ayse, g("G1").id, { status: "ready" })).rejects.toMatchObject({ code: "dependencies_open" });
    await updateWorkPackage(ayse, g("G0").id, { status: "active", responsibleUserId: ayse.userId }, g("G0").row_version);
    await expect(updateWorkPackage(ayse, g("G0").id, { status: "review" }, g("G0").row_version)).rejects.toMatchObject({ code: "version_conflict" });
    await updateWorkPackage(ayse, g("G0").id, { status: "review" });
    await updateWorkPackage(ayse, g("G0").id, { status: "done" });
    plan = await listPlan(ayse, cycle2026);
    expect(g("G1").status).toBe("ready"); // successors open automatically
    expect(g("G2").status).toBe("ready");
    await expect(updateWorkPackage(ayse, g("G2").id, { status: "blocked" })).rejects.toMatchObject({ code: "reason_required" });
    await expect(updateWorkPackage(ayse, g("G2").id, { responsibleUserId: (await makeUser("Outsider")).userId })).rejects.toMatchObject({ code: "not_a_participant" });
    await expect(addDependency(ayse, g("G0").id, g("G12").id)).rejects.toMatchObject({ code: "dependency_cycle" });
    // moving the writing package late enough makes it critical
    await updateWorkPackage(ayse, g("G10").id, { startsOn: g("G10").starts_on, dueOn: g("G9").due_on });
    plan = await listPlan(ayse, cycle2026);
    expect(g("G10").critical).toBe(true);
    // the advisor may update the plan through its preparer grant; the contributor may not
    await updateWorkPackage(can, g("G2").id, { status: "active" });
    await expect(updateWorkPackage(zeynep, g("G1").id, { status: "active" })).rejects.toMatchObject({ status: 403 });
  });

  it("revoking the grant removes the advisor's view; the customer's history stays", async () => {
    const grant = await systemDb().selectFrom("core.external_grants").select("id").where("project_id", "=", projectId).where("recipient_tenant_id", "=", advisory).executeTakeFirstOrThrow();
    await revokeGrant(ayse, grant.id);
    await expect(listPlan(can, cycle2026)).rejects.toMatchObject({ status: 404 });
    expect((await listApplicability(ayse, cycle2026)).find((a) => a.regime === "tsrs")!.decided_by_name).toBe("Can");
  });
});

describe("G2: advisory-first journey and the portfolio (G2-09)", () => {
  it("the advisory sets up a provisional client; after the claim both journeys share one spine", async () => {
    const client = await createProvisionalClient(can, { name: "X Kimya A.Ş.", contactEmail: "elif@xkimya.test" });
    const org = await createOrganization(can, { name: "X Kimya", ownerTenantId: client.tenantId });
    const parent = await createLegalEntity(can, { organizationId: org, name: "X Kimya A.Ş.", isReportingParent: true });
    await createFacility(can, { legalEntityId: parent, name: "Aliağa", cbamInstallation: true });
    const p = await createProjectWizard(can, { name: "X Kimya 2026", ownerTenantId: client.tenantId, organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-04-01" });
    await proposeBoundary(can, p.cycleId, "ghg_operational_control");

    // a company-initiated project shared with the advisory
    const a2 = await makeUser("Ayse2");
    const c2 = await createTenant(a2, { name: "Ege Seramik", kind: "company", termsVersion: "t" });
    const owner2: Actor = { userId: a2.userId, actingTenantId: c2 };
    const p2 = await createProjectWizard(owner2, { name: "Ege Seramik 2026", cycle: { reportingYear: 2026 }, planStart: "2026-04-01" });
    await grantProjectAccess(owner2, { projectId: p2.projectId, recipientTenantId: advisory, role: "preparer", purpose: "rapor", days: 60, termsVersion: "g" });

    const pf = await portfolio(can);
    const names = pf.map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(["X Kimya 2026", "Ege Seramik 2026"]));
    expect(names).not.toContain("2026 TSRS + Faaliyet"); // grant revoked above
    expect(pf.find((x) => x.name === "X Kimya 2026")!.access).toBe("steward");
    expect(pf.find((x) => x.name === "Ege Seramik 2026")!).toMatchObject({ access: "grant", grantRole: "preparer" });
    expect(pf.find((x) => x.name === "Ege Seramik 2026")!.next?.step).toBe("scope");

    // claim: the customer's representative takes over; the advisory continues under a grant on the same rows
    const elif = await makeUser("Elif");
    await systemDb().updateTable("user").set({ email: "elif@xkimya.test" }).where("id", "=", elif.userId).execute();
    await acceptInvitation({ ...elif, email: "elif@xkimya.test" }, client.invitationToken);
    const after = await portfolio(can);
    expect(after.find((x) => x.name === "X Kimya 2026")!.access).toBe("grant");
    const elifActor: Actor = { userId: elif.userId, actingTenantId: client.tenantId };
    expect((await listBoundaries(elifActor, p.cycleId)).length).toBe(1);
    expect((await organizationTree(elifActor)).facilities.map((f) => f.name)).toEqual(["Aliağa"]);
  });
});
