/**
 * "İşlerim": one inbox for everything that waits for this person (UX review 19.10.2026; Workiva, Watershed, Envizi
 * pattern). It joins what used to be three menus — my data tasks, the reviewer queue and report/assurance
 * decisions — and never lists the person's own work for their own approval (four-eyes rules stay with the
 * services that act). Every row is filtered by the person's permission on its project — one batched check for all
 * projects (projectsAllowing), and only over the projects this workspace can reach (G8-07 load test).
 */
import { withActor, type Actor } from "../db/client";
import { projectsAllowing, reachableProjectIds } from "../tenancy/service";
import { reviewQueue } from "../close/service";
import { myTasks } from "../data/service";
import { worksheetsToApprove } from "../worksheets/service";
import { ANALYSIS_KINDS, type WorksheetKind } from "../worksheets/schemas";

export type InboxRun = { runId: string; projectId: string; projectName: string; kind: string; performedBy: string | null; count: number; facilityLevel: number };

export async function myInbox(actor: Actor) {
  // four independent reads, side by side (G8-07 load test: under load every round trip waits its turn)
  const [tasks, queue, allSheets, extra] = await Promise.all([myTasks(actor), reviewQueue(actor), worksheetsToApprove(actor), otherDecisions(actor)]);
  // scenario sheets of the analysis area need no approval, so they never wait in anyone's inbox
  const sheets = allSheets.filter((s) => !ANALYSIS_KINDS.includes(s.kind as WorksheetKind));

  const enter = tasks.filter((x) => x.assignee_user_id === actor.userId && ["assigned", "sent", "revision_required"].includes(x.status));
  const reviewData = tasks.filter((x) => x.reviewer_user_id === actor.userId && x.assignee_user_id !== actor.userId && ["submitted", "reviewing"].includes(x.status));

  // calculated metrics wait per calculation run: one decision opens the run, where every metric is listed
  const runs = new Map<string, InboxRun>();
  for (const f of queue.facts) {
    const r = runs.get(f.run_id) ?? { runId: f.run_id, projectId: f.project_id, projectName: f.project_name, kind: f.kind, performedBy: f.performed_by_name, count: 0, facilityLevel: 0 };
    r.count += 1;
    if (f.facility_name) r.facilityLevel += 1;
    runs.set(f.run_id, r);
  }

  const total = enter.length + reviewData.length + queue.facts.length + queue.issues.length + queue.inputs.length + extra.eliminations.length + extra.sections.reduce((s, x) => s + x.count, 0) + extra.decisions.length + extra.toAnswer.length + extra.toClose.length + sheets.length;
  return { enter, reviewData, runs: [...runs.values()], facts: queue.facts, warnings: queue.issues, inputs: queue.inputs, sheets, ...extra, total };
}

