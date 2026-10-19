import { projectCycles, cycleSteps } from "@/platform/cached";
import Link from "next/link";
import { PlanTable, PlanTimeline } from "@/platform/g2/plan";
import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { OkNote, Section, StateBox } from "@/platform/ui";
import { titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listParticipants, listPlan } from "@/server/projects/service";

export const generateMetadata = titled("pf.plan.title");

/** Setup → schedule and owners (PORT-09): the cycle's work packages with dates, critical path and owners; each shows its step's derived state. */
export default async function PlanPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/plan">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const cycles = await projectCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  const [items, team, progress] = cycle ? await Promise.all([listPlan(ws.actor, cycle.id), listParticipants(ws.actor, projectId), cycleSteps(ws.actor, cycle.id)]) : [[], [], null];
  const steps = Object.fromEntries((progress?.steps ?? []).map((x) => [x.id, x.state]));
  const role = ws.actor.role;
  const canEdit = role !== null && memberCan(role, "plan.update") && (data.access.via !== "grant" || grantCan(data.access.grantRole!, "plan.update"));
  const people = [...new Map(team.map((p) => [p.user_id, { id: p.user_id, name: p.name }])).values()];
  const today = new Date().toISOString().slice(0, 10);
  const late = typeof sp.late === "string" && /^\d+$/.test(sp.late) ? Number(sp.late) : 0;

  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
      {!cycle ? (
        <StateBox state="empty" title={t("pf.cycle.none")} />
      ) : (
        <div className="flex flex-col gap-6">
          {late > 0 && <StateBox state="stale_version" title={t("pf.plan.lateTitle")}>{t("pf.plan.lateLead", { days: late })}</StateBox>}
          {sp.created === "1" && <OkNote>{t("pf.wizard.created")}</OkNote>}
          {cycles.length > 1 && (
            <nav aria-label={t("pf.cycle.title")} className="flex flex-wrap gap-2 text-[13px]">
              {cycles.map((c) => (
                <Link key={c.id} href={`?cycle=${c.id}`} aria-current={c.id === cycle.id ? "page" : undefined} className={c.id === cycle.id ? "font-semibold text-[var(--ink)]" : "text-[var(--b-700)]"}>
                  {c.label}
                </Link>
              ))}
            </nav>
          )}
          <Section title={t("pf.plan.timelineTitle", { label: cycle.label })}>
            <PlanTimeline items={items} today={today} publishDue={cycle.publish_due} periodEnd={cycle.period_end} steps={steps} />
          </Section>
          <Section title={t("pf.plan.tableTitle")}>
            <p className="text-[12.5px] text-[var(--ink-3)]">{canEdit ? t("pf.steps.derivedNote") : t("pf.state.read_only")}</p>
            <PlanTable items={items} people={people} canEdit={canEdit} today={today} steps={steps} />
          </Section>
        </div>
      )}
    </>
  );
}
