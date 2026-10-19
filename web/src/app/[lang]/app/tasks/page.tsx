import Link from "next/link";
import { StatusBadge } from "@/platform/g3/campaign";
import { PageTitle, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { myTasks } from "@/server/data/service";

export const generateMetadata = titled("pf.tasks.title");

/** DATA-04: what waits for me — values to enter and submissions to review — oldest due date first. */
export default async function TasksPage({ params }: PageProps<"/[lang]/app/tasks">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const tasks = await myTasks(ws.actor);
  const today = new Date().toISOString().slice(0, 10);
  const mine = tasks.filter((x) => x.assignee_user_id === ws.session.identity.userId);
  const review = tasks.filter((x) => x.reviewer_user_id === ws.session.identity.userId && x.assignee_user_id !== ws.session.identity.userId);
  const table = (rows: typeof tasks) => (
    <Table head={[t("pf.data.metric"), t("pf.tasks.project"), t("pf.data.facility"), t("pf.data.statusCol"), t("pf.data.due")]}>
      {rows.map((x) => (
        <tr key={x.id}>
          <Td>
            <Link href={`/${lang}/app/tasks/${x.id}`} className="font-medium text-[var(--b-700)]">
              {t(`req.items.${x.metric_code}`)}
            </Link>
            <span className="block text-[11.5px] text-[var(--ink-3)]">{x.period_label}</span>
          </Td>
          <Td>{x.project_name}</Td>
          <Td>{x.facility_name ?? t("pf.data.organisationLevel")}</Td>
          <Td>
            <StatusBadge status={x.status} />
          </Td>
          <Td className={x.due_on && x.due_on < today ? "font-semibold text-[var(--crit)]" : undefined}>{x.due_on ? dateOnly(lang, x.due_on) : "—"}</Td>
        </tr>
      ))}
    </Table>
  );
  return (
    <>
      <PageTitle title={t("pf.tasks.title")} lead={t("pf.tasks.lead")} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.tasks.toEnter", { n: mine.length })}>{mine.length ? table(mine) : <StateBox state="empty" title={t("pf.tasks.noneToEnter")} />}</Section>
        <Section title={t("pf.tasks.toReview", { n: review.length })}>{review.length ? table(review) : <StateBox state="empty" title={t("pf.tasks.noneToReview")} />}</Section>
      </div>
    </>
  );
}
