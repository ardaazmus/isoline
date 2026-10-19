import Link from "next/link";
import { Comments, ReviewPanel, StatusBadge, TaskForm, Versions, type TaskView } from "@/platform/g3/task";
import { Badge, PageTitle, Section, StateBox } from "@/platform/ui";
import { attempt, dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { memberCan } from "@/server/policy/policy";
import { ReopenRequestForm } from "@/platform/g5/close";
import { listEvidence } from "@/server/evidence/service";
import { getTask } from "@/server/data/service";
import { unitsFor, type Dimension } from "@/server/data/units";

export const generateMetadata = titled("pf.task.title");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** DATA-05 + DATA-09: one data request — the four-step form for the assignee, review for the reviewer, history. */
export default async function TaskPage({ params }: PageProps<"/[lang]/app/tasks/[requestId]">) {
  const { lang, requestId } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const r = UUID.test(requestId) ? await attempt(() => getTask(ws.actor, requestId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok) return <StateBox state="empty" title={t("pf.task.notFound")}>{t("pf.task.notFoundLead")}</StateBox>;
  const task = r.data as unknown as TaskView;
  const units = Object.fromEntries(task.metric.dimensions.map((d) => [d, unitsFor(d as Dimension)]));
  const projectEvidence = task.can.edit ? (await listEvidence(ws.actor, task.request.project_id)).filter((e) => e.scan_status !== "quarantined" && e.scan_status !== "rejected") : [];
  return (
    <>
      <PageTitle
        title={t(`req.items.${task.metric.code}`)}
        lead={
          <>
            <Link href={`/${lang}/app/projects/${task.request.project_id}/data`} className="text-[var(--b-700)]">
              {task.request.project_name}
            </Link>{" "}
            · {task.request.cycle_label} · {task.request.facility_name ?? t("pf.data.organisationLevel")} · <StatusBadge status={task.request.status} />
            {task.request.due_on && <span className="ml-2 text-[13px] text-[var(--ink-3)]">{t("pf.task.dueOn", { date: dateOnly(lang, task.request.due_on) })}</span>}
            {task.request.returns > 0 && (
              <span className="ml-2">
                <Badge tone="warn">{t("pf.data.returnsN", { n: task.request.returns })}</Badge>
              </span>
            )}
          </>
        }
      />
      <div className="flex flex-col gap-6">
        <TaskForm task={task} units={units} projectEvidence={projectEvidence} />
        <ReviewPanel task={task} />
        {task.request.status === "accepted" && ws.actor.role !== null && memberCan(ws.actor.role, "data.request") && (
          <Section title={t("pf.close.correctionTitle")}>
            <p className="text-[13px] text-[var(--ink-2)]">{t("pf.close.correctionLead")}</p>
            <ReopenRequestForm requestId={task.request.id} />
          </Section>
        )}
        {!task.can.edit && !task.can.review && <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.state.read_only")}</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={t("pf.task.history")}>
            <Versions task={task} />
          </Section>
          <Section title={t("pf.task.thread")}>
            <Comments task={task} />
          </Section>
        </div>
        <Section title={t("pf.task.why")}>
          <ul className="flex flex-col gap-1 text-[13px] text-[var(--ink-2)]">
            {(task.request.traces as { template: string; section: string; refs: string[] }[]).map((x, i) => (
              <li key={i}>
                {t(`tpl.${x.template}.title`)} — {x.refs.join(", ")}
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}
