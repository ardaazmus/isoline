/**
 * Industry packs in a project (G7-04..06): which packs are on and for which facilities, the data requests they
 * add to a campaign (with the pack, version, status and basis as the request's trace), and the "industry" run
 * that computes the pack KPIs over accepted observations and current GHG facts.
 */
import { createHash } from "node:crypto";
import { sql } from "kysely";
import { audit, canonicalJson } from "../audit/audit";
import { withActor, type Actor, type Tx } from "../db/client";
import { METRIC } from "../data/catalog";
import { HttpError, notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { issueCounts, recordIssues, supersedeOpenIssues, writeFacts, type RunRef } from "../calc/service";
import type { Obs } from "../calc/ghg-engine";
import { computeIndustry } from "./engine";
import { PACK, PACKS, suggestPacks } from "./packs";

export const INDUSTRY_VERSION = "industry-packs-2026.10";
const NO_FACTORS = createHash("sha256").update("[]").digest("hex");
const sha = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");

async function projectFacilities(tx: Tx, projectId: string) {
  const p = await tx.selectFrom("core.projects").select(["organization_id", "owner_tenant_id"]).where("id", "=", projectId).executeTakeFirstOrThrow();
  if (!p.organization_id) return [];
  return tx
    .selectFrom("core.facilities as f")
    .innerJoin("core.legal_entities as e", "e.id", "f.legal_entity_id")
    .select(["f.id", "f.name", "f.nace_code"])
    .where("e.organization_id", "=", p.organization_id)
    .orderBy("f.name")
    .execute();
}

export async function projectPacks(actor: Actor, projectId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    const facilities = await projectFacilities(tx, projectId);
    const enabled = await tx.selectFrom("core.project_industry_packs").select(["id", "pack_id", "pack_version", "facility_ids", "enabled_at"]).where("project_id", "=", projectId).where("disabled_at", "is", null).execute();
    const suggested = suggestPacks(facilities.map((f) => f.nace_code));
    return {
      facilities,
      packs: PACKS.map((p) => ({ ...p, suggested: suggested.includes(p.id), suggestedFacilities: facilities.filter((f) => suggestPacks([f.nace_code]).includes(p.id)).map((f) => f.id), enabled: enabled.find((e) => e.pack_id === p.id) ?? null })),
    };
  });
}

/** Switches a pack on (or changes its facilities); a project can carry several packs (mixed activities). */
export async function enablePack(actor: Actor, projectId: string, packId: string, facilityIds: string[]): Promise<void> {
  const pack = PACK.get(packId);
  if (!pack) throw new HttpError(422, "unknown_pack");
  await withActor(actor, async (tx) => {
    const a = await requireProjectAction(tx, actor, projectId, "project.update");
    const own = new Set((await projectFacilities(tx, projectId)).map((f) => f.id));
    if (facilityIds.some((f) => !own.has(f))) throw new HttpError(422, "facility_not_in_project");
    const cur = await tx.selectFrom("core.project_industry_packs").select("id").where("project_id", "=", projectId).where("pack_id", "=", packId).where("disabled_at", "is", null).executeTakeFirst();
    if (cur) await tx.updateTable("core.project_industry_packs").set({ facility_ids: facilityIds }).where("id", "=", cur.id).execute();
    else await tx.insertInto("core.project_industry_packs").values({ owner_tenant_id: a.ownerTenantId, project_id: projectId, pack_id: packId, pack_version: pack.version, facility_ids: facilityIds, enabled_by: actor.userId }).execute();
    await audit(tx, actor, { action: "industry.pack_enable", objectType: "project", objectId: projectId, ownerTenantId: a.ownerTenantId, projectId, after: { pack: packId, version: pack.version, facilities: facilityIds.length } });
  });
}

