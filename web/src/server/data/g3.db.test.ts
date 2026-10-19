/**
 * G3 gate (plan 13): tasks for 3 people and 2 facilities over 2 data types, one return and resubmission, a source
 * document, a file import, reminders, and a supplier that sees only its own request.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, systemDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { runOnce } from "../jobs/worker";
import { createFacility, createLegalEntity, createOrganization } from "../orgs/service";
import { addParticipant, createProjectWizard } from "../projects/service";
import { acceptInvitation, createTenant, grantProjectAccess, inviteMember, type Identity } from "../tenancy/service";
import { commitImport, previewImport, rollbackImport } from "./imports";
import {
  acceptTask,
  addComment,
  assignRequests,
  closeRequest,
  createCampaign,
  getTask,
  linkEvidence,
  listRequests,
  myTasks,
  returnTask,
  saveDraft,
  scanReminders,
  sendRequests,
  submitTask,
  suggestedTemplates,
  updateCampaign,
} from "./service";

let ayse: Actor, mehmet: Actor, zeynep: Actor, kemal: Actor;
let company: string;
let projectId: string, cycleId: string, campaignId: string;
let gebze: string, dilovasi: string;
const ids: Record<string, Identity> = {};

const pdf = (label: string) => new TextEncoder().encode(`%PDF-1.4\n% ${label}\n%%EOF\n`);

async function member(label: string, role: "data_owner" | "contributor") {
  const u = await makeUser(label);
  ids[label] = u;
  await acceptInvitation(u, (await inviteMember(ayse, { email: u.email, role })).token);
  return { userId: u.userId, actingTenantId: company } as Actor;
}

beforeAll(async () => {
  await ensureBucket();
  const a = await makeUser("Ayse");
  company = await createTenant(a, { name: "Anadolu Gıda", kind: "company", termsVersion: "t" });
  ayse = { userId: a.userId, actingTenantId: company };
  mehmet = await member("Mehmet", "data_owner");
  zeynep = await member("Zeynep", "contributor");
  kemal = await member("Kemal", "contributor");
  const org = await createOrganization(ayse, { name: "Anadolu Gıda Grubu" });
  const parent = await createLegalEntity(ayse, { organizationId: org, name: "Anadolu Gıda A.Ş.", isReportingParent: true });
  gebze = await createFacility(ayse, { legalEntityId: parent, name: "Gebze" });
  dilovasi = await createFacility(ayse, { legalEntityId: parent, name: "Dilovası" });
  const p = await createProjectWizard(ayse, { name: "2026 TSRS", organizationId: org, cycle: { reportingYear: 2026 }, planStart: "2026-03-01" });
  projectId = p.projectId;
  cycleId = p.cycleId;
  await addParticipant(ayse, projectId, { userId: mehmet.userId, memberTenantId: company, raciRole: "data_owner" });
  await addParticipant(ayse, projectId, { userId: zeynep.userId, memberTenantId: company, raciRole: "contributor", facilityIds: [gebze] });
  await addParticipant(ayse, projectId, { userId: kemal.userId, memberTenantId: company, raciRole: "contributor", facilityIds: [dilovasi] });
});

afterAll(async () => {
  await closeDb();
});

const find = (rows: Awaited<ReturnType<typeof listRequests>>, metric: string, facility: string | null) => rows.find((r) => r.metric_code === metric && r.facility_id === facility)!;

describe("G3 data campaign", () => {
  it("G3-02: templates generate one request per data point and facility; regenerating adds only what is missing", async () => {
    const s = await suggestedTemplates(ayse, cycleId);
    expect(s.basedOnDecisions).toBe(false);
    const r = await createCampaign(ayse, cycleId, { title: "2026 iklim verisi", templateIds: ["tsrs_climate_first"], dueOn: "2027-01-31" });
    campaignId = r.campaignId;
    const rows = await listRequests(ayse, campaignId);
    expect(rows.filter((x) => x.metric_code === "ghg_electricity").map((x) => x.facility_name).sort()).toEqual(["Dilovası", "Gebze"]);
    expect(rows.find((x) => x.metric_code === "ghg_certificates")!.facility_id).toBeNull(); // organisation-level
    expect(r.created).toBe(rows.length);
    // the same data point asked by a second report is one request with two traces
    const again = await createCampaign(ayse, cycleId, { title: "", templateIds: ["tsrs_full"] }, campaignId);
    expect(again.updated).toBeGreaterThan(0);
    const el = find(await listRequests(ayse, campaignId), "ghg_electricity", gebze);
    expect((el.traces as unknown as { template: string }[]).map((t) => t.template).sort()).toEqual(["tsrs_climate_first", "tsrs_full"]);
    expect((await listRequests(ayse, campaignId)).length).toBeGreaterThanOrEqual(8);
  });

  it("G3-03: assignment respects team, facility scope and a reviewer who is someone else", async () => {
    const rows = await listRequests(ayse, campaignId);
    await expect(assignRequests(ayse, [find(rows, "ghg_electricity", dilovasi).id], { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId })).rejects.toMatchObject({ code: "facility_out_of_scope" });
    await expect(assignRequests(ayse, [find(rows, "ghg_electricity", gebze).id], { assigneeUserId: mehmet.userId, reviewerUserId: mehmet.userId })).rejects.toMatchObject({ code: "reviewer_must_differ" });
    await expect(assignRequests(ayse, [find(rows, "ghg_electricity", gebze).id], { assigneeUserId: zeynep.userId, reviewerUserId: kemal.userId })).rejects.toMatchObject({ code: "reviewer_not_on_team" });
    const gebzeIds = rows.filter((r) => r.facility_id === gebze).map((r) => r.id);
    const dilIds = rows.filter((r) => r.facility_id === dilovasi).map((r) => r.id);
    const orgIds = rows.filter((r) => r.facility_id === null).map((r) => r.id);
    await assignRequests(ayse, gebzeIds, { assigneeUserId: zeynep.userId, reviewerUserId: mehmet.userId, dueOn: "2027-01-31" });
    await assignRequests(ayse, dilIds, { assigneeUserId: kemal.userId, reviewerUserId: mehmet.userId, dueOn: "2027-01-31", critical: true });
    await assignRequests(ayse, orgIds, { assigneeUserId: mehmet.userId, reviewerUserId: ayse.userId, dueOn: "2027-02-15" });
    expect((await sendRequests(ayse, rows.map((r) => r.id))).sent).toBe(rows.length);
    await expect(sendRequests(zeynep, rows.map((r) => r.id))).rejects.toMatchObject({ status: 403 });
  });

  it("UAT-07: a contributor sees her Gebze tasks only; Dilovası is not even found", async () => {
    const mine = await myTasks(zeynep);
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.facility_name === "Gebze")).toBe(true);
    const visible = await listRequests(zeynep, campaignId);
    expect(visible.every((r) => r.facility_id === gebze)).toBe(true);
    const dil = find(await listRequests(ayse, campaignId), "ghg_electricity", dilovasi);
    await expect(getTask(zeynep, dil.id)).rejects.toMatchObject({ status: 404 });
    await expect(saveDraft(zeynep, dil.id, { value: "1", unit: "kWh" })).rejects.toMatchObject({ status: 404 });
  });

  it("G3-04/06/07/09: draft → evidence → submit → return with reason → resubmit → accepted by someone else", async () => {
    const el = find(await listRequests(ayse, campaignId), "ghg_electricity", gebze);
    await expect(saveDraft(zeynep, el.id, { value: "1000", unit: "kg" })).rejects.toMatchObject({ code: "unit_not_allowed" });
    await expect(saveDraft(zeynep, el.id, { value: "-5", unit: "kWh" })).rejects.toMatchObject({ code: "negative_value" });
    await saveDraft(zeynep, el.id, { value: "1.250.000", unit: "kWh", quality: "measured", sourceRef: "TEDAŞ faturaları Oca–Ara" });
    await expect(submitTask(zeynep, el.id)).rejects.toMatchObject({ code: "evidence_required" });
    const ev = await uploadEvidence(zeynep, projectId, { filename: "elektrik-2026.pdf", bytes: pdf("elektrik") });
    await linkEvidence(zeynep, el.id, ev.id);
    await submitTask(zeynep, el.id);
    await expect(acceptTask(zeynep, el.id)).rejects.toMatchObject({ status: 403 }); // not the reviewer
    await expect(returnTask(mehmet, el.id, "kısa")).rejects.toMatchObject({ code: "reason_required" });
    await returnTask(mehmet, el.id, "Aralık faturası eksik; 12 ayın toplamını girin.");
    let t = await getTask(zeynep, el.id);
    expect(t.request.status).toBe("revision_required");
    expect(t.comments.find((c) => c.kind === "return")!.body).toContain("Aralık");
    await saveDraft(zeynep, el.id, { value: "1.312.500", unit: "kWh", quality: "measured" });
    await submitTask(zeynep, el.id, "Aralık eklendi.");
    await addComment(mehmet, el.id, "Teşekkürler, kontrol ediyorum.");
    await acceptTask(mehmet, el.id);
    await runOnce(100); // the worker scans the evidence file and delivers the notifications
    t = await getTask(ayse, el.id);
    expect(t.request.status).toBe("accepted");
    expect(t.versions.map((v) => [v.revision, v.status])).toEqual([
      [2, "accepted"],
      [1, "rejected"],
    ]);
    expect(Number(t.versions[0].canonical_value)).toBeCloseTo(4725, 6); // 1 312 500 kWh = 4 725 GJ
    expect(t.evidence.map((e) => e.filename)).toEqual(["elektrik-2026.pdf"]);
    // the old version is kept, not overwritten (G3-07)
    expect(t.versions[1].value_num).toBe("1250000.000000000000");
  });

  it("multiline: fuel lines with their own units; a line outside the fuel list is refused", async () => {
    const fuel = find(await listRequests(ayse, campaignId), "ghg_stationary", gebze);
    await expect(saveDraft(zeynep, fuel.id, { lines: [{ key: "uranium", value: "1", unit: "t" }] })).rejects.toMatchObject({ code: "unknown_line" });
    await saveDraft(zeynep, fuel.id, { lines: [{ key: "natural_gas", value: "125000", unit: "m3" }, { key: "diesel", value: "4000", unit: "L" }] });
    const t = await getTask(zeynep, fuel.id);
    expect((t.versions[0].lines as unknown as { key: string; canonical: string }[]).map((l) => [l.key, l.canonical])).toEqual([
      ["natural_gas", "125000"],
      ["diesel", "4"],
    ]);
  });

  it("not applicable needs a reason; own work can never be accepted (DB check)", async () => {
    const rows = await listRequests(ayse, campaignId);
    const ref = find(rows, "ghg_refrigerants", dilovasi);
    await expect(closeRequest(ayse, ref.id, "not_applicable", "yok")).rejects.toMatchObject({ code: "reason_required" });
    await closeRequest(ayse, ref.id, "not_applicable", "Dilovası tesisinde soğutucu ekipman yok (envanter 2026).");
    // forcing a self-decision past the service is refused by the database
    const cert = find(rows, "ghg_certificates", null);
    await saveDraft(mehmet, cert.id, { value: "100", unit: "MWh" });
    const v = await systemDb().selectFrom("core.observation_versions").select("id").where("request_id", "=", cert.id).executeTakeFirstOrThrow();
    await expect(systemDb().updateTable("core.observation_versions").set({ status: "accepted", decided_by: mehmet.userId, decided_at: new Date() }).where("id", "=", v.id).execute()).rejects.toMatchObject({ code: "23514" });
  });

  it("G3-05: file import — row errors reported, valid rows submitted with the file as evidence, once, reversible", async () => {
    const csv = ["Metrik;Tesis;Değer;Birim;Kalite;Açıklama", "ghg_electricity;Dilovası;900.000;kWh;ölçüm;TEDAŞ", "ghg_process;Dilovası;1.234,5;tCO2e;hesap;", "ghg_electricity;Ankara;1;kWh;;", "ghg_process;Gebze;abc;tCO2e;;"].join("\n");
    const bytes = new TextEncoder().encode(csv);
    const p = await previewImport(ayse, campaignId, { filename: "dilovasi-2026.csv", bytes });
    expect([p.total, p.valid]).toEqual([4, 2]);
    expect(p.errors.map((e) => e.code)).toEqual(["unknown_facility", "invalid_number"]);
    const c = await commitImport(ayse, p.importId);
    expect(c.versions).toBe(2);
    const rows = await listRequests(ayse, campaignId);
    const el = find(rows, "ghg_electricity", dilovasi);
    expect(el.status).toBe("submitted");
    expect(Number(el.evidence)).toBe(1);
    // committed rows count as entered by the importer: she cannot accept them herself
    await expect(commitImport(ayse, p.importId)).rejects.toMatchObject({ code: "import_not_previewed" });
    const p2 = await previewImport(ayse, campaignId, { filename: "kopya.csv", bytes });
    expect(p2.duplicateOf).toBe(p.importId);
    await expect(commitImport(ayse, p2.importId)).rejects.toMatchObject({ code: "import_already_committed" });
    // nothing reviewed yet: the import can be rolled back and the requests reopen
    expect((await rollbackImport(ayse, p.importId)).removed).toBe(2);
    expect(find(await listRequests(ayse, campaignId), "ghg_electricity", dilovasi).status).toBe("sent");
  });

  it("G3-08: reminders T−7, T−2 (critical only) and T+1 are queued once, however often the scan runs", async () => {
    const count = async () => Number((await systemDb().selectFrom("core.outbox_events").select((eb) => eb.fn.countAll().as("n")).where("dedupe_key", "like", "rem:%").executeTakeFirstOrThrow()).n);
    const before = await count();
    const t7 = await scanReminders("2027-01-24");
    expect(t7.queued).toBeGreaterThan(0);
    const after7 = await count();
    await scanReminders("2027-01-24");
    expect(await count()).toBe(after7);
    // T−2 only for the critical (Dilovası) requests
    const t2 = await scanReminders("2027-01-29");
    const dil = (await listRequests(ayse, campaignId)).filter((r) => r.facility_id === dilovasi && ["sent", "revision_required"].includes(r.status)).length;
    expect(t2.queued).toBe(dil);
    // T+1: one summary per lead for the project
    const late = await scanReminders("2027-02-01");
    expect(late.queued).toBeGreaterThanOrEqual(1);
    expect(before).toBeLessThan(after7);
    // the rule is the campaign's own: a 10-day reminder appears once it is configured
    expect((await scanReminders("2027-01-21")).queued).toBe(0);
    await expect(updateCampaign(ayse, campaignId, { reminderPolicy: { beforeDays: [10], afterDays: [], criticalOnlyDays: [2] } })).rejects.toMatchObject({ code: "invalid_reminder_policy" });
    await updateCampaign(ayse, campaignId, { reminderPolicy: { beforeDays: [10, 3], afterDays: [2], criticalOnlyDays: [3] } });
    expect((await scanReminders("2027-01-21")).queued).toBeGreaterThan(0);
    await expect(updateCampaign(zeynep, campaignId, { status: "closed" })).rejects.toMatchObject({ status: 403 });
  });

  it("G3-10: a supplier sees and answers only its own request", async () => {
    const s = await makeUser("Supplier");
    const supTenant = await createTenant(s, { name: "Tedarikçi Ambalaj", kind: "company", termsVersion: "t" });
    const sup: Actor = { userId: s.userId, actingTenantId: supTenant };
    await grantProjectAccess(ayse, { projectId, recipientTenantId: supTenant, role: "supplier", purpose: "Ambalaj tedarik verisi", days: 30, termsVersion: "g" });
    await addParticipant(ayse, projectId, { userId: s.userId, memberTenantId: supTenant, raciRole: "contributor" });
    const rows = await listRequests(ayse, campaignId);
    const target = rows.find((r) => r.metric_code === "ghg_mobile")!;
    await assignRequests(ayse, [target.id], { assigneeUserId: s.userId, reviewerUserId: mehmet.userId });
    const seen = await listRequests(sup, campaignId);
    expect(seen.map((r) => r.id)).toEqual([target.id]);
    await saveDraft(sup, target.id, { lines: [{ key: "diesel", value: "12000", unit: "L" }] });
    const ev = await uploadEvidence(sup, projectId, { filename: "akaryakit.pdf", bytes: pdf("akaryakit") });
    await linkEvidence(sup, target.id, ev.id);
    await submitTask(sup, target.id);
    const other = rows.find((r) => r.metric_code === "ghg_electricity" && r.facility_id === gebze)!;
    await expect(getTask(sup, other.id)).rejects.toMatchObject({ status: 404 });
  });
});
