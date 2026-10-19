/** Data for the G8-04/05 diagrams: facility collection status and the GHG flows of a cycle — both from records. */
import { sql } from "kysely";
import { withActor, type Actor } from "../db/client";
import { notFound } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";

/** Per facility of the project's organisation: requests done / all in the cycle and requests returned for correction. */
export async function siteStatus(actor: Actor, projectId: string, cycleId: string) {
  return withActor(actor, async (tx) => {
    await requireProjectAction(tx, actor, projectId, "project.read");
    const p = await tx.selectFrom("core.projects").select(["organization_id"]).where("id", "=", projectId).executeTakeFirst();
    if (!p) throw notFound();
    if (!p.organization_id) return [];
    const facilities = await tx.selectFrom("core.facilities as f").innerJoin("core.legal_entities as e", "e.id", "f.legal_entity_id").select(["f.id", "f.name", "e.name as entity"]).where("e.organization_id", "=", p.organization_id).orderBy("e.name").orderBy("f.name").execute();
    const counts = await tx
      .selectFrom("core.data_requests")
      .select([
        "facility_id",
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where status in ('accepted','not_applicable','withdrawn'))::int`.as("done"),
        sql<number>`count(*) filter (where status = 'revision_required')::int`.as("returned"),
      ])
      .where("cycle_id", "=", cycleId)
      .where("facility_id", "is not", null)
      .groupBy("facility_id")
      .execute();
    return facilities.map((f) => {
      const c = counts.find((x) => x.facility_id === f.id);
      return { id: f.id, name: f.name, entity: f.entity, accepted: c?.done ?? 0, total: c?.total ?? 0, blockers: c?.returned ?? 0 };
    });
  });
}

/** Facility scope 1 and 2 (location) under operational control, organisation-level scope 1 and scope 3. */
export async function ghgFlowData(actor: Actor, cycleId: string) {
  return withActor(actor, async (tx) => {
    const c = await tx.selectFrom("core.reporting_cycles").select(["project_id"]).where("id", "=", cycleId).executeTakeFirst();
    if (!c) throw notFound("cycle_not_found");
    await requireProjectAction(tx, actor, c.project_id, "project.read");
    const rows = await tx
      .selectFrom("core.metric_fact_versions as f")
      .leftJoin("core.facilities as fa", "fa.id", "f.facility_id")
      .select(["f.metric_key", "f.facility_id", "fa.name", "f.value_num", "f.revision", "f.status", "f.boundary_kind"])
      .where("f.cycle_id", "=", cycleId)
      .where("f.metric_key", "in", ["ghg.scope1", "ghg.scope2.location", "ghg.scope1.mobile", "ghg.scope3"])
      .where("f.boundary_kind", "=", "ghg_operational_control")
      .where("f.status", "not in", ["superseded", "rejected"])
      .orderBy("f.revision", "desc")
      .execute();
    const seen = new Set<string>();
    const cur = rows.filter((r) => {
      const k = `${r.metric_key}|${r.facility_id ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const v = (k: string, f: string | null) => Number(cur.find((r) => r.metric_key === k && r.facility_id === f)?.value_num ?? 0);
    const facilities = [...new Map(cur.filter((r) => r.facility_id).map((r) => [r.facility_id!, r.name ?? r.facility_id!])).entries()].map(([id, name]) => ({ name, scope1: v("ghg.scope1", id), scope2: v("ghg.scope2.location", id) }));
    return { facilities, orgScope1: v("ghg.scope1.mobile", null), scope3: v("ghg.scope3", null) };
  });
}
