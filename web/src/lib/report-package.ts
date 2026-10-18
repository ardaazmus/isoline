/**
 * Single report package + künye (reporting workflow step 5, docs/DENETIM_RAPORLAMA_2026-10.md §2.4 and §4 item 4).
 * One client, one file: visibility level first, then approvals, evidence (import SHA-256 + source notes),
 * request progress and the reconciliation record. Browser-local (v1 has no server); the auditor gets this
 * JSON plus the Word/CSV files the tools already export.
 */
import type { ClientData } from "@/data/sample";
import { approvalOf, allLocked, SECTION_IDS, type SectionId } from "./approval";
import { openAuditCounts } from "./auditor";
import { ENGINE_VERSION, reconcile } from "./reconcile";
import { generateRequests, trackOf, hasEvidence, isOverdue } from "./requests";

/** Who may see the package: internal, authority/auditor/importer/shareholder, or everyone. */
export type Visibility = "internal" | "authorized" | "public";
export const VISIBILITIES: Visibility[] = ["internal", "authorized", "public"];

export type PackageApproval = {
  section: SectionId;
  status: string;
  preparedBy: string;
  approvedBy: string;
  approvedAt: string | null;
  events: number;
};

export type PackageEvidenceFile = {
  tool: string;
  fileName: string;
  sha256: string;
  importedAt: string;
  rows: number;
  applied: number;
};

export type PackageItem = {
  id: string;
  section: SectionId;
  owner: string;
  due: string;
  status: string;
  overdue: boolean;
  evidenced: boolean;
  sourceDoc: string;
  sourceDate: string;
  evidenceFile: string;
  evidenceSha256: string;
};

export type ReportPackage = {
  /** Künye first: visibility level, then what the file is. */
  visibility: Visibility;
  kind: "isoline-report-package";
  packageVersion: 1;
  exportedAt: string;
  client: { id: string; name: string; reportingYear: number; sample: boolean };
  locked: boolean;
  approvals: PackageApproval[];
  requests: { templates: string[]; total: number; accepted: number; overdue: number; unevidencedAccepted: number; items: PackageItem[] };
  evidenceFiles: PackageEvidenceFile[];
  audit: { notes: number; openNotes: number; requests: number; openRequests: number };
  reconciliation: { engine: string; counts: Record<string, number>; rules: { id: string; severity: string; status: string; checks: number }[] };
};

export function buildReportPackage(
  client: ClientData,
  opts: { visibility: Visibility; templateIds: readonly string[]; exportedAt: string; today?: string | null },
): ReportPackage {
  const items = generateRequests(client, opts.templateIds);
  const today = opts.today ?? null;
  let accepted = 0;
  let overdue = 0;
  let unevidencedAccepted = 0;
  const pkgItems: PackageItem[] = items.map((i) => {
    const tr = trackOf(client.requests, i.id);
    const od = isOverdue(tr, today);
    const ev = hasEvidence(tr);
    if (tr.status === "accepted") {
      accepted++;
      if (!ev) unevidencedAccepted++;
    }
    if (od) overdue++;
    return {
      id: i.id,
      section: i.section,
      owner: tr.owner,
      due: tr.due,
      status: tr.status,
      overdue: od,
      evidenced: ev,
      sourceDoc: tr.source?.doc ?? "",
      sourceDate: tr.source?.date ?? "",
      evidenceFile: tr.evidence?.fileName ?? "",
      evidenceSha256: tr.evidence?.sha256 ?? "",
    };
  });
  const rec = reconcile(client);
  return {
    visibility: opts.visibility,
    kind: "isoline-report-package",
    packageVersion: 1,
    exportedAt: opts.exportedAt,
    client: { id: client.id, name: client.name, reportingYear: client.profile.reportingYear, sample: client.sample },
    locked: allLocked(
      client.approvals,
      SECTION_IDS.filter((s) => items.some((i) => i.section === s)),
    ),
    approvals: SECTION_IDS.map((s) => {
      const a = approvalOf(client.approvals, s);
      return { section: s, status: a.status, preparedBy: a.preparedBy, approvedBy: a.approvedBy, approvedAt: a.approvedAt, events: a.log.length };
    }),
    requests: {
      templates: [...opts.templateIds],
      total: items.length,
      accepted,
      overdue,
      unevidencedAccepted,
      items: pkgItems,
    },
    audit: {
      notes: client.audit?.notes.length ?? 0,
      openNotes: openAuditCounts(client.audit ?? { notes: [], requests: [] }).notes,
      requests: client.audit?.requests.length ?? 0,
      openRequests: openAuditCounts(client.audit ?? { notes: [], requests: [] }).requests,
    },
    evidenceFiles: (client.importLog ?? []).map((r) => ({
      tool: r.tool,
      fileName: r.fileName,
      sha256: r.sha256,
      importedAt: r.importedAt,
      rows: r.rows,
      applied: r.applied,
    })),
    reconciliation: {
      engine: ENGINE_VERSION,
      counts: { ...rec.counts },
      rules: rec.rules.map((r) => ({ id: r.id, severity: r.severity, status: r.status, checks: r.checks.length })),
    },
  };
}

/** File name for the downloaded package: isoline-paket-<slug>-<date>.json */
export function packageFileName(clientName: string, exportedAt: string): string {
  const slug = clientName
    .toLocaleLowerCase("tr")
    .replace(/[^a-z0-9çğıöşü]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `isoline-paket-${slug || "musteri"}-${exportedAt.slice(0, 10)}.json`;
}
