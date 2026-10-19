/**
 * G1-11: browser workspace file (toolkit export, versions 2–11) → platform projects. Follows the G0 risk register:
 *   R1 organisation details are not invented: the project is created, the organisation stays "unmapped" until G2;
 *   R2 the period comes from profile.reportingYear, a different GHG year is a warning;
 *   R3 typed-name approvals become `legacy.unverified_approval` audit events and grant no approval or lock;
 *   R4 request owners are text labels, kept in the archive, never turned into assignments;
 *   R5 evidence hashes become `awaiting_file` placeholders; uploading the same file later fulfils them;
 *   R6 custom factor sets stay tenant-private in the archive (moved into the factor registry in G4);
 *   R7 outputs are not stored — the parity report records v1 engine totals so the platform can be compared;
 *   R9 the same file cannot be applied twice to a workspace; R10 the source is archived and a rollback removes
 *   exactly what the import created.
 * Nothing is written before the person has seen the preview (the apply call re-parses the file itself).
 */
import { createHash, randomUUID } from "node:crypto";
import { computeInventory } from "@/lib/calc/ghg";
import { SECTION_IDS } from "@/lib/approval";
import type { ClientData } from "@/data/sample";
import type { FactorSet } from "@/lib/factors";
import { isClientShape, migrateClients, WORKSPACE_VERSION } from "@/lib/workspace-migrate";
import { audit } from "../audit/audit";
import { withActor, withSystem, type Actor } from "../db/client";
import { forbidden, HttpError, notFound } from "../policy/policy";
import { requireMemberAction } from "../tenancy/service";

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export type ImportMode = "own" | "provisional";

export type ClientReport = {
  legacyId: string;
  name: string;
  sector: string;
  sample: boolean;
  reportingYear: number | null;
  ghgYear: number | null;
  projectName: string;
  evidencePlaceholders: number;
  unverifiedApprovals: string[];
  requestItems: number;
  ownerLabels: number;
  sourceNotesWithoutFile: number;
  sites: number;
  auditorNotes: number;
  personalDataAggregates: string[];
  totals: { scope1: number; scope2Location: number; scope2Market: number; scope3: number; energyGj: number; electricityMwh: number } | null;
  trialBalance: { accounts: number; debit: number; credit: number; balanced: boolean; year: number | null } | null;
  warnings: string[];
};

export type ImportReport = {
  sourceSha256: string;
  sourceVersion: number;
  migratedTo: number;
  clients: ClientReport[];
  customFactorSets: { id: string; name: string; rightsConfirmed: boolean; factors: number }[];
  counts: { clients: number; projects: number; evidencePlaceholders: number; unverifiedApprovals: number; ownerLabels: number; sites: number };
};

type Parsed = { version: number; clients: ClientData[]; customSets: FactorSet[]; sha256: string };

const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

export function parseWorkspace(raw: string): Parsed {
  if (raw.length > MAX_IMPORT_BYTES) throw new HttpError(413, "file_too_large");
  let d: { app?: string; version?: number; clients?: unknown[]; customSets?: unknown[] };
  try {
    d = JSON.parse(raw);
  } catch {
    throw new HttpError(422, "import_not_json");
  }
  if (!d || d.app !== "isoline" || !Array.isArray(d.clients) || d.clients.length === 0) throw new HttpError(422, "import_not_workspace");
  const version = Number.isInteger(d.version) ? Number(d.version) : 2;
  if (version < 2 || version > WORKSPACE_VERSION) throw new HttpError(422, "import_unknown_version");
  if (d.clients.length > 500) throw new HttpError(422, "import_too_many_clients");
  if (!d.clients.every(isClientShape)) throw new HttpError(422, "import_invalid_client");
  const clients = migrateClients(d.clients as ClientData[], version);
  const ids = new Set<string>();
  for (const c of clients) {
    if (ids.has(c.id)) throw new HttpError(422, "import_duplicate_client_id");
    ids.add(c.id);
  }
  const customSets = (Array.isArray(d.customSets) ? d.customSets : []).filter((s): s is FactorSet => !!s && typeof s === "object" && typeof (s as FactorSet).id === "string");
  return { version, clients, customSets, sha256: createHash("sha256").update(raw).digest("hex") };
}

type Placeholder = { sha256: string; fileName: string; source: string };

