/** Server helpers shared by the project tabs: load the project with its access path, draw the header and tabs. */
import type { ReactNode } from "react";
import { ProjectNav } from "./steps";
import { Badge, PageTitle, StateBox } from "./ui";
import { attempt, tr } from "./server";
import { requireWorkspace, type Workspace } from "@/server/http/dal";
import { projectOverview } from "@/server/tenancy/service";
import { cycleSteps, projectCycles } from "./cached";
import { grantCan, memberCan, type Action } from "@/server/policy/policy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LoadedProject = { ws: Workspace; data: Awaited<ReturnType<typeof projectOverview>> };

/**
 * The project with the person's access path. `cycle` is the page's ?cycle= (pickCycle): every project page then reads
 * the cycles and that cycle's steps for its header, so both start here beside the project instead of after the page's
 * own data (G8-07 load test: each round trip waits its turn under load). The request-scoped memo (./cached) hands the
 * page and the header these same promises; when access is refused nobody awaits them.
 */
export async function loadProject(lang: string, projectId: string, cycle?: string | string[]): Promise<{ ok: true; p: LoadedProject } | { ok: false; view: ReactNode }> {
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
  if (UUID.test(projectId)) {
    projectCycles(ws.actor, projectId)
      .then((cycles) => {
        const c = pickCycle(cycles, cycle);
        return c ? cycleSteps(ws.actor, c.id) : null;
      })
      .catch(() => undefined);
  }
  const r = UUID.test(projectId) ? await attempt(() => projectOverview(ws.actor, projectId)) : ({ ok: false, status: 404, code: "not_found" } as const);
  if (!r.ok)
    return {
      ok: false,
      view: (
        <StateBox state={r.status === 403 ? "not_authorized" : "empty"} title={t(r.status === 403 ? "pf.state.not_authorized" : "pf.projects.notFound")}>
          {t("pf.projects.notFoundLead")}
        </StateBox>
      ),
    };
  return { ok: true, p: { ws, data: r.data } };
}

/** May this person attempt an action in the project (role, and the grant when working through one)? */
export function projectCan(p: LoadedProject, action: Action): boolean {
  const role = p.ws.actor.role;
  const { access } = p.data;
  return role !== null && memberCan(role, action) && (access.via !== "grant" || grantCan(access.grantRole!, action));
}

/** A worksheet row as plain data for a client component (dates as ISO strings). */
export function sheetView<T extends { created_at: Date | string; approved_at: Date | string | null }>(r: T | null) {
  if (!r) return null;
  return { ...r, created_at: new Date(r.created_at).toISOString(), approved_at: r.approved_at ? new Date(r.approved_at).toISOString() : null };
}

/** Who may open the project's setup (schedule, team, packs, connectors, cycles and sharing). */
export function canSetup(p: LoadedProject): boolean {
  const role = p.ws.actor.role;
  const { access } = p.data;
  return role !== null && memberCan(role, "plan.update") && (access.via !== "grant" || grantCan(access.grantRole!, "plan.update"));
}

/**
 * Project title and the cycle's step bar. The steps are those of `cycleId` when the page works on a chosen cycle,
 * else of the newest cycle; a non-newest cycle is carried along in the step links (?cycle=).
 */
export async function ProjectHeader({ lang, p, actions, cycleId }: { lang: string; p: LoadedProject; actions?: ReactNode; cycleId?: string | null }) {
  const t = tr(lang);
  const { project, access } = p.data;
  const cycles = await projectCycles(p.ws.actor, project.id);
  const cycle = (cycleId ? cycles.find((c) => c.id === cycleId) : undefined) ?? cycles[0] ?? null;
  const progress = cycle ? await cycleSteps(p.ws.actor, cycle.id) : null;
  const query = cycle && cycles[0] && cycle.id !== cycles[0].id ? `?cycle=${cycle.id}` : "";
  return (
    <>
      <PageTitle
        title={project.name}
        lead={
          <>
            {t("pf.projects.ownedBy", { owner: project.owner_name })}
            {cycle && <> · {t("pf.steps.cycle")} {cycle.label}</>}{" "}
            {access.via === "grant" && <Badge tone="info">{t("pf.access.grantAs", { role: t(`pf.grantRole.${access.grantRole}`) })}</Badge>}
            {access.via === "steward" && <Badge tone="warn">{t("pf.access.stewardNote")}</Badge>}
          </>
        }
        actions={actions}
      />
      <ProjectNav
        base={`/${lang}/app/projects/${project.id}`}
        steps={(progress?.steps ?? []).map((s) => ({ id: s.id, state: s.state, late: s.late }))}
        current={progress?.current ?? null}
        query={query}
        canSetup={canSetup(p)}
      />
    </>
  );
}

/** ?cycle=<id> when it belongs to the project, else the latest cycle. */
export function pickCycle<T extends { id: string }>(cycles: T[], requested: string | string[] | undefined): T | null {
  return (typeof requested === "string" ? cycles.find((c) => c.id === requested) : undefined) ?? cycles[0] ?? null;
}
