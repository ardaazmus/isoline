/**
 * Evidence vault (Faz 3, docs/HEDEF_MIMARI.md §3 and §8).
 * Content-addressed manifest over the client's import log plus hand-entered
 * source notes: one record per SHA-256, deduplicated across tools.
 *
 * Storage backends share one interface so the browser-local vault can move to
 * an S3-compatible store (MinIO yerelde, R2 bulutta) without touching screens:
 *
 *   interface VaultBackend { put(meta): Promise<void>; has(sha256): Promise<boolean> }
 *
 * v1 ships only the local backend (metadata lives in the client record; file
 * bytes stay where the user keeps them). The manifest is what the auditor
 * checks: which hash backs which data, and which accepted items still lack one.
 */
import type { ClientData } from "@/data/sample";
import { trackOf } from "./requests";
import type { ImportRecord } from "./imports";

export type VaultBackendKind = "local" | "s3";

export type VaultRecord = {
  sha256: string;
  fileName: string;
  importedAt: string;
  tools: string[];
  rows: number;
  applied: number;
};

export type VaultManifest = {
  backend: VaultBackendKind;
  /** One record per distinct SHA-256, newest first. */
  records: VaultRecord[];
  /** Accepted request items with neither a file link nor a source note. */
  missing: { itemId: string; section: string }[];
  /** Accepted items backed by a hand-entered source note instead of a file. */
  noted: { itemId: string; section: string; doc: string; date: string }[];
};

export type VaultBackend = {
  readonly kind: VaultBackendKind;
  has(sha256: string): Promise<boolean>;
  /** Records file metadata; v1 local backend keeps metadata client-side. */
  put(rec: ImportRecord): Promise<void>;
};

/** v1 local backend: metadata is already in the client record; bytes stay with the user. */
export function localVault(records: ImportRecord[]): VaultBackend & { manifest(): VaultManifest } {
  const known = new Set(records.map((r) => r.sha256));
  return {
    kind: "local",
    has: async (sha256: string) => known.has(sha256),
    put: async (rec: ImportRecord) => {
      known.add(rec.sha256);
    },
    manifest: () => buildVaultManifest({ importLog: records }, [], "local"),
  };
}

/**
 * Builds the vault manifest for one client. `templateItemIds` scopes the
 * missing/noted check to the reports being prepared (pass generateRequests ids).
 */
export function buildVaultManifest(
  client: Partial<Pick<ClientData, "importLog" | "requests">>,
  templateItemIds: readonly { id: string; section: string }[],
  backend: VaultBackendKind = "local",
): VaultManifest {
  const byHash = new Map<string, VaultRecord>();
  for (const r of client.importLog ?? []) {
    const prev = byHash.get(r.sha256);
    if (prev) {
      if (!prev.tools.includes(r.tool)) prev.tools.push(r.tool);
      if (r.importedAt > prev.importedAt) {
        prev.fileName = r.fileName;
        prev.importedAt = r.importedAt;
      }
      prev.rows += r.rows;
      prev.applied += r.applied;
    } else {
      byHash.set(r.sha256, { sha256: r.sha256, fileName: r.fileName, importedAt: r.importedAt, tools: [r.tool], rows: r.rows, applied: r.applied });
    }
  }
  const missing: VaultManifest["missing"] = [];
  const noted: VaultManifest["noted"] = [];
  for (const i of templateItemIds) {
    const tr = trackOf(client.requests, i.id);
    if (tr.status !== "accepted") continue;
    if (tr.evidence) continue;
    if (tr.source?.doc) {
      noted.push({ itemId: i.id, section: i.section, doc: tr.source.doc, date: tr.source.date ?? "" });
    } else {
      missing.push({ itemId: i.id, section: i.section });
    }
  }
  return {
    backend,
    records: [...byHash.values()].sort((a, b) => (a.importedAt < b.importedAt ? 1 : -1)),
    missing,
    noted,
  };
}
