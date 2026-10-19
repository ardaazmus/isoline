/**
 * Data for the G8-04 site diagram: facility collection status, from records. (The G8-05 GHG flow is drawn from the
 * calculations page's own fact list: lib/visual/layout ghgFlowInput.)
 */
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