/** Eliminations, report sections, approval-chain decisions and assurance questions waiting for this person. */
async function otherDecisions(actor: Actor) {
  return withActor(actor, async (tx) => {
    const reachable = await reachableProjectIds(tx, actor);
    const empty = { eliminations: [], sections: [], decisions: [], toAnswer: [], toClose: [] };
    if (!reachable.length) return empty;

    // intercompany eliminations wait for a second person like the entity figures do
    const elim = await tx
      .selectFrom("core.intercompany_eliminations as x")
      .innerJoin("core.projects as p", "p.id", "x.project_id")
      .innerJoin("core.legal_entities as s", "s.id", "x.seller_entity_id")
      .innerJoin("core.legal_entities as b", "b.id", "x.buyer_entity_id")
      .select(["x.id", "x.cycle_id", "x.amount", "s.name as seller", "b.name as buyer", "p.id as project_id", "p.name as project_name"])
      .where("x.status", "=", "submitted")
      .where("x.entered_by", "!=", actor.userId)
      .where("x.project_id", "in", reachable)
      .execute();

    // report sections submitted by someone else
    const secRows = await tx
      .selectFrom("core.report_sections as s")
      .innerJoin("core.report_section_versions as v", "v.id", "s.current_version_id")
      .innerJoin("core.reports as r", "r.id", "s.report_id")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .select(["s.id", "r.id as report_id", "r.title as report_title", "p.id as project_id", "p.name as project_name"])
      .where("s.status", "=", "submitted")
      .where("v.author_id", "!=", actor.userId)
      .where("r.project_id", "in", reachable)
      .execute();

    // approval chain: technical review, customer review, management sign-off, then the release itself
    const chain = await tx
      .selectFrom("core.reports as r")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .select(["r.id", "r.title", "r.status", "p.id as project_id", "p.name as project_name", "p.owner_tenant_id"])
      .where("r.status", "in", ["tech_review", "customer_review", "management_signoff"])
      .where("r.project_id", "in", reachable)
      .execute();
    const signed = chain.length
      ? await tx
          .selectFrom("core.report_approvals")
          .select(["report_id"])
          .where("report_id", "in", chain.map((c) => c.id))
          .where("stage", "=", "management_signoff")
          .where("decision", "=", "approved")
          .execute()
      : [];

    // assurance: open questions for the company to answer; answered ones for the person who asked
    const qRows = await tx
      .selectFrom("core.assurance_questions as q")
      .innerJoin("core.projects as p", "p.id", "q.project_id")
      .select(["q.id", "q.cycle_id", "q.question", "q.status", "q.asked_by", "q.asked_at", "p.id as project_id", "p.name as project_name", "p.owner_tenant_id"])
      .where("q.status", "in", ["open", "answered"])
      .where("q.project_id", "in", reachable)
      .orderBy("q.asked_at")
      .execute();
    // every permission the rows below need, for all their projects at once
    const ids = [...elim, ...secRows, ...chain, ...qRows].map((r) => r.project_id);
    const allowed = await projectsAllowing(tx, actor, ids, ["data.review", "report.review", "report.release", "data.submit", "assurance.query"]);
    const member = (owner: string) => owner === actor.actingTenantId;
    const eliminations = elim.filter((e) => allowed["data.review"].has(e.project_id));
    const sectionsByReport = new Map<string, { reportId: string; reportTitle: string; projectId: string; projectName: string; count: number }>();
    for (const s of secRows) {
      if (!allowed["report.review"].has(s.project_id)) continue;
      const g = sectionsByReport.get(s.report_id) ?? { reportId: s.report_id, reportTitle: s.report_title, projectId: s.project_id, projectName: s.project_name, count: 0 };
      g.count += 1;
      sectionsByReport.set(s.report_id, g);
    }
    const decisions: { reportId: string; title: string; projectId: string; projectName: string; action: "tech_review" | "customer_review" | "signoff" | "release" }[] = [];
    for (const r of chain) {
      const action = r.status === "tech_review" ? "tech_review" : r.status === "customer_review" ? "customer_review" : signed.some((s) => s.report_id === r.id) ? "release" : "signoff";
      if (!allowed[action === "tech_review" || action === "customer_review" ? "report.review" : "report.release"].has(r.project_id)) continue;
      if (action !== "tech_review" && !member(r.owner_tenant_id)) continue; // a grant never decides for the customer
      decisions.push({ reportId: r.id, title: r.title, projectId: r.project_id, projectName: r.project_name, action });
    }
    const toAnswer = [];
    const toClose = [];
    for (const q of qRows) {
      if (q.status === "open") {
        if (allowed["data.submit"].has(q.project_id) && member(q.owner_tenant_id)) toAnswer.push(q);
      } else if (q.asked_by === actor.userId && allowed["assurance.query"].has(q.project_id)) toClose.push(q);
    }
    return { eliminations, sections: [...sectionsByReport.values()], decisions, toAnswer, toClose };
  });
}

export type Inbox = Awaited<ReturnType<typeof myInbox>>;

/** How many things wait for this person (the menu badge). */
export async function inboxCount(actor: Actor): Promise<number> {
  return (await myInbox(actor)).total;
}
