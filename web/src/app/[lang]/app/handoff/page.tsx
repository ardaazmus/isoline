import Link from "next/link";
import { PageTitle, Section, StateBox, Badge } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { requireWorkspace } from "@/server/http/dal";
import { handoffReleases } from "@/server/reports/service";

export const generateMetadata = titled("pf.handoff.title");

/** Design partner's inbox: releases shared through a design grant — the package and proofs, never raw data. */
export default async function HandoffPage({ params }: PageProps<"/[lang]/app/handoff">) {
  const { lang } = await params;
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  const releases = await handoffReleases(ws.actor);
  return (
    <>
      <PageTitle title={t("pf.handoff.title")} lead={t("pf.handoff.lead")} />
      <Section title={t("pf.handoff.list", { n: releases.length })}>
        {releases.length === 0 ? (
          <StateBox state="empty" title={t("pf.handoff.none")} />
        ) : (
          <ul className="flex flex-col gap-2 text-[13.5px]">
            {releases.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/${lang}/app/releases/${r.id}`} className="font-medium text-[var(--b-700)]">
                  {r.title}
                </Link>
                <span className="text-[12.5px] text-[var(--ink-2)]">
                  {r.period} · {t("pf.rep.versionN", { v: r.version })} · {dateTime(lang, r.released_at)}
                </span>
                <Badge tone={r.status === "released" ? "ok" : "neutral"}>{t(`pf.rep.releaseStatus.${r.status}`)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