export async function disablePack(actor: Actor, projectId: string, packId: string): Promise<void> {
  await withActor(actor, async (tx) => {
    const a = await requireProjectAction(tx, actor, projectId, "project.update");
    const r = await tx.updateTable("core.project_industry_packs").set({ disabled_at: new Date(), disabled_by: actor.userId }).where("project_id", "=", projectId).where("pack_id", "=", packId).where("disabled_at", "is", null).returning("id").executeTakeFirst();
    if (!r) throw notFound();
    await audit(tx, actor, { action: "industry.pack_disable", objectType: "project", objectId: projectId, ownerTenantId: a.ownerTenantId, projectId, after: { pack: packId } });
  });
}

/** Adds the enabled packs' data items to a campaign: per pack facility for facility-level items, once otherwise. */
export async function addPackRequests(actor: Actor, campaignId: string): Promise<{ created: number }> {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.data_campaigns as c").innerJoin("core.reporting_cycles as y", "y.id", "c.cycle_id").select(["c.id", "c.project_id", "c.cycle_id", "c.owner_tenant_id", "y.period_start", "y.period_end", "y.label"]).where("c.id", "=", campaignId).executeTakeFirst();
    if (!c) throw notFound("campaign_not_found");
    await requireProjectAction(tx, actor, c.project_id, "data.request");
    const packs = await tx.selectFrom("core.project_industry_packs").select(["pack_id", "pack_version", "facility_ids"]).where("project_id", "=", c.project_id).where("disabled_at", "is", null).execute();
    if (!packs.length) throw new HttpError(422, "no_packs");
    const existing = await tx.selectFrom("core.data_requests").select(["metric_code", "facility_id"]).where("campaign_id", "=", campaignId).execute();
    const have = new Set(existing.map((r) => `${r.metric_code}|${r.facility_id ?? ""}`));
    let created = 0;
    for (const p of packs) {
      const pack = PACK.get(p.pack_id)!;
      for (const pm of pack.metrics) {
        const m = METRIC.get(pm.code)!;
        const targets: (string | null)[] = m.grain === "facility" ? p.facility_ids : [null];
        for (const f of targets) {
          if (have.has(`${m.code}|${f ?? ""}`)) continue;
          have.add(`${m.code}|${f ?? ""}`);
          await tx
            .insertInto("core.data_requests")
            .values({ owner_tenant_id: c.owner_tenant_id, project_id: c.project_id, cycle_id: c.cycle_id, campaign_id: campaignId, metric_code: m.code, metric_version: m.version, facility_id: f, period_label: c.label, period_start: c.period_start, period_end: c.period_end, traces: JSON.stringify([{ pack: pack.id, version: p.pack_version, status: pm.status, basis: pm.basis }]), created_by: actor.userId })
            .execute();
          created++;
        }
      }
    }
    await audit(tx, actor, { action: "industry.pack_requests", objectType: "data_campaign", objectId: campaignId, ownerTenantId: c.owner_tenant_id, projectId: c.project_id, after: { packs: packs.map((p) => p.pack_id), created } });
    return { created };
  });
}

