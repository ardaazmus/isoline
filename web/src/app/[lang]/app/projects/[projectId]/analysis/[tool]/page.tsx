import { notFound } from "next/navigation";
import { loadProject, pickCycle, ProjectHeader, projectCan } from "@/platform/project-shell";
import { CbamAnalysis, EtsAnalysis, PathwayAnalysis } from "@/platform/g9/sheets";
import { Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { listCycles } from "@/server/projects/service";
import { analysisInputs } from "@/server/worksheets/service";
import { CbamCostSheet, EtsSheet, PathwaySheet } from "@/server/worksheets/schemas";
import { ANALYSIS_TOOLS, type AnalysisTool } from "@/server/cycle/steps";

export const generateMetadata = titled("pf.an.title");

/**
 * Analysis beside the cycle (UX Faz 3): the toolkit's decarbonisation pathway, TR ETS and CBAM cost tools, now run
 * on the cycle's approved figures with assumptions saved per cycle. Scenarios never change a reported figure and do
 * not gate the cycle.
 */
export default async function AnalysisPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/analysis/[tool]">) {
  const { lang, projectId, tool } = await params;
  const sp = await searchParams;
  if (!(ANALYSIS_TOOLS as readonly string[]).includes(tool)) notFound();
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws } = loaded.p;
  const cycles = await listCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  if (!cycle)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.cycle.none")} />
      </>
    );
  const a = await analysisInputs(ws.actor, cycle.id);
  const canEdit = projectCan(loaded.p, "calc.run");
  const sheet = (k: "pathway" | "ets" | "cbam_cost") => a.sheets[k]?.payload ?? null;
  const which = tool as AnalysisTool;
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle.id} />
      <Section title={t(`pf.an.tools.${which}`)}>
        <p className="max-w-[90ch] text-[13px] leading-relaxed text-[var(--ink-2)]">{t(`pf.an.lead.${which}`)}</p>
        {a.facts.length === 0 && <p className="text-[13px] text-[var(--warn)]">{t("pf.an.noApproved")}</p>}
        {which === "pathway" && (
          <PathwayAnalysis cycleId={cycle.id} canEdit={canEdit} facts={a.facts} baseFacts={a.baseFacts} year={a.cycle.reportingYear} initial={(() => { const r = PathwaySheet.safeParse(sheet("pathway")); return r.success ? r.data : null; })()} />
        )}
        {which === "ets" && (
          <EtsAnalysis cycleId={cycle.id} canEdit={canEdit} facts={a.facts} year={a.cycle.reportingYear} initial={(() => { const r = EtsSheet.safeParse(sheet("ets")); return r.success ? r.data : null; })()} />
        )}
        {which === "cbam" && (
          <CbamAnalysis cycleId={cycle.id} canEdit={canEdit} facts={a.facts} initial={(() => { const r = CbamCostSheet.safeParse(sheet("cbam_cost")); return r.success ? r.data : null; })()} />
        )}
      </Section>
    </>
  );
}
