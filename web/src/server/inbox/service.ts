/**
 * "İşlerim": one inbox for everything that waits for this person (UX review 19.10.2026; Workiva, Watershed, Envizi
 * pattern). It joins what used to be three menus — my data tasks, the reviewer queue and report/assurance
 * decisions — and never lists the person's own work for their own approval (four-eyes rules stay with the
 * services that act). Every row is filtered by the person's permission on its project, checked once per project.
 */
import { withActor, type Actor, type Tx } from "../db/client";
import type { Action } from "../policy/policy";
import { requireProjectAction } from "../tenancy/service";
import { reviewQueue } from "../close/service";
import { myTasks } from "../data/service";

type Access = Awaited<ReturnType<typeof requireProjectAction>>;

function accessCache(tx: Tx, actor: Actor) {
  const seen = new Map<string, Access | null>();
  return async (projectId: string, action: Action): Promise<Access | null> => {
    const k = `${projectId}:${action}`;
    if (!seen.has(k))
      seen.set(
        k,
        await requireProjectAction(tx, actor, projectId, action).then(
          (a) => a,
          () => null,
        ),
      );
    return seen.get(k)!;
  };
}

export type InboxRun = { runId: string; projectId: string; projectName: string; kind: string; performedBy: string | null; count: number; facilityLevel: number };

export async function myInbox(actor: Actor) {
  const [tasks, queue] = await Promise.all([myTasks(actor), reviewQueue(actor)]);
  const extra = await withActor(actor, async (tx) => {
    const can = accessCache(tx, actor);

    // intercompany eliminations wait for a second person like the entity figures do
    const elim = await tx
      .selectFrom("core.intercompany_eliminations as x")
      .innerJoin("core.projects as p", "p.id", "x.project_id")
      .innerJoin("core.legal_entities as s", "s.id", "x.seller_entity_id")
      .innerJoin("core.legal_entities as b", "b.id", "x.buyer_entity_id")
      .select(["x.id", "x.cycle_id", "x.amount", "s.name as seller", "b.name as buyer", "p.id as project_id", "p.name as project_name"])
      .where("x.status", "=", "submitted")
      .where("x.entered_by", "!=", actor.userId)
      .execute();
    const eliminations = [];
    for (const e of elim) if (await can(e.project_id, "data.review")) eliminations.push(e);

    // report sections submitted by someone else
    const secRows = await tx
      .selectFrom("core.report_sections as s")
      .innerJoin("core.report_section_versions as v", "v.id", "s.current_version_id")
      .innerJoin("core.reports as r", "r.id", "s.report_id")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .select(["s.id", "r.id as report_id", "r.title as report_title", "p.id as project_id", "p.name as project_name"])
      .where("s.status", "=", "submitted")
      .where("v.author_id", "!=", actor.userId)
      .execute();
    const sectionsByReport = new Map<string, { reportId: string; reportTitle: string; projectId: string; projectName: string; count: number }>();
    for (const s of secRows) {
      if (!(await can(s.project_id, "report.review"))) continue;
      const g = sectionsByReport.get(s.report_id) ?? { reportId: s.report_id, reportTitle: s.report_title, projectId: s.project_id, projectName: s.project_name, count: 0 };
      g.count += 1;
      sectionsByReport.set(s.report_id, g);
    }

    // approval chain: technical review, customer review, management sign-off, then the release itself
    const chain = await tx
      .selectFrom("core.reports as r")
      .innerJoin("core.projects as p", "p.id", "r.project_id")
      .select(["r.id", "r.title", "r.status", "p.id as project_id", "p.name as project_name"])
      .where("r.status", "in", ["tech_review", "customer_review", "management_signoff"])
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
    const decisions: { reportId: string; title: string; projectId: string; projectName: string; action: "tech_review" | "customer_review" | "signoff" | "release" }[] = [];
    for (const r of chain) {
      const action = r.status === "tech_review" ? "tech_review" : r.status === "customer_review" ? "customer_review" : signed.some((s) => s.report_id === r.id) ? "release" : "signoff";
      const a = await can(r.project_id, action === "tech_review" || action === "customer_review" ? "report.review" : "report.release");
      if (!a) continue;
      if (action !== "tech_review" && a.via !== "member") continue; // a grant never decides for the customer
      decisions.push({ reportId: r.id, title: r.title, projectId: r.project_id, projectName: r.project_name, action });
    }

    // assurance: open questions for the company to answer; answered ones for the person who asked
    const qRows = await tx
      .selectFrom("core.assurance_questions as q")
      .innerJoin("core.projects as p", "p.id", "q.project_id")
      .select(["q.id", "q.cycle_id", "q.question", "q.status", "q.asked_by", "q.asked_at", "p.id as project_id", "p.name as project_name"])
      .where("q.status", "in", ["open", "answered"])
      .orderBy("q.asked_at")
      .execute();
    const toAnswer = [];
    const toClose = [];
    for (const q of qRows) {
      if (q.status === "open") {
        const a = await can(q.project_id, "data.submit");
        if (a && a.via === "member") toAnswer.push(q);
      } else if (q.asked_by === actor.userId && (await can(q.project_id, "assurance.query"))) toClose.push(q);
    }
    return { eliminations, sections: [...sectionsByReport.values()], decisions, toAnswer, toClose };
  });

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

  const total = enter.length + reviewData.length + queue.facts.length + queue.issues.length + queue.inputs.length + extra.eliminations.length + extra.sections.reduce((s, x) => s + x.count, 0) + extra.decisions.length + extra.toAnswer.length + extra.toClose.length;
  return { enter, reviewData, runs: [...runs.values()], facts: queue.facts, warnings: queue.issues, inputs: queue.inputs, ...extra, total };
}

export type Inbox = Awaited<ReturnType<typeof myInbox>>;

/** How many things wait for this person (the menu badge). */
export async function inboxCount(actor: Actor): Promise<number> {
  return (await myInbox(actor)).total;
}
