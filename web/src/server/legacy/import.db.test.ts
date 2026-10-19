/** G1-11: toolkit workspace import — preview, apply once, placeholders fulfilled by hash, rollback, parity. */
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { emptyClient, SAMPLE_CLIENT, type ClientData } from "@/data/sample";
import { computeInventory } from "@/lib/calc/ghg";
import { closeDb, systemDb, type Actor } from "../db/client";
import { makeUser } from "../db/test-helpers";
import { uploadEvidence } from "../evidence/service";
import { ensureBucket } from "../evidence/storage";
import { runOnce } from "../jobs/worker";
import { acceptInvitation, createTenant, inviteMember, listProjects } from "../tenancy/service";
import { applyImport, listImports, previewImport, rollbackImport } from "./import";

const csv = new TextEncoder().encode("tesis;yakit;miktar\nGebze;dogalgaz;125000\n");
const csvSha = createHash("sha256").update(csv).digest("hex");
const otherSha = "a".repeat(64);

function realClient(id: string, name: string): ClientData {
  const c = emptyClient(id, name);
  c.profile.reportingYear = 2025;
  c.ghg.fuels = [{ ...SAMPLE_CLIENT.ghg.fuels[0], id: "f1" }];
  c.approvals = { ghg: { status: "approved", preparedBy: "Ali Veri", approvedBy: "Veli Onay", approvedAt: "2025-12-20", log: [] } };
  c.importLog = [{ tool: "ghg" as never, fileName: "yakit-2025.csv", sha256: csvSha, importedAt: "2025-12-01T10:00:00Z", rows: 1, applied: 1 }];
  c.sites = [
    { id: "s-plant", name: "Denizli Fabrika", kind: "factory", share: 100, control: "operational" },
    { id: "s-jv", name: "Ortak Boya Tesisi", kind: "factory", share: 50, control: "equity" },
  ];
  c.requests = { templates: null, items: { ghg_fuel: { owner: "Ayşe H.", due: "2026-01-15", status: "accepted", note: "", evidence: { fileName: "fatura.pdf", sha256: otherSha, importedAt: "2025-12-02T10:00:00Z" } } } };
  return c;
}

const file = (version: number, clients: ClientData[]) => JSON.stringify({ app: "isoline", version, exportedAt: "2026-01-01T00:00:00Z", clients, customSets: [] });

let owner: Actor;
let contributor: Actor;

beforeAll(async () => {
  await ensureBucket();
  const o = await makeUser("ImportOwner");
  const t = await createTenant(o, { name: "Ege Tekstil A.Ş.", kind: "company", termsVersion: "t" });
  owner = { userId: o.userId, actingTenantId: t };
  const c = await makeUser("ImportContributor");
  await acceptInvitation(c, (await inviteMember(owner, { email: c.email, role: "contributor" })).token);
  contributor = { userId: c.userId, actingTenantId: t };
});

afterAll(async () => {
  await closeDb();
});

