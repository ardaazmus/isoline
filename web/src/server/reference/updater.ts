/**
 * Reference-data version log (G8-03; plan 07, plan 12 §6). Built-in reference data ships with the code: the
 * factor library, the metric catalogue, the report templates, the regulation and source register, the industry
 * packs. On every deploy (`npm run db:migrate`) their content digests are compared with the last recorded ones;
 * a change is written to core.reference_versions with what was added and removed — so "which official source
 * changed, when, and what moved" is answerable from the database, not from memory.
 */
import { createHash } from "node:crypto";
import { TEMPLATES } from "@/data/templates";
import { EVENTS } from "@/data/regulations";
import { SOURCES } from "@/data/sources";
import { BUILTIN_SETS } from "@/lib/factors";
import { canonicalJson } from "../audit/audit";
import { withSystem } from "../db/client";
import { CATALOG_VERSION, METRICS } from "../data/catalog";
import { PACKS } from "../industry/packs";

export type RefKind = "factor_library" | "metric_catalogue" | "report_templates" | "regulation_register" | "industry_packs";
type Item = { id: string; body: unknown };

const sha = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");

/** The items of each kind, each with a stable id; the digest of the kind is the digest of all items. */
export function referenceItems(): Record<RefKind, { version: string; items: Item[] }> {
  return {
    factor_library: { version: BUILTIN_SETS.map((s) => `${s.id}@${s.asOf}`).sort().join(",").slice(0, 200), items: BUILTIN_SETS.flatMap((s) => s.factors.map((f) => ({ id: `${s.id}/${f.kind}/${f.key}`, body: [f.value, f.ncv ?? null, f.ch4 ?? null, f.n2o ?? null, f.unit ?? null] }))) },
    metric_catalogue: { version: CATALOG_VERSION, items: METRICS.map((m) => ({ id: `${m.code}@${m.version}`, body: m })) },
    report_templates: { version: String(TEMPLATES.length), items: TEMPLATES.map((t) => ({ id: t.id, body: t.sections.map((s) => [s.id, s.refs]) })) },
    regulation_register: { version: String(EVENTS.length + Object.keys(SOURCES).length), items: [...EVENTS.map((e) => ({ id: `event:${e.id}`, body: e })), ...Object.values(SOURCES).map((s) => ({ id: `source:${s.id}`, body: s }))] },
    industry_packs: { version: PACKS.map((p) => `${p.id}@${p.version}`).join(","), items: PACKS.map((p) => ({ id: `${p.id}@${p.version}`, body: p })) },
  };
}

/** Diff of two item lists: ids added, removed and changed (same id, different content). */
export function diffItems(before: Record<string, string>, after: Record<string, string>) {
  const added = Object.keys(after).filter((k) => !(k in before));
  const removed = Object.keys(before).filter((k) => !(k in after));
  const changed = Object.keys(after).filter((k) => k in before && before[k] !== after[k]);
  return { added, removed, changed };
}

export async function syncReferenceVersions(): Promise<{ changed: RefKind[] }> {
  const all = referenceItems();
  return withSystem("reference data: record versions at deploy", async (tx) => {
    const changed: RefKind[] = [];
    for (const [kind, { version, items }] of Object.entries(all) as [RefKind, { version: string; items: Item[] }][]) {
      const hashes = Object.fromEntries(items.map((i) => [i.id, sha(i.body).slice(0, 16)]));
      const digest = sha(hashes);
      const last = await tx.selectFrom("core.reference_versions").select(["digest", "summary"]).where("kind", "=", kind).orderBy("id", "desc").executeTakeFirst();
      if (last?.digest === digest) continue;
      const before = ((last?.summary as { hashes?: Record<string, string> } | undefined)?.hashes ?? {}) as Record<string, string>;
      const d = diffItems(before, hashes);
      // the same content seen again (a rollback) is already a known version: record nothing new
      const known = await tx.selectFrom("core.reference_versions").select("id").where("kind", "=", kind).where("digest", "=", digest).executeTakeFirst();
      if (known) continue;
      await tx
        .insertInto("core.reference_versions")
        .values({ kind, version, digest, summary: JSON.stringify({ items: items.length, added: d.added.slice(0, 500), removed: d.removed.slice(0, 500), changed: d.changed.slice(0, 500), counts: { added: d.added.length, removed: d.removed.length, changed: d.changed.length }, hashes }) })
        .execute();
      changed.push(kind);
    }
    return { changed };
  });
}

export async function referenceLog() {
  return withSystem("reference data: read the log", (tx) =>
    tx
      .selectFrom("core.reference_versions")
      .select(["id", "kind", "version", "digest", "applied_at", "summary"])
      .orderBy("id", "desc")
      .limit(100)
      .execute()
      .then((rows) => rows.map((r) => ({ ...r, summary: { ...(r.summary as Record<string, unknown>), hashes: undefined } }))),
  );
}
