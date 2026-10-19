/**
 * Writes the metric catalogue (catalog.ts) into core.metric_definitions. Rows are append-only: a definition whose
 * meaning changed must get a new version — an existing (code, version) with different content is an error.
 */
import { withSystem } from "../db/client";
import { CATALOG_VERSION, METRICS } from "./catalog";

const same = (a: unknown[], b: unknown[]) => JSON.stringify(a) === JSON.stringify(b);

export async function syncCatalog(): Promise<{ inserted: number }> {
  return withSystem("catalogue sync at deploy time", async (tx) => {
    const rows = await tx.selectFrom("core.metric_definitions").selectAll().execute();
    const have = new Map(rows.map((r) => [`${r.code}@${r.version}`, r]));
    let inserted = 0;
    for (const m of METRICS) {
      const r = have.get(`${m.code}@${m.version}`);
      if (r) {
        const drift = r.aggregation !== m.aggregation || r.grain !== m.grain || !same(r.dimensions, m.dimensions) || r.multiline !== m.multiline || r.evidence_required !== m.evidenceRequired || r.sensitive !== m.sensitive;
        if (drift) throw new Error(`metric ${m.code}@${m.version} changed without a new version`);
        continue;
      }
      await tx
        .insertInto("core.metric_definitions")
        .values({ code: m.code, version: m.version, section: m.section, role: m.role, unit_key: m.unitKey, dimensions: m.dimensions, aggregation: m.aggregation, grain: m.grain, period_kind: m.periodKind, crosswalk: m.crosswalk, sensitive: m.sensitive, evidence_required: m.evidenceRequired, multiline: m.multiline, line_keys: m.lineKeys, catalog_version: CATALOG_VERSION })
        .execute();
      inserted++;
    }
    return { inserted };
  });
}
