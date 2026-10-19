import { loadProject, pickCycle, ProjectHeader } from "@/platform/project-shell";
import { Badge, Section, StateBox } from "@/platform/ui";
import { dateTime, titled, tr } from "@/platform/server";
import { grantCan, memberCan } from "@/server/policy/policy";
import { listCampaigns } from "@/server/data/service";
import { listCycles } from "@/server/projects/service";
import { listConnectors } from "@/server/connectors/service";
import { ConnectorForm, TriggerButton } from "@/platform/g8/connectors";

export const generateMetadata = titled("pf.con.title");

/** Setup → data connectors (G8-01): moved out of the data step so collecting and configuring stay apart. */
export default async function ConnectorsPage({ params, searchParams }: PageProps<"/[lang]/app/projects/[projectId]/connectors">) {
  const { lang, projectId } = await params;
  const sp = await searchParams;
  const t = tr(lang);
  const loaded = await loadProject(lang, projectId);
  if (!loaded.ok) return loaded.view;
  const { ws, data } = loaded.p;
  const cycles = await listCycles(ws.actor, projectId);
  const cycle = pickCycle(cycles, sp.cycle);
  const [campaigns, connectors] = await Promise.all([listCampaigns(ws.actor, projectId), listConnectors(ws.actor, projectId)]);
  const role = ws.actor.role;
  const canRequest = role !== null && memberCan(role, "data.request") && (data.access.via !== "grant" || grantCan(data.access.grantRole!, "data.request"));
  const mine = cycle ? campaigns.filter((c) => c.cycle_id === cycle.id) : [];
  return (
    <>
      <ProjectHeader lang={lang} p={loaded.p} cycleId={cycle?.id} />
      <div className="flex flex-col gap-6">
        {connectors.length === 0 && !(canRequest && data.access.via === "member" && mine.length > 0) ? (
          <StateBox state="empty" title={t("pf.con.title")}>
            {t("pf.con.lead")}
          </StateBox>
        ) : null}
        {(connectors.length > 0 || (canRequest && data.access.via === "member" && mine.length > 0)) && (
          <Section title={t("pf.con.title")}>
            <p className="text-[12.5px] leading-relaxed text-[var(--ink-3)]">{t("pf.con.lead")}</p>
            {connectors.length > 0 && (
              <ul className="flex flex-col gap-3">
                {connectors.map((c) => (
                  <li key={c.id} className="rounded-[12px] border border-[var(--rule)] bg-[var(--paper)] p-3 text-[13px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-semibold">{c.name}</span> · {t(`pf.con.kinds.${c.kind}`)} · <span className="font-mono text-[12px]">{c.allowed_host}</span> · {c.campaign_title} · {t(`pf.con.schedules.${c.schedule}`)}
                      </span>
                      {canRequest && <TriggerButton connectorId={c.id} />}
                    </div>
                    {c.runs.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-0.5 text-[12px] text-[var(--ink-2)]">
                        {c.runs.slice(0, 5).map((r) => (
                          <li key={r.id}>
                            <Badge tone={r.status === "failed" ? "crit" : r.status === "unchanged" ? "neutral" : "ok"}>{t(`pf.con.runStatus.${r.status}`)}</Badge> {dateTime(lang, r.pulled_at)}
                            {r.rows !== null ? ` · ${t("pf.con.rows", { rows: r.rows, valid: r.valid ?? 0 })}` : ""}
                            {r.message ? ` · ${r.message}` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canRequest && data.access.via === "member" && mine.length > 0 && <ConnectorForm campaigns={mine.map((c) => ({ id: c.id, title: c.title }))} />}
          </Section>
        )}
      </div>
    </>
  );
}