describe("legacy workspace import (G1-11)", () => {
  const v8 = file(8, [structuredClone(SAMPLE_CLIENT), realClient("c-ege", "Ege Tekstil")]);

  it("previews without writing and reports risks R2–R5 and engine totals", async () => {
    const before = await systemDb().selectFrom("core.projects").select("id").where("owner_tenant_id", "=", owner.actingTenantId!).execute();
    const r = await previewImport(owner, v8, "own");
    expect(r.sourceVersion).toBe(8);
    expect(r.migratedTo).toBe(11);
    expect(r.clients).toHaveLength(2);
    const ege = r.clients.find((c) => c.legacyId === "c-ege")!;
    expect(ege.projectName).toBe("Ege Tekstil — 2025");
    expect(ege.evidencePlaceholders).toBe(2);
    expect(ege.unverifiedApprovals).toEqual(["ghg"]);
    expect(ege.ownerLabels).toBe(1);
    expect(ege.totals!.scope1).toBeCloseTo(computeInventory(realClient("x", "x").ghg).scope1, 6);
    expect(r.clients.find((c) => c.sample)!.warnings).toContain("sample_client");
    const after = await systemDb().selectFrom("core.projects").select("id").where("owner_tenant_id", "=", owner.actingTenantId!).execute();
    expect(after.length).toBe(before.length);
  });

  it("refuses non-admins and malformed files", async () => {
    await expect(previewImport(contributor, v8, "own")).rejects.toMatchObject({ status: 403 });
    await expect(previewImport(owner, "{not json", "own")).rejects.toMatchObject({ code: "import_not_json" });
    await expect(previewImport(owner, JSON.stringify({ app: "other", clients: [] }), "own")).rejects.toMatchObject({ code: "import_not_workspace" });
    await expect(previewImport(owner, file(12, [realClient("a", "a")]), "own")).rejects.toMatchObject({ code: "import_unknown_version" });
    await expect(previewImport(owner, JSON.stringify({ app: "isoline", version: 11, clients: [{ id: "x", name: "bozuk" }] }), "own")).rejects.toMatchObject({ code: "import_invalid_client" });
    await expect(previewImport(owner, v8, "provisional")).rejects.toMatchObject({ code: "advisory_only" });
  });

  it("applies once: project, awaiting_file placeholders, unverified approvals as audit only; the same file again is refused", async () => {
    const r = await applyImport(owner, v8, "workspace.json", "own");
    expect(r.projects).toHaveLength(1); // the sample is skipped unless asked for
    const pid = r.projects[0].projectId;
    const ev = await systemDb().selectFrom("core.evidence_objects").select(["sha256", "scan_status", "filename"]).where("project_id", "=", pid).orderBy("sha256").execute();
    expect(ev.map((e) => [e.sha256, e.scan_status])).toEqual([
      [otherSha, "awaiting_file"],
      [csvSha, "awaiting_file"],
    ].sort());
    const approvals = await systemDb().selectFrom("core.audit_events").select(["action", "payload"]).where("project_id", "=", pid).where("action", "=", "legacy.unverified_approval").execute();
    expect(approvals).toHaveLength(1);
    expect(approvals[0].payload).toMatchObject({ section: "ghg", typedApprovedBy: "Veli Onay" });
    expect((await listProjects(owner)).map((p) => p.id)).toContain(pid);
    await expect(applyImport(owner, v8, "workspace.json", "own")).rejects.toMatchObject({ status: 409, code: "import_already_applied" });

    // R1/R2: an unmapped organisation with its parent, the JV site as a 50 % joint entity, and the 2025 cycle with its plan
    const proj = await systemDb().selectFrom("core.projects").select("organization_id").where("id", "=", pid).executeTakeFirstOrThrow();
    const org = await systemDb().selectFrom("core.organizations").select(["mapping_status"]).where("id", "=", proj.organization_id!).executeTakeFirstOrThrow();
    expect(org.mapping_status).toBe("unmapped");
    const ents = await systemDb().selectFrom("core.legal_entities").select(["id", "name", "is_reporting_parent"]).where("organization_id", "=", proj.organization_id!).execute();
    expect(ents.map((e) => e.name).sort()).toEqual(["Ege Tekstil", "Ortak Boya Tesisi"]);
    const edge = await systemDb().selectFrom("core.ownership_edges").select(["share_pct", "control"]).where("child_entity_id", "=", ents.find((e) => !e.is_reporting_parent)!.id).executeTakeFirstOrThrow();
    expect([Number(edge.share_pct), edge.control]).toEqual([50, "joint"]);
    const facs = await systemDb().selectFrom("core.facilities").select(["name", "operated"]).where("legal_entity_id", "in", ents.map((e) => e.id)).orderBy("name").execute();
    expect(facs).toEqual([
      { name: "Denizli Fabrika", operated: true },
      { name: "Ortak Boya Tesisi", operated: false },
    ]);
    const cyc = await systemDb().selectFrom("core.reporting_cycles").select(["id", "reporting_year"]).where("project_id", "=", pid).executeTakeFirstOrThrow();
    expect(cyc.reporting_year).toBe(2025);
    expect((await systemDb().selectFrom("core.work_packages").select("id").where("cycle_id", "=", cyc.id).execute()).length).toBe(13);

    // the archived snapshot reproduces the reported totals (R7 parity anchor for G4)
    const imp = await systemDb().selectFrom("core.legacy_imports").select(["snapshot", "report"]).where("id", "=", r.importId).executeTakeFirstOrThrow();
    const snap = imp.snapshot as unknown as { clients: ClientData[] };
    expect(computeInventory(snap.clients[0].ghg).scope1).toBeCloseTo(r.report.clients[0].totals!.scope1, 6);

    // R5: uploading the very file the old workspace recorded fulfils the placeholder (same row, now scanned)
    const placeholder = await systemDb().selectFrom("core.evidence_objects").select("id").where("project_id", "=", pid).where("sha256", "=", csvSha).executeTakeFirstOrThrow();
    const up = await uploadEvidence(owner, pid, { filename: "yakit-2025.csv", bytes: csv });
    expect(up.id).toBe(placeholder.id);
    expect(up.scanStatus).toBe("scanning");
    // drain the queue: earlier test files may have left notification and mail events ahead of the scan
    while ((await runOnce(100)).handled > 0);
    const done = await systemDb().selectFrom("core.evidence_objects").select("scan_status").where("id", "=", placeholder.id).executeTakeFirstOrThrow();
    expect(done.scan_status).toBe("available");
    // real work now exists: the import can no longer be rolled back
    await expect(rollbackImport(owner, r.importId)).rejects.toMatchObject({ code: "import_in_use" });
  });

  it("rolls back an untouched import completely; the audit trail stays", async () => {
    const r = await applyImport(owner, file(11, [realClient("c-second", "İkinci Şirket")]), "second.json", "own");
    const pid = r.projects[0].projectId;
    expect((await rollbackImport(owner, r.importId)).removedProjects).toBe(1);
    expect(await systemDb().selectFrom("core.projects").select("id").where("id", "=", pid).executeTakeFirst()).toBeUndefined();
    expect(await systemDb().selectFrom("core.evidence_objects").select("id").where("project_id", "=", pid).executeTakeFirst()).toBeUndefined();
    expect(await systemDb().selectFrom("core.organizations").select("id").where("legacy_import_id", "=", r.importId).executeTakeFirst()).toBeUndefined();
    const trail = await systemDb().selectFrom("core.audit_events").select("action").where("project_id", "=", pid).execute();
    expect(trail.map((a) => a.action)).toContain("legacy.import_project");
    expect((await listImports(owner)).find((i) => i.id === r.importId)!.status).toBe("rolled_back");
    await expect(rollbackImport(owner, r.importId)).rejects.toMatchObject({ code: "import_already_rolled_back" });
    // after a rollback the same file may be imported again
    await applyImport(owner, file(11, [realClient("c-second", "İkinci Şirket")]), "second.json", "own");
  });

  it("an advisory imports its clients as provisional customer workspaces; rollback closes them", async () => {
    const a = await makeUser("ImportAdvisor");
    const adv: Actor = { userId: a.userId, actingTenantId: await createTenant(a, { name: "Danışman Ltd.", kind: "advisory", termsVersion: "t" }) };
    const r = await applyImport(adv, file(11, [realClient("m1", "Müşteri Bir"), realClient("m2", "Müşteri İki")]), "portfoy.json", "provisional");
    expect(r.projects).toHaveLength(2);
    const tenants = await systemDb().selectFrom("core.tenants").select(["id", "lifecycle", "steward_tenant_id", "name"]).where("id", "in", r.projects.map((p) => p.ownerTenantId)).execute();
    expect(tenants.every((t) => t.lifecycle === "provisional" && t.steward_tenant_id === adv.actingTenantId)).toBe(true);
    // the advisory reaches the projects as steward; the company workspace does not
    expect((await listProjects(adv)).map((p) => p.id)).toEqual(expect.arrayContaining(r.projects.map((p) => p.projectId)));
    expect((await listProjects(owner)).map((p) => p.id)).not.toContain(r.projects[0].projectId);
    await rollbackImport(adv, r.importId);
    const closed = await systemDb().selectFrom("core.tenants").select("lifecycle").where("id", "in", r.projects.map((p) => p.ownerTenantId)).execute();
    expect(closed.every((t) => t.lifecycle === "closed")).toBe(true);
  });
});