/** G7-05/06: the pack KPIs of a cycle as metric facts, with their findings (idempotent on the inputs). */
export async function runIndustry(actor: Actor, cycleId: string): Promise<{ runId: string; reused: boolean; facts: number; blockers: number; warnings: number }> {
  return withActor(actor, async (tx) => {
    const cycle = await tx.selectFrom("core.reporting_cycles").select(["id", "project_id", "owner_tenant_id", "status"]).where("id", "=", cycleId).executeTakeFirst();
    if (!cycle) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, cycle.project_id, "calc.run");
    if (["frozen", "released"].includes(cycle.status)) throw new HttpError(409, "cycle_frozen");
    const packs = (await tx.selectFrom("core.project_industry_packs").select(["pack_id", "pack_version", "facility_ids"]).where("project_id", "=", cycle.project_id).where("disabled_at", "is", null).execute()).map((p) => ({ id: p.pack_id, version: p.pack_version, facilityIds: [...p.facility_ids].sort() }));
    if (!packs.length) throw new HttpError(422, "no_packs");
    const metrics = [...new Set(packs.flatMap((p) => PACK.get(p.id)!.metrics.map((m) => m.code)))];
    const rows = await tx
      .selectFrom("core.observation_versions as o")
      .innerJoin("core.data_requests as r", "r.id", "o.request_id")
      .select(["o.id", "o.canonical_value", "o.canonical_unit", "o.lines", "o.quality", "r.metric_code", "r.facility_id"])
      .where("r.cycle_id", "=", cycleId)
      .where("r.metric_code", "in", metrics)
      .where("o.status", "=", "accepted")
      .execute();
    const observations: Obs[] = rows.map((v) => ({ versionId: v.id, metricCode: v.metric_code, facilityId: v.facility_id, canonical: v.canonical_value, canonicalUnit: v.canonical_unit, lines: (v.lines as Obs["lines"]) ?? null, quality: v.quality as Obs["quality"] })).sort((a, b) => a.versionId.localeCompare(b.versionId));
    const factRows = await tx
      .selectFrom("core.metric_fact_versions")
      .select(["id", "metric_key", "facility_id", "boundary_kind", "value_num", "status"])
      .where("cycle_id", "=", cycleId)
      .where("metric_key", "in", ["ghg.scope1", "ghg.scope2.location", "ghg.scope1.mobile"])
      .where("status", "in", ["approved", "locked", "ready_for_review"])
      .orderBy("revision", "desc")
      .execute();
    const seen = new Set<string>();
    const facts = factRows
      .filter((f) => {
        const k = `${f.metric_key}|${f.facility_id ?? ""}|${f.boundary_kind ?? ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((f) => ({ id: f.id, metricKey: f.metric_key, facilityId: f.facility_id, boundaryKind: f.boundary_kind, value: f.value_num === null ? null : Number(f.value_num) }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const input = { packs, observations, facts };
    const iDigest = sha(input);
    const out = computeIndustry(input);
    const existing = await tx
      .selectFrom("core.calculation_runs")
      .select("id")
      .where("project_id", "=", cycle.project_id)
      .where("kind", "=", "industry")
      .where("input_digest", "=", iDigest)
      .where("engine_version", "=", INDUSTRY_VERSION)
      .where("mode", "=", "final")
      .where(sql<boolean>`boundary_id is null`)
      .executeTakeFirst();
    if (existing) return { runId: existing.id, reused: true, facts: out.facts.length, ...(await issueCounts(tx, existing.id)) };
    const run = await tx
      .insertInto("core.calculation_runs")
      .values({ owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, cycle_id: cycleId, boundary_id: null, kind: "industry", mode: "final", engine_version: INDUSTRY_VERSION, rule_version: INDUSTRY_VERSION, factor_digest: NO_FACTORS, input_digest: iDigest, output_digest: sha(out.facts), inputs: JSON.stringify(input), factors: JSON.stringify({ factors: {}, warnings: [] }), result: JSON.stringify(out), performed_by: actor.userId })
      .returning("id")
      .executeTakeFirstOrThrow();
    if (out.used.observations.length) await tx.insertInto("core.run_inputs").values(out.used.observations.map((id) => ({ run_id: run.id, owner_tenant_id: cycle.owner_tenant_id, project_id: cycle.project_id, observation_version_id: id, role: "observation" }))).execute();
    const ref: RunRef = { id: run.id, owner: cycle.owner_tenant_id, project: cycle.project_id, cycle: cycleId, boundaryKind: null };
    await supersedeOpenIssues(tx, cycleId, "industry");
    const counts = await recordIssues(tx, actor, ref, out.warnings);
    await writeFacts(tx, ref, out.facts, counts.blockers > 0);
    await audit(tx, actor, { action: "industry.run", objectType: "calculation_run", objectId: run.id, ownerTenantId: cycle.owner_tenant_id, projectId: cycle.project_id, after: { packs: packs.map((p) => p.id), facts: out.facts.length, ...counts } });
    return { runId: run.id, reused: false, facts: out.facts.length, ...counts };
  });
}
