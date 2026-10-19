import { projectCycles } from "@/platform/cached";
import { loadProject, pickCycle, ProjectHeader, projectCan, sheetView } from "@/platform/project-shell";
import { MaterialityEditor, SheetStatus } from "@/platform/g9/sheets";
import { Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { getWorksheet } from "@/server/worksheets/service";
import { MaterialitySheet } from "@/server/worksheets/schemas";

export const generateMetadata = titled("pf.mat.title");

/**
 * Step 1 → double materiality (UX Faz 3; the toolkit's matrix): topics scored for impact and financial
 * materiality, saved per cycle and approved by a second person of the company. The approved list is the basis of
 * the report's topics; it does not gate the cycle (TSRS climate-first needs no double materiality).
 */
export default async function MaterialityPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/materiality">) {
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
  const sheet = await getWorksheet(ws.actor, cycle.id, "materiality");
  const initial = sheet.current ? MaterialitySheet.safeParse(sheet.current.payload) : null;
  const frozen = ["frozen", "released"].includes(cycle.status);
  const canEdit = projectCan(loaded.p, "scope.decide") && !frozen;
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle.id} />
      <Section title={t("pf.mat.heading", { label: cycle.label })}>
        <p className="max-w-[90ch] text-[13px] leading-relaxed text-[var(--ink-2)]">{t("pf.mat.lead")}</p>
        <SheetStatus current={sheetView(sheet.current)} approved={sheetView(sheet.approved)} me={ws.session.identity.userId} canEdit={canEdit} canApprove={projectCan(loaded.p, "scope.decide") && sheet.access.via === "member" && !frozen} />
        <MaterialityEditor key={sheet.current?.id ?? "new"} cycleId={cycle.id} initial={initial?.success ? initial.data : null} canEdit={canEdit} />
      </Section>
    </>
  );
}
