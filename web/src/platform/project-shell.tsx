/** Server helpers shared by the project tabs: load the project with its access path, draw the header and tabs. */
import type { ReactNode } from "react";
import { ProjectTabs } from "./g2/project";
import { Badge, PageTitle, StateBox } from "./ui";
import { attempt, tr } from "./server";
import { requireWorkspace, type Workspace } from "@/server/http/dal";
import { projectOverview } from "@/server/tenancy/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LoadedProject = { ws: Workspace; data: Awaited<ReturnType<typeof projectOverview>> };

export async function loadProject(lang: string, projectId: string): Promise<{ ok: true; p: LoadedProject } | { ok: false; view: ReactNode }> {
  const t = tr(lang);
  const ws = await requireWorkspace(lang);
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

export function ProjectHeader({ lang, p, actions }: { lang: string; p: LoadedProject; actions?: ReactNode }) {
  const t = tr(lang);
  const { project, access } = p.data;
  return (
    <>
      <PageTitle
        title={project.name}
        lead={
          <>
            {t("pf.projects.ownedBy", { owner: project.owner_name })}{" "}
            {access.via === "grant" && <Badge tone="info">{t("pf.access.grantAs", { role: t(`pf.grantRole.${access.grantRole}`) })}</Badge>}
            {access.via === "steward" && <Badge tone="warn">{t("pf.access.stewardNote")}</Badge>}
          </>
        }
        actions={actions}
      />
      <ProjectTabs base={`/${lang}/app/projects/${project.id}`} />
    </>
  );
}

/** ?cycle=<id> when it belongs to the project, else the latest cycle. */
export function pickCycle<T extends { id: string }>(cycles: T[], requested: string | string[] | undefined): T | null {
  return (typeof requested === "string" ? cycles.find((c) => c.id === requested) : undefined) ?? cycles[0] ?? null;
}