/** Every file hash the client recorded (trial balance, import log, accepted request evidence), one per hash. */
export function evidenceHashes(c: ClientData): Placeholder[] {
  const out = new Map<string, Placeholder>();
  const add = (sha: string | undefined, fileName: string | undefined, source: string) => {
    if (sha && /^[0-9a-f]{64}$/.test(sha) && !out.has(sha)) out.set(sha, { sha256: sha, fileName: (fileName || "dosya").slice(0, 255), source });
  };
  add(c.trialBalance?.sha256, c.trialBalance?.fileName, "trial_balance");
  for (const r of c.importLog ?? []) add(r.sha256, r.fileName, `import:${r.tool}`);
  for (const t of Object.values(c.requests?.items ?? {})) add(t.evidence?.sha256, t.evidence?.fileName, "request");
  return [...out.values()];
}

function clientReport(c: ClientData): ClientReport {
  const warnings: string[] = [];
  const reportingYear = Number.isInteger(c.profile?.reportingYear) ? c.profile.reportingYear : null;
  const ghgYear = Number.isInteger((c.ghg as { year?: number })?.year) ? (c.ghg as { year?: number }).year! : null;
  if (!reportingYear) warnings.push("no_reporting_year");
  if (reportingYear && ghgYear && reportingYear !== ghgYear) warnings.push("ghg_year_differs");
  if (c.sample) warnings.push("sample_client");
  let totals: ClientReport["totals"] = null;
  try {
    const r = computeInventory(c.ghg);
    totals = { scope1: round(r.scope1), scope2Location: round(r.scope2Location), scope2Market: round(r.scope2Market), scope3: round(r.scope3), energyGj: round(r.energyGj), electricityMwh: round(r.electricityMwh) };
  } catch {
    warnings.push("ghg_not_computable");
  }
  let trialBalance: ClientReport["trialBalance"] = null;
  if (c.trialBalance) {
    const debit = c.trialBalance.accounts.reduce((s, a) => s + (Number(a.debit) || 0), 0);
    const credit = c.trialBalance.accounts.reduce((s, a) => s + (Number(a.credit) || 0), 0);
    trialBalance = { accounts: c.trialBalance.accounts.length, debit: round(debit, 2), credit: round(credit, 2), balanced: Math.abs(debit - credit) <= Math.max(1, Math.abs(debit) * 1e-9), year: c.trialBalance.year ?? null };
    if (!trialBalance.balanced) warnings.push("trial_balance_unbalanced");
    if (trialBalance.year && reportingYear && trialBalance.year !== reportingYear) warnings.push("trial_balance_year_differs");
  }
  const approvals = c.approvals ?? {};
  const unverifiedApprovals = SECTION_IDS.filter((s) => approvals[s] && approvals[s]!.status !== "draft");
  const items = Object.values(c.requests?.items ?? {});
  const personal: string[] = [];
  const ind = c.indicators as unknown as Record<string, unknown> | undefined;
  if (ind?.safety) personal.push("safety");
  if (ind?.workforce) personal.push("workforce");
  return {
    legacyId: c.id,
    name: c.name,
    sector: c.sector,
    sample: !!c.sample,
    reportingYear,
    ghgYear,
    projectName: `${c.name.trim().slice(0, 170) || "İsimsiz"}${reportingYear ? ` — ${reportingYear}` : ""}`,
    evidencePlaceholders: evidenceHashes(c).length,
    unverifiedApprovals,
    requestItems: items.length,
    ownerLabels: items.filter((t) => t.owner?.trim()).length,
    sourceNotesWithoutFile: items.filter((t) => t.source?.doc && !t.evidence).length,
    sites: c.sites?.length ?? 0,
    auditorNotes: (c.audit?.notes?.length ?? 0) + (c.audit?.requests?.length ?? 0),
    personalDataAggregates: personal,
    totals,
    trialBalance,
    warnings,
  };
}

export function buildReport(p: Parsed): ImportReport {
  const clients = p.clients.map(clientReport);
  return {
    sourceSha256: p.sha256,
    sourceVersion: p.version,
    migratedTo: WORKSPACE_VERSION,
    clients,
    customFactorSets: p.customSets.map((s) => ({ id: s.id, name: String(s.name ?? s.id), rightsConfirmed: !!s.rightsConfirmed, factors: Array.isArray((s as { factors?: unknown[] }).factors) ? (s as { factors: unknown[] }).factors.length : 0 })),
    counts: {
      clients: clients.length,
      projects: clients.length,
      evidencePlaceholders: clients.reduce((s, c) => s + c.evidencePlaceholders, 0),
      unverifiedApprovals: clients.reduce((s, c) => s + c.unverifiedApprovals.length, 0),
      ownerLabels: clients.reduce((s, c) => s + c.ownerLabels, 0),
      sites: clients.reduce((s, c) => s + c.sites, 0),
    },
  };
}

