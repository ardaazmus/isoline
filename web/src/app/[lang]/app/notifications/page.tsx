import Link from "next/link";
import { MarkAllRead } from "@/platform/g3/notifications";
import { PageTitle, Section, StateBox } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { requireSession } from "@/server/http/dal";
import { myNotifications } from "@/server/data/service";

export const generateMetadata = titled("pf.notify.title");

/** In-app notifications (G3-08): assignments, submissions, returns, due dates. Facts only, no badges or streaks. */
export default async function NotificationsPage({ params }: PageProps<"/[lang]/app/notifications">) {
  const { lang } = await params;
  const t = tr(lang);
  const s = await requireSession(lang, `/${lang}/app/notifications`);
  const rows = await myNotifications({ userId: s.identity.userId, actingTenantId: null }, 100);
  const unread = rows.filter((n) => !n.read_at).map((n) => n.id);
  return (
    <>
      <PageTitle title={t("pf.notify.title")} actions={unread.length ? <MarkAllRead ids={unread} /> : undefined} />
      <Section title={t("pf.notify.list")}>
        {rows.length === 0 ? (
          <StateBox state="empty" title={t("pf.notify.none")} />
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--rule)]">
            {rows.map((n) => {
              const p = n.payload as { requestId?: string; metric?: string; due?: string; count?: number; reason?: string };
              return (
                <li key={n.id} className={`flex flex-wrap items-center gap-3 py-2.5 text-[13.5px] ${n.read_at ? "text-[var(--ink-2)]" : "font-medium"}`}>
                  <span className="flex-1">
                    {t(`pf.notify.kind.${n.kind}`, { metric: p.metric ? t(`req.items.${p.metric}`) : "", count: p.count ?? 0, due: p.due ?? "" })}
                    {p.reason && <span className="block text-[12.5px] font-normal text-[var(--ink-3)]">{p.reason}</span>}
                  </span>
                  <span className="text-[12px] text-[var(--ink-3)]">{dateTime(lang, n.created_at)}</span>
                  {p.requestId && (
                    <Link href={`/${lang}/app/tasks/${p.requestId}`} className="text-[12.5px] text-[var(--b-700)]">
                      {t("pf.notify.open")}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}
