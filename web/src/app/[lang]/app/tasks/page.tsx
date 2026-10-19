import Link from "next/link";
import { PageTitle, Section, StateBox } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { inboxItems, type InboxKind } from "@/platform/inbox-items";
import { InboxRows } from "@/platform/inbox-list";
import { requireWorkspace } from "@/server/http/dal";
import { myInbox } from "@/server/inbox/service";
import { myNotifications } from "@/server/data/service";

export const generateMetadata = titled("pf.inbox.title");

const GROUPS: { kind: InboxKind; title: string }[] = [
  { kind: "enter", title: "pf.inbox.enter" },
  { kind: "review", title: "pf.inbox.reviewData" },
  { kind: "run", title: "pf.inbox.runs" },
  { kind: "warning", title: "pf.inbox.warnings" },
  { kind: "input", title: "pf.inbox.inputs" },
  { kind: "sheet", title: "pf.inbox.sheets" },
  { kind: "section", title: "pf.inbox.sections" },
  { kind: "decision", title: "pf.inbox.decisions" },
  { kind: "question", title: "pf.inbox.questions" },
];

/**
 * "İşlerim" (UX review 19.10.2026): the single inbox that replaced "Görevlerim", the review queue and the
 * notification list as separate menus. Grouped by the kind of decision, oldest due first; recent notifications
 * underneath for context.
 */
export default async function MyWorkPage({ params }: PageProps<"/[lang]/app/tasks">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const [box, notes] = await Promise.all([myInbox(ws.actor), myNotifications({ userId: ws.session.identity.userId, actingTenantId: null }, 8)]);
  const items = inboxItems(lang, box);
  const runMetrics = box.runs.reduce((s, r) => s + r.count, 0);
  return (
    <>
      <PageTitle title={t("pf.inbox.title")} lead={t("pf.inbox.lead")} />
      <div className="flex flex-col gap-6">
        {items.length === 0 && <StateBox state="empty" title={t("pf.inbox.empty")} />}
        {GROUPS.map((g) => {
          const rows = items.filter((x) => x.kind === g.kind);
          if (!rows.length) return null;
          return (
            <Section key={g.kind} title={t(g.title, { n: g.kind === "run" ? runMetrics : g.kind === "section" ? box.sections.reduce((s, x) => s + x.count, 0) : rows.length })}>
              <InboxRows lang={lang} items={rows} showKind={false} />
            </Section>
          );
        })}
        {notes.length > 0 && (
          <Section title={t("pf.inbox.recent")} aside={<Link href={`/${lang}/app/notifications`} className="text-[13px] font-medium text-[var(--b-700)]">{t("pf.inbox.allNotifications")}</Link>}>
            <ul className="flex flex-col divide-y divide-[var(--rule)]">
              {notes.map((n) => {
                const pl = n.payload as { requestId?: string; metric?: string; due?: string; count?: number };
                return (
                  <li key={n.id} className={`flex flex-wrap items-center gap-3 py-2 text-[13.5px] ${n.read_at ? "text-[var(--ink-2)]" : "font-medium"}`}>
                    <span className="flex-1">{t(`pf.notify.kind.${n.kind}`, { metric: pl.metric ? t(`req.items.${pl.metric}`) : "", count: pl.count ?? 0, due: pl.due ?? "" })}</span>
                    <span className="text-[12px] text-[var(--ink-3)]">{dateTime(lang, n.created_at)}</span>
                    {pl.requestId && (
                      <Link href={`/${lang}/app/tasks/${pl.requestId}`} className="text-[12.5px] text-[var(--b-700)]">
                        {t("pf.inbox.open")}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