async function authorize(actor: Actor, mode: ImportMode): Promise<{ kind: string }> {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    const t = await tx.selectFrom("core.tenants").select(["kind", "lifecycle"]).where("id", "=", actor.actingTenantId!).executeTakeFirstOrThrow();
    if (mode === "provisional" && t.kind !== "advisory") throw forbidden("advisory_only");
    if (t.lifecycle !== "active") throw forbidden("tenant_not_active");
    return { kind: t.kind };
  });
}

async function alreadyApplied(actor: Actor, sha256: string): Promise<string | null> {
  return withActor(actor, async (tx) => {
    const r = await tx.selectFrom("core.legacy_imports").select("id").where("owner_tenant_id", "=", actor.actingTenantId!).where("source_sha256", "=", sha256).where("status", "=", "applied").executeTakeFirst();
    return r?.id ?? null;
  });
}

export async function previewImport(actor: Actor, raw: string, mode: ImportMode): Promise<ImportReport & { alreadyAppliedId: string | null }> {
  await authorize(actor, mode);
  const parsed = parseWorkspace(raw);
  return { ...buildReport(parsed), alreadyAppliedId: await alreadyApplied(actor, parsed.sha256) };
}

export async function applyImport(actor: Actor, raw: string, fileName: string, mode: ImportMode, opts: { includeSample?: boolean } = {}): Promise<{ importId: string; projects: { legacyId: string; projectId: string; ownerTenantId: string }[]; report: ImportReport }> {
  await authorize(actor, mode);
  const parsed = parseWorkspace(raw);
  if (await alreadyApplied(actor, parsed.sha256)) throw new HttpError(409, "import_already_applied");
  const clients = opts.includeSample ? parsed.clients : parsed.clients.filter((c) => !c.sample);
  if (!clients.length) throw new HttpError(422, "import_only_sample");
  const report = buildReport({ ...parsed, clients });
  const name = fileName.split(/[\\/]/).pop()!.slice(0, 255) || "workspace.json";

  // one privileged transaction after the permission check: a provisional import creates customer tenants, which
  // the app role cannot do; everything is attributed to the actor in the audit trail
  return withSystem("legacy import: create projects and placeholders after tenant.manage check", async (tx) => {
    const imp = await tx
      .insertInto("core.legacy_imports")
      .values({ owner_tenant_id: actor.actingTenantId!, imported_by: actor.userId, file_name: name, source_sha256: parsed.sha256, source_version: parsed.version, mode, snapshot: JSON.stringify({ app: "isoline", version: WORKSPACE_VERSION, clients, customSets: parsed.customSets }), report: JSON.stringify(report) })
      .returning("id")
      .executeTakeFirstOrThrow();
    const projects: { legacyId: string; projectId: string; ownerTenantId: string }[] = [];
    for (const [i, c] of clients.entries()) {
      const r = report.clients[i];
      let owner = actor.actingTenantId!;
      if (mode === "provisional") {
        const t = await tx.insertInto("core.tenants").values({ name: c.name.trim().slice(0, 200) || "İsimsiz müşteri", kind: "company", lifecycle: "provisional", created_by: actor.userId, steward_tenant_id: actor.actingTenantId }).returning("id").executeTakeFirstOrThrow();
        owner = t.id;
        await audit(tx, actor, { action: "client.provisional_create", objectType: "tenant", objectId: owner, ownerTenantId: owner, after: { name: c.name, steward: actor.actingTenantId, legacyImport: imp.id } });
      }
      const p = await tx.insertInto("core.projects").values({ owner_tenant_id: owner, name: r.projectName, created_by: actor.userId, legacy_import_id: imp.id, legacy_client_id: c.id }).returning("id").executeTakeFirstOrThrow();
      projects.push({ legacyId: c.id, projectId: p.id, ownerTenantId: owner });
      await audit(tx, actor, { action: "legacy.import_project", objectType: "project", objectId: p.id, ownerTenantId: owner, projectId: p.id, after: { legacyClientId: c.id, name: r.projectName, reportingYear: r.reportingYear }, payload: { importId: imp.id, warnings: r.warnings } });
      for (const ph of evidenceHashes(c)) {
        const id = randomUUID();
        await tx
          .insertInto("core.evidence_objects")
          .values({ id, owner_tenant_id: owner, project_id: p.id, storage_key: `pending/${id}`, filename: ph.fileName, mime: "application/octet-stream", size_bytes: 0, sha256: ph.sha256, scan_status: "awaiting_file", scan_detail: `legacy:${ph.source}`, uploaded_by: actor.userId, legacy_import_id: imp.id })
          .execute();
      }
      for (const section of r.unverifiedApprovals) {
        const a = c.approvals[section as keyof typeof c.approvals]!;
        // a typed name is not an identity: recorded for history, grants no approval (R3)
        await audit(tx, actor, { action: "legacy.unverified_approval", objectType: "project_section", objectId: `${p.id}:${section}`, ownerTenantId: owner, projectId: p.id, payload: { section, legacyStatus: a.status, typedPreparedBy: a.preparedBy, typedApprovedBy: a.approvedBy, approvedAt: a.approvedAt } });
      }
    }
    await audit(tx, actor, { action: "legacy.import", objectType: "legacy_import", objectId: imp.id, ownerTenantId: actor.actingTenantId, after: { file: name, sha256: parsed.sha256, version: parsed.version, mode, projects: projects.length }, payload: { counts: report.counts } });
    return { importId: imp.id, projects, report };
  });
}

