import { projectCycles } from "@/platform/cached";
import Link from "next/link";
import { loadProject, pickCycle, ProjectHeader, projectCan, sheetView } from "@/platform/project-shell";
import { RunTaxonomy, SheetStatus, TaxonomyEditor } from "@/platform/g9/sheets";
import { Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { getWorksheet } from "@/server/worksheets/service";
import { TaxonomySheet } from "@/server/worksheets/schemas";

export const generateMetadata = titled("pf.tax.title");

/**
 * Step 3 → taxonomy KPIs (UX Faz 3; EU Del. Reg. 2026/73 with the 10 % threshold): activities and denominators
 * are entered and approved by a second person; the taxonomy run turns the approved sheet into metric facts that
 * are approved like every other calculated metric.
 */
export default async function TaxonomyPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/taxonomy">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId, sp.cycle);
  if (!loaded.ok) return loaded.view;
  const { ws } = loaded.p;
  const cycles = await projectCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  if (!cycle)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.cycle.none")} />
      </>
    );
  const sheet = await getWorksheet(ws.actor, cycle.id, "taxonomy");
  const initial = sheet.current ? TaxonomySheet.safeParse(sheet.current.payload) : null;
  const frozen = ["frozen", "released"].includes(cycle.status);
  const canEdit = projectCan(loaded.p, "data.submit") && !frozen;
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle.id} />
      <div className="flex flex-col gap-6">
        <Section title={t("pf.tax.heading", { label: cycle.label })}>
          <p className="max-w-[90ch] text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.tax.lead")}</p>
          <SheetStatus current={sheetView(sheet.current)} approved={sheetView(sheet.approved)} me={ws.session.identity.userId} canEdit={canEdit} canApprove={projectCan(loaded.p, "data.review") && !frozen} />
          <TaxonomyEditor key={sheet.current?.id ?? "new"} cycleId={cycle.id} initial={initial?.success ? initial.data : null} canEdit={canEdit} />
        </Section>
        {sheet.approved && projectCan(loaded.p, "calc.run") && !frozen && (
          <Section title={t("pf.tax.runTitle")}>
            <p className="text-[13px] text-[var(--ink-2)]">{t("pf.tax.runLead", { v: sheet.approved.version })}</p>
            <RunTaxonomy cycleId={cycle.id} />
            <Link href={`/${lang}/app/projects/${projectId}/calculations?cycle=${cycle.id}`} className="text-[13px] font-medium text-[var(--b-700)]">
              {t("pf.tax.toCalculations")}
            </Link>
          </Section>
        )}
      </div>
    </>
  );
}
