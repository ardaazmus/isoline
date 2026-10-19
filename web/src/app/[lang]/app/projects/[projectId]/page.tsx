import { projectCycles, cycleSteps } from "@/platform/cached";
import Link from "next/link";
import { canSetup, loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Section, StateBox, Table, Td } from "@/platform/ui";
import { dateOnly, titled, tr } from "@/platform/server";
import { StepBoard } from "@/platform/steps";
import { byUrgency, inboxItems } from "@/platform/inbox-items";
import { InboxRows } from "@/platform/inbox-list";
import { STEP_PAGES, type StepId } from "@/server/cycle/steps";
import { myInbox } from "@/server/inbox/service";
import { SiteMap } from "@/platform/g8/visual";
import { isometric } from "@/lib/visual/layout";
import { siteStatus } from "@/server/visual/service";

export const generateMetadata = titled("pf.projects.title");

/** Which step page fixes each close condition. */
const FIX: Record<string, StepId> = {
  requests_closed: "collect",
  boundary_approved: "scope",
  facts_exist: "calculate",
  facts_approved: "calculate",
  no_open_blockers: "calculate",
  warnings_dispositioned: "calculate",
  reconciliation_current: "controls",
  consolidation_done: "controls",
  scope_confirmed: "scope",
};

/**
 * Project summary (UX review 19.10.2026): the cycle's seven steps with their recorded state, what waits for this
 * person in the project, and what still stops the close — each line linking to the step that resolves it. The
 * facility map stays as a picture of collection progress. Cycles, evidence and sharing moved to their own pages.
 */
export default async function ProjectPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId, sp.cycle);
  if (!loaded.ok) return loaded.view;
  const { ws } = loaded.p;
  const cycles = await projectCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  const base = `/${lang}/app/projects/${projectId}`;
  if (!cycle)
    return (
      <>
        <ProjectHeader lang={lang} p={loaded.p} />
        <StateBox state="empty" title={t("pf.steps.noCycle")} action={canSetup(loaded.p) ? <Link href={`${base}/setup`} className="text-[13.5px] font-medium text-[var(--b-700)]">{t("pf.steps.setup")}</Link> : undefined} />
      </>
    );
  const query = cycles[0] && cycle.id !== cycles[0].id ? `?cycle=${cycle.id}` : "";
  const [progress, box, sites] = await Promise.all([cycleSteps(ws.actor, cycle.id), myInbox(ws.actor), siteStatus(ws.actor, projectId, cycle.id)]);
  const mine = byUrgency(inboxItems(lang, box).filter((x) => x.projectId === projectId));
  const steps = progress?.steps ?? [];
  const dates = Object.fromEntries(steps.filter((s) => s.dueOn).map((s) => [s.dueOn!, dateOnly(lang, s.dueOn!)]));
  const frozen = ["frozen", "released"].includes(cycle.status);
  const missing = (progress?.checklist.items ?? []).filter((i) => !i.ok && (i.required || i.id === "scope_confirmed"));
  const iso = isometric(sites);

  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle.id} />
      <div className="flex flex-col gap-6">
        {progress && (
          <>
            {progress.current === "complete" && <StateBox state="action_success" title={t("pf.steps.complete")}>{t("pf.steps.completeLead")}</StateBox>}
            <StepBoard base={base} steps={steps.map((s) => ({ id: s.id, state: s.state, late: s.late, summary: s.summary, vars: s.vars, dueOn: s.dueOn, owner: s.owner }))} current={progress.current} query={query} dates={dates} />
          </>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={t("pf.steps.myWork")}>{mine.length ? <InboxRows lang={lang} items={mine} showProject={false} /> : <p className="text-[13.5px] text-[var(--ink-3)]">{t("pf.steps.noMyWork")}</p>}</Section>
          <Section title={t("pf.steps.blockers")}>
            {frozen ? (
              <p className="text-[13.5px] text-[var(--ink-2)]">{t("pf.steps.frozenNote")}</p>
            ) : missing.length === 0 ? (
              <p className="text-[13.5px] text-[var(--ink-2)]">{t("pf.steps.noBlockers")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--rule)]">
                {missing.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 text-[14px]">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{t(`pf.close.item.${i.id}`)}</span>
                      <span className="text-[12.5px] text-[var(--ink-3)]">{i.required ? t(`pf.close.why.${i.id}`, { n: i.count ?? 0 }) : t("pf.close.optional")}</span>
                    </span>
                    <Link href={`${base}/${STEP_PAGES[FIX[i.id] ?? "close"][0]}${query}`} className="text-[12.5px] font-medium text-[var(--b-700)]">
                      {t(`pf.steps.name.${FIX[i.id] ?? "close"}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        {sites.length > 0 && (
          <Section title={t("pf.vis.siteTitle", { label: cycle.label })} id="sites">
            <p className="text-[12.5px] text-[var(--ink-3)]">{t("pf.vis.siteLead")}</p>
            <SiteMap
              blocks={iso.blocks}
              width={iso.width}
              height={iso.height}
              title={t("pf.vis.siteTitle", { label: cycle.label })}
              desc={t("pf.vis.siteDesc")}
              labels={{ done: (a, n) => t("pf.vis.done", { a, n }), returned: (n) => t("pf.vis.returned", { n }) }}
            />
            <Table head={[t("pf.vis.entity"), t("pf.calc.facility"), t("pf.vis.progress"), t("pf.vis.returnedCol")]} caption={t("pf.vis.tableCaption")}>
              {sites.map((x) => (
                <tr key={x.id}>
                  <Td className="text-[12.5px]">{x.entity}</Td>
                  <Td>{x.name}</Td>
                  <Td className="tabular-nums">{t("pf.vis.done", { a: x.accepted, n: x.total })}</Td>
                  <Td className="tabular-nums">{x.blockers}</Td>
                </tr>
              ))}
            </Table>
          </Section>
        )}
        {cycles.length > 1 && (
          <Section title={t("pf.steps.otherCycles")}>
            <ul className="flex flex-wrap gap-2">
              {cycles.map((c) => (
                <li key={c.id}>
                  <Link href={c.id === cycles[0].id ? base : `${base}?cycle=${c.id}`} aria-current={c.id === cycle.id ? "page" : undefined} className={c.id === cycle.id ? "rounded-[10px] bg-[var(--b-600)] px-3 py-1 text-[13px] font-semibold text-white no-underline" : "glass rounded-[10px] px-3 py-1 text-[13px] text-[var(--ink-2)] no-underline"}>
                    {c.label} · {t(`pf.cycle.states.${c.status}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </>
  );
}