export async function listImports(actor: Actor) {
  return withActor(actor, async (tx) => {
    await requireMemberAction(tx, actor, "tenant.manage");
    return tx.selectFrom("core.legacy_imports").select(["id", "file_name", "source_sha256", "source_version", "mode", "status", "created_at", "rolled_back_at", "report"]).where("owner_tenant_id", "=", actor.actingTenantId!).orderBy("created_at", "desc").execute();
  });
}

/**
 * Removes what an import created (R10): its projects, their placeholders and provisional tenants — refused once real
 * work exists on them (an uploaded file, a grant, a newer project in the tenant). Audit rows stay.
 */
export async function rollbackImport(actor: Actor, importId: string): Promise<{ removedProjects: number }> {
  await authorize(actor, "own");
  return withSystem("legacy import rollback after tenant.manage check", async (tx) => {
    const imp = await tx.selectFrom("core.legacy_imports").selectAll().where("id", "=", importId).where("owner_tenant_id", "=", actor.actingTenantId!).forUpdate().executeTakeFirst();
    if (!imp) throw notFound();
    if (imp.status !== "applied") throw new HttpError(409, "import_already_rolled_back");
    const projects = await tx.selectFrom("core.projects").select(["id", "owner_tenant_id"]).where("legacy_import_id", "=", importId).execute();
    const ids = projects.map((p) => p.id);
    if (ids.length) {
      const used = await tx.selectFrom("core.evidence_objects").select("id").where("project_id", "in", ids).where((eb) => eb.or([eb("legacy_import_id", "is", null), eb("scan_status", "!=", "awaiting_file")])).executeTakeFirst();
      const shared = await tx.selectFrom("core.external_grants").select("id").where("project_id", "in", ids).executeTakeFirst();
      if (used || shared) throw new HttpError(409, "import_in_use");
      await tx.deleteFrom("core.evidence_objects").where("project_id", "in", ids).execute();
      await tx.deleteFrom("core.projects").where("id", "in", ids).execute();
    }
    if (imp.mode === "provisional") {
      for (const owner of new Set(projects.map((p) => p.owner_tenant_id))) {
        const left = await tx.selectFrom("core.projects").select("id").where("owner_tenant_id", "=", owner).executeTakeFirst();
        const t = await tx.selectFrom("core.tenants").select(["lifecycle", "steward_tenant_id"]).where("id", "=", owner).executeTakeFirst();
        // an unclaimed, now empty provisional tenant created by this import is closed (rows stay for the audit trail)
        if (!left && t?.lifecycle === "provisional" && t.steward_tenant_id === actor.actingTenantId) await tx.updateTable("core.tenants").set({ lifecycle: "closed", steward_tenant_id: null }).where("id", "=", owner).execute();
      }
    }
    await tx.updateTable("core.legacy_imports").set({ status: "rolled_back", rolled_back_at: new Date(), rolled_back_by: actor.userId }).where("id", "=", importId).execute();
    await audit(tx, actor, { action: "legacy.rollback", objectType: "legacy_import", objectId: importId, ownerTenantId: actor.actingTenantId, payload: { removedProjects: ids.length } });
    return { removedProjects: ids.length };
  });
}
