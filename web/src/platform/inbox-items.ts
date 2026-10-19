/**
 * The inbox (server/inbox/service.ts) as one flat list of actions — label, where, which step, when due, and the
 * link that opens the work — for the "Today" page, "My work" and the project summary.
 */
import type { Inbox } from "@/server/inbox/service";
import type { StepId } from "@/server/cycle/steps";
import { factValue } from "./g4/format";
import { dateOnly, tr } from "./server";

export type InboxKind = "enter" | "review" | "run" | "warning" | "input" | "section" | "decision" | "question";
export type InboxItem = { key: string; kind: InboxKind; step: StepId; projectId: string; project: string; label: string; detail: string; due: string | null; overdue: boolean; href: string };

export function inboxItems(lang: string, box: Inbox): InboxItem[] {
  const t = tr(lang);
  const today = new Date().toISOString().slice(0, 10);
  const p = (projectId: string) => `/${lang}/app/projects/${projectId}`;
  const items: InboxItem[] = [];
  for (const x of box.enter)
    items.push({ key: `e${x.id}`, kind: "enter", step: "collect", projectId: x.project_id, project: x.project_name, label: t(`req.items.${x.metric_code}`), detail: [x.facility_name ?? t("pf.data.organisationLevel"), x.period_label].filter(Boolean).join(" · "), due: x.due_on, overdue: Boolean(x.due_on && x.due_on < today), href: `/${lang}/app/tasks/${x.id}` });
  for (const x of box.reviewData)
    items.push({ key: `r${x.id}`, kind: "review", step: "collect", projectId: x.project_id, project: x.project_name, label: t(`req.items.${x.metric_code}`), detail: x.facility_name ?? t("pf.data.organisationLevel"), due: x.due_on, overdue: Boolean(x.due_on && x.due_on < today), href: `/${lang}/app/tasks/${x.id}` });
  for (const x of box.runs)
    items.push({
      key: `c${x.runId}`,
      kind: "run",
      step: "calculate",
      projectId: x.projectId,
      project: x.projectName,
      label: t("pf.inbox.runRow", { kind: t(`pf.calc.kinds.${x.kind}`), count: x.count }),
      detail: [x.performedBy ? t("pf.inbox.runBy", { name: x.performedBy }) : null, x.facilityLevel ? t("pf.inbox.runFacility", { n: x.facilityLevel }) : null].filter(Boolean).join(" · "),
      due: null,
      overdue: false,
      href: `${p(x.projectId)}/calculations/${x.runId}`,
    });
  for (const x of box.warnings) items.push({ key: `w${x.id}`, kind: "warning", step: "calculate", projectId: x.project_id, project: x.project_name, label: t(`pf.calc.rule.${x.rule_id}`), detail: "", due: null, overdue: false, href: `${p(x.project_id)}/controls` });
  for (const x of box.inputs) items.push({ key: `i${x.id}`, kind: "input", step: "controls", projectId: x.project_id, project: x.project_name, label: x.entity_name, detail: `${factValue(lang, x.net_sales, "")} TRY`, due: null, overdue: false, href: `${p(x.project_id)}/consolidation?cycle=${x.cycle_id}` });
  for (const x of box.eliminations) items.push({ key: `x${x.id}`, kind: "input", step: "controls", projectId: x.project_id, project: x.project_name, label: t("pf.inbox.elimination", { seller: x.seller, buyer: x.buyer }), detail: `${factValue(lang, x.amount, "")} TRY`, due: null, overdue: false, href: `${p(x.project_id)}/consolidation?cycle=${x.cycle_id}` });
  for (const x of box.sections) items.push({ key: `s${x.reportId}`, kind: "section", step: "report", projectId: x.projectId, project: x.projectName, label: x.reportTitle, detail: t("pf.inbox.sectionsRow", { n: x.count }), due: null, overdue: false, href: `${p(x.projectId)}/reports/${x.reportId}` });
  for (const x of box.decisions) items.push({ key: `d${x.reportId}`, kind: "decision", step: "report", projectId: x.projectId, project: x.projectName, label: x.title, detail: t(`pf.inbox.decision.${x.action}`), due: null, overdue: false, href: `${p(x.projectId)}/reports/${x.reportId}` });
  for (const x of [...box.toAnswer, ...box.toClose])
    items.push({ key: `q${x.id}`, kind: "question", step: "assurance", projectId: x.project_id, project: x.project_name, label: x.question.length > 90 ? `${x.question.slice(0, 88)}…` : x.question, detail: dateOnly(lang, x.asked_at), due: null, overdue: false, href: `${p(x.project_id)}/assurance?cycle=${x.cycle_id}` });
  return items;
}

/** Overdue first, then by due date, then in the cycle's step order. */
export function byUrgency(items: InboxItem[]): InboxItem[] {
  const order: StepId[] = ["scope", "collect", "calculate", "controls", "close", "report", "assurance"];
  return items.slice().sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due ?? "9999").localeCompare(b.due ?? "9999") || order.indexOf(a.step) - order.indexOf(b.step));
}
