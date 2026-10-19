import { projectCycles } from "@/platform/cached";
import Link from "next/link";
import { TEMPLATES } from "@/data/templates";
import { CreateReportForm } from "@/platform/g6/report";
import { loadProject, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox, Table, Td } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";
import { crossReportCheck, listReports } from "@/server/reports/service";

export const generateMetadata = titled("pf.rep.title");

/** REP-01 + G6-09: the project's reports per cycle, progress, releases, and metrics shared between reports. */
export default async function ReportsPage({ params }: PageProps<"/[lang]/app/projects/[projectId]/reports">) {
  const { lang, projectId } = await params;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const can = (a: Action) => ws.actor.role !== null && memberCan(ws.actor.role, a) && (data.access.via !== "grant" || grantCan(data.access.grantRole!, a));
  const [reports, cycles] = await Promise.all([listReports(ws.actor, projectId), projectCycles(ws.actor, projectId)]);
  const shared = (await Promise.all(cycles.map((c) => crossReportCheck(ws.actor, c.id)))).flat();
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.rep.list", { n: reports.length })}>
          {reports.length === 0 ? (
            <StateBox state="empty" title={t("pf.rep.none")}>
              {t("pf.rep.noneLead")}
            </StateBox>
          ) : (
            <Table head={[t("pf.rep.title"), t("pf.rep.cycle"), t("pf.rep.progress"), t("pf.calc.status"), t("pf.rep.releasesCol")]}>
              {reports.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/${lang}/app/projects/${projectId}/reports/${r.id}`} className="font-medium text-[var(--b-700)]">
                      {r.title}
                    </Link>
                    <div className="text-[11.5px] text-[var(--ink-3)]">
                      {t(`tpl.${r.template_id}.title`)} · {t(`pf.rep.lang.${r.language}`)} · {dateTime(lang, r.updated_at)}
                    </div>
                  </Td>
                  <Td className="text-[12.5px]">{r.cycle_label}</Td>
                  <Td className="tabular-nums text-[12.5px]">{t("pf.rep.approvedOf", { a: r.approved, n: r.sections })}</Td>
                  <Td>
                    <Badge tone={r.status === "released" ? "ok" : r.status === "drafting" ? "neutral" : "warn"}>{t(`pf.rep.status.${r.status}`)}</Badge>
                  </Td>
                  <Td className="tabular-nums">{r.releases > 0 ? t("pf.rep.versionN", { v: r.releases }) : "—"}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
        {shared.length > 0 && (
          <Section title={t("pf.rep.shared")}>
            <ul className="flex flex-col gap-1.5 text-[13.5px]">
              {shared.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px]">{m.key.replace(/\|$/, "")}</span>
                  <span className="text-[12.5px] text-[var(--ink-2)]">{m.reports.join(" · ")}</span>
                  <Badge tone={m.consistent ? "ok" : "crit"}>{t(m.consistent ? "pf.rep.sameFact" : "pf.rep.differentFacts")}</Badge>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {can("report.write") && cycles.length > 0 && (
          <Section title={t("pf.rep.new")}>
            <CreateReportForm projectId={projectId} base={`/${lang}/app/projects/${projectId}/reports`} cycles={cycles.map((c) => ({ id: c.id, label: c.label }))} templates={TEMPLATES.map((x) => ({ id: x.id, kind: x.kind }))} />
          </Section>
        )}
      </div>
    </>
  );
}
