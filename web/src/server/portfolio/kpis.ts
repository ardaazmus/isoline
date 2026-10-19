/**
 * Consultancy operational KPIs (G7-01, G7-08): per project's current cycle — collection progress, overdue
 * requests, evidence rate, open blockers, items waiting for review, reports and the publication date. Operational
 * facts only: there is deliberately no ESG "score" or grade of the client (plan 01: no fake ratings).
 */
import { sql } from "kysely";
import { withActor, type Actor } from "../db/client";
import { reachableProjectIds } from "../tenancy/service";

export type ProjectKpi = {
  projectId: string;
  cycleId: string | null;
  publishDue: string | null;
  requests: { total: number; accepted: number; closed: number; open: number; overdue: number };
  acceptance: number | null;
  evidenceRate: number | null;
  blockers: number;
  inReview: number;
  reports: { total: number; released: number };
};

export async function portfolioKpis(actor: Actor): Promise<ProjectKpi[]> {
  return withActor(actor, async (tx) => {
    // the newest cycle of every project the workspace can reach (RLS still decides row by row)
    const reachable = await reachableProjectIds(tx, actor);
    if (!reachable.length) return [];
    const cycles = await tx
      .selectFrom("core.reporting_cycles as c")
      .distinctOn("c.project_id")
      .select(["c.id", "c.project_id", "c.publish_due"])
      .where("c.project_id", "in", reachable)
      .orderBy("c.project_id")
      .orderBy("c.period_end", "desc")
      .execute();
    if (!cycles.length) return [];
    const ids = cycles.map((c) => c.id);
    const today = new Date().toISOString().slice(0, 10);
    const req = await tx
      .selectFrom("core.data_requests as r")
      .select([
        "r.cycle_id",
        sql<number>`count(*)::int`.as("total"),
        sql<number>`count(*) filter (where r.status = 'accepted')::int`.as("accepted"),
        sql<number>`count(*) filter (where r.status in ('not_applicable','withdrawn'))::int`.as("closed"),
        sql<number>`count(*) filter (where r.status not in ('accepted','not_applicable','withdrawn'))::int`.as("open"),
        sql<number>`count(*) filter (where r.status not in ('accepted','not_applicable','withdrawn') and r.due_on < ${today}::date)::int`.as("overdue"),
        sql<number>`count(*) filter (where r.status = 'accepted' and exists (select 1 from core.evidence_links l where l.target_type = 'data_request' and l.target_id = r.id and l.unlinked_at is null))::int`.as("with_evidence"),
        sql<number>`count(*) filter (where r.status in ('submitted','reviewing'))::int`.as("in_review"),
      ])
      .where("r.cycle_id", "in", ids)
      .groupBy("r.cycle_id")
      .execute();
    const issues = await tx.selectFrom("core.quality_issues").select(["cycle_id", sql<number>`count(*)::int`.as("n")]).where("cycle_id", "in", ids).where("status", "=", "open").where("severity", "=", "blocker").groupBy("cycle_id").execute();
    const facts = await tx.selectFrom("core.metric_fact_versions").select(["cycle_id", sql<number>`count(*)::int`.as("n")]).where("cycle_id", "in", ids).where("status", "=", "ready_for_review").where("facility_id", "is", null).groupBy("cycle_id").execute();
    const reports = await tx
      .selectFrom("core.reports")
      .select(["cycle_id", sql<number>`count(*)::int`.as("total"), sql<number>`count(*) filter (where status = 'released')::int`.as("released"), sql<number>`count(*) filter (where status in ('tech_review','customer_review','management_signoff'))::int`.as("in_review")])
      .where("cycle_id", "in", ids)
      .groupBy("cycle_id")
      .execute();
    return cycles.map((c) => {
      const r = req.find((x) => x.cycle_id === c.id);
      const rep = reports.find((x) => x.cycle_id === c.id);
      const decided = (r?.accepted ?? 0) + (r?.closed ?? 0);
      return {
        projectId: c.project_id,
        cycleId: c.id,
        publishDue: c.publish_due,
        requests: { total: r?.total ?? 0, accepted: r?.accepted ?? 0, closed: r?.closed ?? 0, open: r?.open ?? 0, overdue: r?.overdue ?? 0 },
        acceptance: r && r.total ? decided / r.total : null,
        evidenceRate: r && r.accepted ? r.with_evidence / r.accepted : null,
        blockers: issues.find((x) => x.cycle_id === c.id)?.n ?? 0,
        inReview: (r?.in_review ?? 0) + (facts.find((x) => x.cycle_id === c.id)?.n ?? 0) + (rep?.in_review ?? 0),
        reports: { total: rep?.total ?? 0, released: rep?.released ?? 0 },
      };
    });
  });
}
